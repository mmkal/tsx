import sourceMapSupport from 'source-map-support';
import { a as isolatedLoader } from './node-features-a792cc3d.mjs';

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
  sourceMapSupport.install({
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
};

export { installSourceMapSupport, shouldStripSourceMap, stripSourceMap };
