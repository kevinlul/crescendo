class Command {
    constructor(base, required, optional) {
        this.base = base;
        this.required = required;
        this.optional = optional;
    }

    static pushOption(commandArray, option, value) {
        commandArray.push(
            option.length == 1 ? `-${option}` : `--${option}`,
            value + ""
        );
    }

    array(options) {
        const commandArray = this.base.slice();
        for (const option of this.required) {
            if (!options[option]) throw new Error(`Missing required parameter "${option}"!`);
            Command.pushOption(commandArray, option, options[option]);
        }
        for (const option of this.optional) {
            if (options[option]) Command.pushOption(commandArray, option, options[option]);
        }
        return commandArray;
    }
}

module.exports = Command;
