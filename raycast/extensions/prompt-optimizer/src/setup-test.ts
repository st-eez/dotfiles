const Module = require('module');
const originalRequire = Module.prototype.require;

// @ts-ignore
Module.prototype.require = function (id) {
    if (id === '@raycast/api') {
        return {
            Icon: {
                Code: 'code',
                Stars: 'stars',
                Terminal: 'terminal'
            }
        };
    }
    return originalRequire.apply(this, arguments);
};
