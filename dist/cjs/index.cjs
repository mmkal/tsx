'use strict';

var path = require('path');
var fs = require('fs');
var Module = require('module');
var getTsconfig = require('get-tsconfig');
var sourceMap = require('../source-map.cjs');
var index = require('../index-6a8696ce.cjs');
var resolveTsPath = require('../resolve-ts-path-43f50656.cjs');
require('source-map-support');
require('../node-features-84a305a1.cjs');
require('url');
require('esbuild');
require('crypto');
require('os');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
var Module__default = /*#__PURE__*/_interopDefaultLegacy(Module);

const isESM = (code) => {
  if (code.includes("import") || code.includes("export")) {
    const [imports, exports] = index.parseEsm(code);
    return imports.length > 0 || exports.length > 0;
  }
  return false;
};

const isRelativePathPattern = /^\.{1,2}\//;
const isTsFilePatten = /\.[cm]?tsx?$/;
const nodeModulesPath = `${path__default["default"].sep}node_modules${path__default["default"].sep}`;
const tsconfig = process.env.TSX_TSCONFIG_PATH ? {
  path: path__default["default"].resolve(process.env.TSX_TSCONFIG_PATH),
  config: getTsconfig.parseTsconfig(process.env.TSX_TSCONFIG_PATH)
} : getTsconfig.getTsconfig();
const fileMatcher = tsconfig && getTsconfig.createFilesMatcher(tsconfig);
const tsconfigPathsMatcher = tsconfig && getTsconfig.createPathsMatcher(tsconfig);
const applySourceMap = sourceMap.installSourceMapSupport();
const extensions = Module__default["default"]._extensions;
const defaultLoader = extensions[".js"];
const typescriptExtensions = [
  ".cts",
  ".mts",
  ".ts",
  ".tsx",
  ".jsx"
];
const transformExtensions = [
  ".js",
  ".cjs",
  ".mjs"
];
const transformer = (module, filePath) => {
  if (process.send) {
    process.send({
      type: "dependency",
      path: filePath
    });
  }
  const transformTs = typescriptExtensions.some((extension) => filePath.endsWith(extension));
  const transformJs = transformExtensions.some((extension) => filePath.endsWith(extension));
  if (!transformTs && !transformJs) {
    return defaultLoader(module, filePath);
  }
  let code = fs__default["default"].readFileSync(filePath, "utf8");
  if (sourceMap.shouldStripSourceMap) {
    code = sourceMap.stripSourceMap(code);
  }
  if (filePath.endsWith(".cjs")) {
    const transformed = index.transformDynamicImport(filePath, code);
    if (transformed) {
      code = applySourceMap(transformed, filePath);
    }
  } else if (transformTs || isESM(code)) {
    const transformed = index.transformSync(
      code,
      filePath,
      {
        tsconfigRaw: fileMatcher == null ? void 0 : fileMatcher(filePath)
      }
    );
    code = applySourceMap(transformed, filePath);
  }
  module._compile(code, filePath);
};
[
  /**
   * Handles .cjs, .cts, .mts & any explicitly specified extension that doesn't match any loaders
   *
   * Any file requested with an explicit extension will be loaded using the .js loader:
   * https://github.com/nodejs/node/blob/e339e9c5d71b72fd09e6abd38b10678e0c592ae7/lib/internal/modules/cjs/loader.js#L430
   */
  ".js",
  /**
   * Loaders for implicitly resolvable extensions
   * https://github.com/nodejs/node/blob/v12.16.0/lib/internal/modules/cjs/loader.js#L1166
   */
  ".ts",
  ".tsx",
  ".jsx"
].forEach((extension) => {
  extensions[extension] = transformer;
});
Object.defineProperty(extensions, ".mjs", {
  value: transformer,
  // Prevent Object.keys from detecting these extensions
  // when CJS loader iterates over the possible extensions
  enumerable: false
});
const defaultResolveFilename = Module__default["default"]._resolveFilename.bind(Module__default["default"]);
Module__default["default"]._resolveFilename = (request, parent, isMain, options) => {
  var _a;
  const queryIndex = request.indexOf("?");
  if (queryIndex !== -1) {
    request = request.slice(0, queryIndex);
  }
  if (tsconfigPathsMatcher && !isRelativePathPattern.test(request) && !((_a = parent == null ? void 0 : parent.filename) == null ? void 0 : _a.includes(nodeModulesPath))) {
    const possiblePaths = tsconfigPathsMatcher(request);
    for (const possiblePath of possiblePaths) {
      const tsFilename2 = resolveTsFilename(possiblePath, parent, isMain, options);
      if (tsFilename2) {
        return tsFilename2;
      }
      try {
        return defaultResolveFilename(
          possiblePath,
          parent,
          isMain,
          options
        );
      } catch {
      }
    }
  }
  const tsFilename = resolveTsFilename(request, parent, isMain, options);
  if (tsFilename) {
    return tsFilename;
  }
  return defaultResolveFilename(request, parent, isMain, options);
};
const resolveTsFilename = (request, parent, isMain, options) => {
  const tsPath = resolveTsPath.resolveTsPath(request);
  if ((parent == null ? void 0 : parent.filename) && isTsFilePatten.test(parent.filename) && tsPath) {
    for (const tryTsPath of tsPath) {
      try {
        return defaultResolveFilename(
          tryTsPath,
          parent,
          isMain,
          options
        );
      } catch (error) {
        const { code } = error;
        if (code !== "MODULE_NOT_FOUND" && code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") {
          throw error;
        }
      }
    }
  }
};
