# crescendo

A pipeline orchestration microservice, originally intended for use in the backend of [CReSCENT](https://github.com/pughlab/crescent). It's a simple, high-level abstraction over the Docker REST API and can be run standalone or in a container itself.

This is not meant to be exposed to WAN because it is not secured at all and permits arbitrary remote code execution.

## Setup

### As a container

Build the image and run it, exposing port 3001 for requests and mounting `/var/run/docker.sock` to communicate with the Docker daemon on the host. You can build your image on top of crescendo to provide `/crescendo/config.json` for available services or use a bind mount. All child container output is logged to `/crescendo/log` inside the container. Example:
```bash
docker run -p 3001:3001 -v $PWD/config.json:/crescendo/config.json -v /var/run/docker.sock:/var/run/docker.sock crescendo
```

### Standalone

Create an appropriate `.env` file:
```
NODE_ENV=production
DEBUG=crescendo*
CRESCENDO_PORT=3001
CONFIG_PATH=config.json
LOG_DIR=./log
```
Create an appropriate configuration at CONFIG_PATH. To install and run:
```bash
npm ci
node index.js
```

### Service configuration

The configuration JSON should be an array of services. The shape of a service is described below.
Boolean fields default to `false` if not provided. Arrays may contain any number of elements.
```json
  {
    "name": "Name of the service to POST to from the web side",
    "image": "Docker tag for an image. Must already exist on the host.",
    "network": "An existing Docker network to connect the container to. Optional.",
    "baseVolumes": [
      {
        "host": "Bind mount or volume to always mount on the container",
        "container": "/path/in/container",
        "readonly": true
      }
    ],
    "dynamicVolumes": {
      "/path/in/container": {
        "hostAllowed": [
          "allowed-volume-name",
          "/allowed/bind/prefix"
        ],
        "readonly": true,
        "required": true
      },
    },
    "baseCommand": ["command", "prefix", "to", "always", "run"],
    "requiredParams": ["param-client-must-provide"],
    "optionalParams": ["param-client-could-provide"]
  }
```
The `baseVolumes`, `dynamicVolumes`, `hostAllowed`, `requiredParams`, and `optionalParams` keys are optional.
The `dynamicVolumes` are mounted by user request.
The `baseCommand` is passed literally to the the container. The remaining parameters are passed in POSIX form:
`--parameter value` for long names and `-p` for single-letter parameters.

## Usage

POST to `/` or `/name-of-service` with a JSON body like so, where the child hashes correspond to the
allowed volumes and needed command parameters above.
```json
{
  "service": "Name of the service, only required if sending a request to /",
  "volumes": {
    "/path/in/container": "Bind mount or name of existing volume",
  },
  "params": {
    "parameter": "value"
  },
  "webhook": "optional url",
  "token": "optional payload to send back with the webhook"
}
```
On success, the response status will be 201 and the body will be the crescendo ID of the new container created.
If the shape of the request is incorrect, a requested volume is not permitted, or a required parameter is
missing, the response status will be 400.

If `webhook` is specified, when the container completes, the following JSON is POSTed to it:
```json
{
  "timestamp": "crescendo ID as a number",
  "token": "user-provided as above or a blank string",
  "Error": "Docker error if one occurred or null",
  "StatusCode": "numeric exit code of the container, 255 if failed to start"
}
```
