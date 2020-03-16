const debug = require("debug");
const Docker = require("dockerode");
const express = require("express");
const fetch = require("node-fetch");
const fs = require("fs-extra");
const morgan = require("morgan");

const Service = require("./service");

const logger = debug("crescendo");
const docker = new Docker();
const servicesConfig = fs.readJSONSync(process.env.CONFIG_PATH);
logger("Loaded services %o", servicesConfig.map(config => config.name));
// Create a map of service names to Service objects based on each element of servicesConfig
const services = servicesConfig.reduce(
    (obj, config) => (
        obj[config.name] = new Service(docker, config),
        obj
    ), {});

fs.mkdirpSync(process.env.LOG_DIR);

const crescendo = express();
// combined + response time
crescendo.use(morgan(`:remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms`));
crescendo.use(express.json());
crescendo.post("/", (req, res, next) => {
    if (req.body.service) {
        req.params.service = req.body.service;
        next();
    } else {
        res.sendStatus(400);
    }
}, createService);
crescendo.post("/:service", createService);

function createService(req, res) {
    if (!services[req.params.service]) {
        res.sendStatus(404);
        return;
    }
    const timestamp = Date.now();
    const outpath = `${process.env.LOG_DIR}/${timestamp}.out.log`;
    const errpath = `${process.env.LOG_DIR}/${timestamp}.err.log`;
    const sout = fs.createWriteStream(outpath);
    const serr = fs.createWriteStream(errpath);
    logger("Log timestamp %d", timestamp);
    try {
        var run = services[req.params.service].run(
            timestamp + "",
            sout,
            serr,
            req.body
        );
        logger("Starting %s container with log timestamp %d", req.params.service, timestamp);
        res.status(201).send(timestamp + "");
        setImmediate(serviceCompleteThunk(run, timestamp, req.body.webhook));
    } catch (err) {
        sout.end();
        fs.remove(outpath);
        serr.end();
        fs.remove(errpath);
        res.status(400).send(err.message);
    }
}

function serviceCompleteThunk(run, timestamp, webhook) {
    return async () => {
        let runResult;
        try {
            [runResult] = await run;
            logger("%d completed: %o", timestamp, runResult);
        } catch (err) {
            logger("%d errored: %o", timestamp, err);
            return;
        }
        if (webhook) {
            try {
                const response = await fetch(webhook, {
                    method: "POST",
                    body: JSON.stringify(runResult),
                    headers: { "Content-Type": "application/json" }
                });
                logger("%d post to webhook %s: %d %s", timestamp, webhook, response.status, response.statusText);
            } catch (err) {
                logger("%d error on webhook %s: %o", timestamp, webhook, err);
            }
        }
    }
}

module.exports = crescendo;
