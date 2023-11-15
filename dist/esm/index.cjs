'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var worker_threads = require('worker_threads');
var nodeFeatures = require('../node-features-84a305a1.cjs');
var Module = require('module');
var sourceMap = require('../source-map.cjs');
var path = require('path');
var url = require('url');
var index = require('../index-6a8696ce.cjs');
var resolveTsPath = require('../resolve-ts-path-43f50656.cjs');
var getTsconfig = require('get-tsconfig');
var fs = require('fs');
require('source-map-support');
require('esbuild');
require('crypto');
require('os');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var Module__default = /*#__PURE__*/_interopDefaultLegacy(Module);
var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);

const registerLoader = () => {
  const { port1, port2 } = new worker_threads.MessageChannel();
  sourceMap.installSourceMapSupport(port1);
  if (process.send) {
    port1.addListener("message", (message) => {
      if (message.type === "dependency") {
        process.send(message);
      }
    });
  }
  port1.unref();
  Module__default["default"].register(
    "./index.mjs",
    {
      parentURL: (typeof document === 'undefined' ? new (require('u' + 'rl').URL)('file:' + __filename).href : (document.currentScript && document.currentScript.src || new URL('esm/index.cjs', document.baseURI).href)),
      data: {
        port: port2
      },
      transferList: [port2]
    }
  );
};

const packageJsonCache = /* @__PURE__ */ new Map();
async function readPackageJson(filePath) {
  if (packageJsonCache.has(filePath)) {
    return packageJsonCache.get(filePath);
  }
  const exists = await fs__default["default"].promises.access(filePath).then(
    () => true,
    () => false
  );
  if (!exists) {
    packageJsonCache.set(filePath, void 0);
    return;
  }
  const packageJsonString = await fs__default["default"].promises.readFile(filePath, "utf8");
  try {
    const packageJson = JSON.parse(packageJsonString);
    packageJsonCache.set(filePath, packageJson);
    return packageJson;
  } catch {
    throw new Error(`Error parsing: ${filePath}`);
  }
}
async function findPackageJson(filePath) {
  let packageJsonUrl = new URL("package.json", filePath);
  while (true) {
    if (packageJsonUrl.pathname.endsWith("/node_modules/package.json")) {
      break;
    }
    const packageJsonPath = url.fileURLToPath(packageJsonUrl);
    const packageJson = await readPackageJson(packageJsonPath);
    if (packageJson) {
      return packageJson;
    }
    const lastPackageJSONUrl = packageJsonUrl;
    packageJsonUrl = new URL("../package.json", packageJsonUrl);
    if (packageJsonUrl.pathname === lastPackageJSONUrl.pathname) {
      break;
    }
  }
}
async function getPackageType(filePath) {
  var _a;
  const packageJson = await findPackageJson(filePath);
  return (_a = packageJson == null ? void 0 : packageJson.type) != null ? _a : "commonjs";
}

const tsconfig = process.env.TSX_TSCONFIG_PATH ? {
  path: path__default["default"].resolve(process.env.TSX_TSCONFIG_PATH),
  config: getTsconfig.parseTsconfig(process.env.TSX_TSCONFIG_PATH)
} : getTsconfig.getTsconfig();
const fileMatcher = tsconfig && getTsconfig.createFilesMatcher(tsconfig);
const tsconfigPathsMatcher = tsconfig && getTsconfig.createPathsMatcher(tsconfig);
const fileProtocol = "file://";
const tsExtensionsPattern = /\.([cm]?ts|[tj]sx)($|\?)/;
const isJsonPattern = /\.json(?:$|\?)/;
const getFormatFromExtension = (fileUrl) => {
  const extension = path__default["default"].extname(fileUrl);
  if (extension === ".json") {
    return "json";
  }
  if (extension === ".mjs" || extension === ".mts") {
    return "module";
  }
  if (extension === ".cjs" || extension === ".cts") {
    return "commonjs";
  }
};
const getFormatFromFileUrl = (fileUrl) => {
  const format = getFormatFromExtension(fileUrl);
  if (format) {
    return format;
  }
  if (tsExtensionsPattern.test(fileUrl)) {
    return getPackageType(fileUrl);
  }
};

