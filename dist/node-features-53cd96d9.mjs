const nodeVersion = process.versions.node.split(".").map(Number);
const compareNodeVersion = (version) => nodeVersion[0] - version[0] || nodeVersion[1] - version[1] || nodeVersion[2] - version[2];
const nodeSupportsImport = (
  // v13.2.0 and higher
  compareNodeVersion([13, 2, 0]) >= 0 || compareNodeVersion([12, 20, 0]) >= 0 && compareNodeVersion([13, 0, 0]) < 0
);
const supportsNodePrefix = compareNodeVersion([16, 0, 0]) >= 0 || compareNodeVersion([14, 18, 0]) >= 0;
const nodeSupportsDeprecatedLoaders = compareNodeVersion([16, 12, 0]) < 0;
const isolatedLoader = compareNodeVersion([20, 0, 0]) >= 0;
const supportsModuleRegister = compareNodeVersion([20, 6, 0]) >= 0;

export { supportsNodePrefix as a, nodeSupportsImport as b, isolatedLoader as i, nodeSupportsDeprecatedLoaders as n, supportsModuleRegister as s };
