require("dotenv").config();
const debug = require("debug");
const crescendo = require("./crescendo");

crescendo.listen(process.env.CRESCENDO_PORT, () => {
    debug("crescendo")(`crescendo listening on ${process.env.CRESCENDO_PORT}.`);
});
