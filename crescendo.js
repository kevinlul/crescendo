require("dotenv").config();
const debug = require("debug");
const Docker = require("dockerode");
const express = require("express");

const logger = debug("crescendo");
const docker = new Docker();
const crescendo = express();

function getCommand(name, options) {
    const required = [
        "input_type",
        "prefix_outfiles"
    ];
    const optional = [
        "inputs_remove_barcodes",
        "normalize_and_scale_sample",
        "resolution",
        "infile_colour_dim_red_plots",
        "list_genes",
        "pca_dimensions",
        "percent_mito",
        "percent_ribo",
        "n_genes",
        "n_reads",
        "return_threshold",
        "number_cores",
        "save_r_object",
        "run_cwl"
    ];
    const command = ["Rscript", name];
    for (const option of required) {
        if (!options[option]) throw new Error(`Missing required parameter "${option}"!`);
        command.push(`--${option}`, options[option]);
    }
    for (const option of optional) {
        if (options[option]) command.push(`--${option}`, options[option]);
    }
    return command;
}

crescendo.use("/seurat", express.json(), (req, res) => {
    if (!req.body.input) {
        res.status(400).send(`Missing required parameter "input"!`);
        return;
    }
    if (!req.body.output) {
        res.status(400).send(`Missing required parameter "output"!`);
        return;
    }
    const name = "Runs_seurat_v3.R";
    const input = req.body.input;
    const output = req.body.output;
    const vin = "/in";
    const vout = "/out";
    try {
        var command = getCommand(name, req.body);
        command.push("--input", vin, "--outdir", vout);
    } catch(err) {
        res.status(400).send(err.message);
        return;
    }
    const run = docker.run(
        "crescentdev/crescent-seurat",
        command,
        [process.stdout, process.stderr],
        {
            Tty: false,
            HostConfig: {
                Binds: [
                    `${process.env.HOST_PATH}/${name}:/${name}`,
                    `${input}:${vin}`,
                    `${output}:${vout}`
                ]
            }
        }
    );
    res.sendStatus(200);
    setImmediate(async () => {
        try {
            const [runResult, container] = await run;
            logger("DOCKER RESULT: %o", runResult);
            container.remove();
        } catch(err) {
            logger("DOCKER ERROR: %o", err);
        }
    });
});

module.exports = crescendo;
