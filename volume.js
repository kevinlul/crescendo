class VolumeProvider {
    constructor(base, dynamic) {
        base = base || [];
        this.baseBinds = base.map(
            ({ host, container, readonly }) => VolumeProvider.asBindString(host, container, readonly)
        );
        this.dynamic = dynamic || {};
    }

    static asBindString(host, container, readonly) {
        const access = readonly ? "ro" : "rw";
        return `${host}:${container}:${access}`;
    }

    // Assuming the mount path is valid, checks if the path or volume on the host side is permitted
    checkAllowedBind(containerMountPath, proposedHostBind) {
        if (!this.dynamic[containerMountPath].hostAllowed) return true;
        for (const token of this.dynamic[containerMountPath].hostAllowed) {
            if (token[0] === '/') {
                if (proposedHostBind.startsWith(token)) return true;
            } else {
                if (proposedHostBind === token) return true;
            }
        }
        return false;
    }

    getBinds(mapping) {
        const binds = this.baseBinds.slice();
        // Creates a hash of the keys in this.dynamic that have truthy `required` to `false`
        const checkRequired = Object.keys(this.dynamic)
            .filter(key => this.dynamic[key].required)
            .reduce((obj, key) => (obj[key] = false, obj), {});

        for (const containerMountPath in mapping) {
            if (!this.dynamic[containerMountPath])
                throw new Error(`Volume ${containerMountPath} not allowed.`);
            if (!this.checkAllowedBind(containerMountPath, mapping[containerMountPath]))
                throw new Error(`Proposed bind to ${mapping[containerMountPath]} not allowed.`);

            binds.push(VolumeProvider.asBindString(
                mapping[containerMountPath],
                containerMountPath,
                this.dynamic[containerMountPath].readonly
            ));

            if (containerMountPath in checkRequired)
                checkRequired[containerMountPath] = true;
        }

        for (const key in checkRequired) {
            if (!checkRequired[key]) throw new Error(`Missing required volume ${key}!`);
        }
        return binds;
    }
}

module.exports = VolumeProvider;
