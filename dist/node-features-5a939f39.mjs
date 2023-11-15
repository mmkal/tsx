const nodeVersion = process.versions.node.split(".").map(Number);
const compareNodeVersion = (version) => nodeVersion[0] - version[0] || nodeVersion[1] - version[1] || nodeVersion[2] - version[2];
const isolatedLoader = compareNodeVersion([20, 0, 0]) >= 0;
const supportsModuleRegister = compareNodeVersion([20, 6, 0]) >= 0;
compareNodeVersion([21, 0, 0]) >= 0;

export { isolatedLoader as i, supportsModuleRegister as s };
