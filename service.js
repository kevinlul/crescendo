const debug = require("debug");

const Command = require("./command");
const VolumeProvider = require("./volume");

const logger = debug("crescendo:Service");

class Service {
    constructor(docker, config) {
        this.docker = docker;
        this.config = config;
        this.commandProvider = new Command(
            config.baseCommand,
            config.requiredParams,
            config.optionalParams
        );
        this.volumeProvider = new VolumeProvider(
            config.baseVolumes,
            config.dynamicVolumes
        );
    }

    run(name, sout, serr, runOptions) {
        const command = this.commandProvider.array(runOptions.params);
        logger("%s: computed command %o", name, command);
        const volumes = this.volumeProvider.getBinds(runOptions.volumes);
        logger("%s: computed binds %o", name, volumes);
        const createOptions = {
            name,
            Tty: false,
            HostConfig: {
                AutoRemove: true,
                Binds: volumes
            }
        };
        if (runOptions.network) {
            createOptions.HostConfig.NetworkMode = runOptions.network;
        }
        return this.docker.run(
            this.config.image,
            command,
            [sout, serr],
            createOptions
        );
    }
}

module.exports = Service;
