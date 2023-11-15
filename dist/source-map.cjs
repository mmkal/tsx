'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var sourceMapSupport = require('source-map-support');
var nodeFeatures = require('./node-features-84a305a1.cjs');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var sourceMapSupport__default = /*#__PURE__*/_interopDefaultLegacy(sourceMapSupport);

const shouldStripSourceMap = "sourceMapsEnabled" in process && process.sourceMapsEnabled === false;
const sourceMapPrefix = "\n//# sourceMappingURL=";
const stripSourceMap = (code) => {
  const sourceMapIndex = code.indexOf(sourceMapPrefix);
  if (sourceMapIndex !== -1) {
    return code.slice(0, sourceMapIndex);
  }
  return code;
};
const inlineSourceMapPrefix = `${sourceMapPrefix}data:application/json;base64,`;
const installSourceMapSupport = (loaderPort) => {
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
  if (nodeFeatures.isolatedLoader && loaderPort) {
    loaderPort.addListener(
      "message",
      ({ filePath, map }) => sourcemaps.set(filePath, map)
    );
  }
  return ({ code, map }, filePath, mainThreadPort) => {
    if (nodeFeatures.isolatedLoader && mainThreadPort) {
      mainThreadPort.postMessage({ filePath, map });
    } else {
      sourcemaps.set(filePath, map);
    }
    return code;
  };
};

exports.installSourceMapSupport = installSourceMapSupport;
exports.shouldStripSourceMap = shouldStripSourceMap;
exports.stripSourceMap = stripSourceMap;
