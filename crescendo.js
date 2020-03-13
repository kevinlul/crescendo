const debug = require("debug");
const Docker = require("dockerode");
const express = require("express");
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
    fs.mkdirpSync(process.env.LOG_DIR);
    const sout = fs.createWriteStream(`${process.env.LOG_DIR}/${timestamp}.out.log`);
    const serr = fs.createWriteStream(`${process.env.LOG_DIR}/${timestamp}.err.log`);
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
        setImmediate(async () => {
            try {
                const [runResult] = await run;
                logger("%d completed: %o", timestamp, runResult);
            } catch(err) {
                logger("%d errored: %o", timestamp, err);
            }
        });
    } catch (err) {
        res.status(400).send(err.message);
    }
}

module.exports = crescendo;
