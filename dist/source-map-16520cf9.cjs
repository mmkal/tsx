'use strict';

var path = require('path');
var sourceMapSupport = require('source-map-support');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var sourceMapSupport__default = /*#__PURE__*/_interopDefaultLegacy(sourceMapSupport);

const nodeVersion = process.versions.node.split(".").map(Number);
const compareNodeVersion = (version) => nodeVersion[0] - version[0] || nodeVersion[1] - version[1] || nodeVersion[2] - version[2];

const tsExtensions = /* @__PURE__ */ Object.create(null);
tsExtensions[".js"] = [".ts", ".tsx", ".js", ".jsx"];
tsExtensions[".jsx"] = [".tsx", ".ts", ".jsx", ".js"];
tsExtensions[".cjs"] = [".cts"];
tsExtensions[".mjs"] = [".mts"];
const resolveTsPath = (filePath) => {
  const extension = path__default["default"].extname(filePath);
  const [extensionNoQuery, query] = path__default["default"].extname(filePath).split("?");
  const possibleExtensions = tsExtensions[extensionNoQuery];
  if (possibleExtensions) {
    const extensionlessPath = filePath.slice(0, -extension.length);
    return possibleExtensions.map(
      (tsExtension) => extensionlessPath + tsExtension + (query ? `?${query}` : "")
    );
  }
};

const isolatedLoader = compareNodeVersion([20, 0, 0]) >= 0;
const inlineSourceMapPrefix = "\n//# sourceMappingURL=data:application/json;base64,";
function installSourceMapSupport(loaderPort) {
  const hasNativeSourceMapSupport = (
    /**
     * Check if native source maps are supported by seeing if the API is available
     * https://nodejs.org/dist/latest-v18.x/docs/api/process.html#processsetsourcemapsenabledval
     */
    "setSourceMapsEnabled" in process && typeof Error.prepareStackTrace !== "function"
  );
  if (hasNativeSourceMapSupport) {
    process.setSourceMapsEnabled(true);
    return ({ code, map }) => code + inlineSourceMapPrefix + Buffer.from(JSON.stringify(map), "utf8").toString("base64");
  }
  const sourcemaps = /* @__PURE__ */ new Map();
  sourceMapSupport__default["default"].install({
    environment: "node",
    retrieveSourceMap(url) {
      const map = sourcemaps.get(url);
      return map ? { url, map } : null;
    }
  });
  if (isolatedLoader && loaderPort) {
    loaderPort.addListener(
      "message",
      ({ filePath, map }) => sourcemaps.set(filePath, map)
    );
  }
  return ({ code, map }, filePath, mainThreadPort) => {
    if (isolatedLoader && mainThreadPort) {
      mainThreadPort.postMessage({ filePath, map });
    } else {
      sourcemaps.set(filePath, map);
    }
    return code;
  };
}

exports.compareNodeVersion = compareNodeVersion;
exports.installSourceMapSupport = installSourceMapSupport;
exports.resolveTsPath = resolveTsPath;
