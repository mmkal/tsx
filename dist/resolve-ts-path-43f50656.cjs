'use strict';

var path = require('path');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var path__default = /*#__PURE__*/_interopDefaultLegacy(path);

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

exports.resolveTsPath = resolveTsPath;