const applySourceMap = sourceMap.installSourceMapSupport();
const isDirectoryPattern = /\/(?:$|\?)/;
let mainThreadPort;
let sendToParent = process.send ? process.send.bind(process) : void 0;
const initialize = async (data) => {
  if (!data) {
    throw new Error("tsx must be loaded with --import instead of --loader\nThe --loader flag was deprecated in Node v20.6.0");
  }
  const { port } = data;
  mainThreadPort = port;
  sendToParent = port.postMessage.bind(port);
};
const globalPreload = ({ port }) => {
  mainThreadPort = port;
  sendToParent = port.postMessage.bind(port);
  return `
	const require = getBuiltin('module').createRequire("${(typeof document === 'undefined' ? new (require('u' + 'rl').URL)('file:' + __filename).href : (document.currentScript && document.currentScript.src || new URL('esm/index.cjs', document.baseURI).href))}");
	require('tsx/source-map').installSourceMapSupport(port);
	if (process.send) {
		port.addListener('message', (message) => {
			if (message.type === 'dependency') {
				process.send(message);
			}
		});
	}
	port.unref(); // Allows process to exit without waiting for port to close
	`;
};
const resolveExplicitPath = async (defaultResolve, specifier, context) => {
  const resolved = await defaultResolve(specifier, context);
  if (!resolved.format && resolved.url.startsWith(fileProtocol)) {
    resolved.format = await getFormatFromFileUrl(resolved.url);
  }
  return resolved;
};
const extensions = [".js", ".json", ".ts", ".tsx", ".jsx"];
async function tryExtensions(specifier, context, defaultResolve) {
  const [specifierWithoutQuery, query] = specifier.split("?");
  let throwError;
  for (const extension of extensions) {
    try {
      return await resolveExplicitPath(
        defaultResolve,
        specifierWithoutQuery + extension + (query ? `?${query}` : ""),
        context
      );
    } catch (_error) {
      if (throwError === void 0 && _error instanceof Error) {
        const { message } = _error;
        _error.message = _error.message.replace(`${extension}'`, "'");
        _error.stack = _error.stack.replace(message, _error.message);
        throwError = _error;
      }
    }
  }
  throw throwError;
}
async function tryDirectory(specifier, context, defaultResolve) {
  const isExplicitDirectory = isDirectoryPattern.test(specifier);
  const appendIndex = isExplicitDirectory ? "index" : "/index";
  const [specifierWithoutQuery, query] = specifier.split("?");
  try {
    return await tryExtensions(
      specifierWithoutQuery + appendIndex + (query ? `?${query}` : ""),
      context,
      defaultResolve
    );
  } catch (_error) {
    if (!isExplicitDirectory) {
      try {
        return await tryExtensions(specifier, context, defaultResolve);
      } catch {
      }
    }
    const error = _error;
    const { message } = error;
    error.message = error.message.replace(`${appendIndex.replace("/", path__default["default"].sep)}'`, "'");
    error.stack = error.stack.replace(message, error.message);
    throw error;
  }
}
const isRelativePathPattern = /^\.{1,2}\//;
const resolve = async function(specifier, context, defaultResolve, recursiveCall) {
  var _a;
  if (isDirectoryPattern.test(specifier)) {
    return await tryDirectory(specifier, context, defaultResolve);
  }
  const isPath = specifier.startsWith(fileProtocol) || isRelativePathPattern.test(specifier);
  if (tsconfigPathsMatcher && !isPath && !((_a = context.parentURL) == null ? void 0 : _a.includes("/node_modules/"))) {
    const possiblePaths = tsconfigPathsMatcher(specifier);
    for (const possiblePath of possiblePaths) {
      try {
        return await resolve(
          url.pathToFileURL(possiblePath).toString(),
          context,
          defaultResolve
        );
      } catch {
      }
    }
  }
  if (
    // !recursiveCall &&
    tsExtensionsPattern.test(context.parentURL)
  ) {
    const tsPaths = resolveTsPath.resolveTsPath(specifier);
    if (tsPaths) {
      for (const tsPath of tsPaths) {
        try {
          return await resolveExplicitPath(defaultResolve, tsPath, context);
        } catch (error) {
          const { code } = error;
          if (code !== "ERR_MODULE_NOT_FOUND" && code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") {
            throw error;
          }
        }
      }
    }
  }
  try {
    return await resolveExplicitPath(defaultResolve, specifier, context);
  } catch (error) {
    if (error instanceof Error && !recursiveCall) {
      const { code } = error;
      if (code === "ERR_UNSUPPORTED_DIR_IMPORT") {
        try {
          return await tryDirectory(specifier, context, defaultResolve);
        } catch (error_) {
          if (error_.code !== "ERR_PACKAGE_IMPORT_NOT_DEFINED") {
            throw error_;
          }
        }
      }
      if (code === "ERR_MODULE_NOT_FOUND") {
        try {
          return await tryExtensions(specifier, context, defaultResolve);
        } catch {
        }
      }
    }
    throw error;
  }
};
const contextAttributesProperty = nodeFeatures.importAttributes ? "importAttributes" : "importAssertions";
const load = async function(url$1, context, defaultLoad) {
  var _a;
  if (sendToParent) {
    sendToParent({
      type: "dependency",
      path: url$1
    });
  }
  if (isJsonPattern.test(url$1)) {
    if (!context[contextAttributesProperty]) {
      context[contextAttributesProperty] = {};
    }
    context[contextAttributesProperty].type = "json";
  }
  const loaded = await defaultLoad(url$1, context);
  if (!loaded.source) {
    return loaded;
  }
  const filePath = url$1.startsWith("file://") ? url.fileURLToPath(url$1) : url$1;
  let code = loaded.source.toString();
  if (sourceMap.shouldStripSourceMap) {
    code = sourceMap.stripSourceMap(code);
  }
  if (
    // Support named imports in JSON modules
    loaded.format === "json" || tsExtensionsPattern.test(url$1)
  ) {
    const transformed = await index.transform(
      code,
      filePath,
      {
        tsconfigRaw: (_a = fileMatcher) == null ? void 0 : _a(filePath)
      }
    );
    return {
      format: "module",
      source: applySourceMap(transformed, url$1, mainThreadPort)
    };
  }
  if (loaded.format === "module") {
    const dynamicImportTransformed = index.transformDynamicImport(filePath, code);
    if (dynamicImportTransformed) {
      loaded.source = applySourceMap(
        dynamicImportTransformed,
        url$1,
        mainThreadPort
      );
    }
  }
  return loaded;
};

if (nodeFeatures.supportsModuleRegister && worker_threads.isMainThread) {
  registerLoader();
}

exports.globalPreload = globalPreload;
exports.initialize = initialize;
exports.load = load;
exports.resolve = resolve;
