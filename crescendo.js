const debug = require("debug");
const Docker = require("dockerode");
const express = require("express");
const fs = require("fs-extra");
const morgan = require("morgan");

const Service = require("./service");

const logger = debug("crescendo");
const docker = new Docker();
const seuratConfig = fs.readJSONSync("./seurat.config.json")[0];
const seuratService = new Service(docker, seuratConfig);

const crescendo = express();
// combined + response time
crescendo.use(morgan(`:remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms`));

crescendo.use("/seurat", express.json(), (req, res) => {
    const timestamp = Date.now();
    fs.mkdirpSync(process.env.LOG_DIR);
    const sout = fs.createWriteStream(`${process.env.LOG_DIR}/${timestamp}.out.log`);
    const serr = fs.createWriteStream(`${process.env.LOG_DIR}/${timestamp}.err.log`);
    logger("Log timestamp %d", timestamp);
    try {
        var run = seuratService.run(
            timestamp + "",
            sout,
            serr,
            req.body
        );
        logger("Starting seurat container with log timestamp %d", timestamp);
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
});

module.exports = crescendo;
