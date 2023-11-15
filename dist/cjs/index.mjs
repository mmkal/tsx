import path from 'path';
import fs from 'fs';
import Module from 'module';
import { parseTsconfig, getTsconfig, createFilesMatcher, createPathsMatcher } from 'get-tsconfig';
import { installSourceMapSupport, shouldStripSourceMap, stripSourceMap } from '../source-map.mjs';
import { p as parseEsm, a as transformDynamicImport, b as transformSync } from '../index-fdd79e29.mjs';
import { r as resolveTsPath } from '../resolve-ts-path-a8cb04a4.mjs';
import 'source-map-support';
import '../node-features-a792cc3d.mjs';
import 'url';
import 'esbuild';
import 'crypto';
import 'magic-string';
import 'es-module-lexer';
import 'es-module-lexer/js';
import 'os';

const isESM = (code) => {
  if (code.includes("import") || code.includes("export")) {
    const [imports, exports] = parseEsm(code);
    return imports.length > 0 || exports.length > 0;
  }
  return false;
};

const isRelativePathPattern = /^\.{1,2}\//;
const isTsFilePatten = /\.[cm]?tsx?$/;
const nodeModulesPath = `${path.sep}node_modules${path.sep}`;
const tsconfig = process.env.TSX_TSCONFIG_PATH ? {
  path: path.resolve(process.env.TSX_TSCONFIG_PATH),
  config: parseTsconfig(process.env.TSX_TSCONFIG_PATH)
} : getTsconfig();
const fileMatcher = tsconfig && createFilesMatcher(tsconfig);
const tsconfigPathsMatcher = tsconfig && createPathsMatcher(tsconfig);
const applySourceMap = installSourceMapSupport();
const extensions = Module._extensions;
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
  let code = fs.readFileSync(filePath, "utf8");
  if (shouldStripSourceMap) {
    code = stripSourceMap(code);
  }
  if (filePath.endsWith(".cjs")) {
    const transformed = transformDynamicImport(filePath, code);
    if (transformed) {
      code = applySourceMap(transformed, filePath);
    }
  } else if (transformTs || isESM(code)) {
    const transformed = transformSync(
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
const defaultResolveFilename = Module._resolveFilename.bind(Module);
Module._resolveFilename = (request, parent, isMain, options) => {
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
  const tsPath = resolveTsPath(request);
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
