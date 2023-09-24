'use strict';

var path = require('path');
var url = require('url');
var sourceMap = require('./source-map-16520cf9.cjs');
var index = require('./index-d696346e.cjs');
var getTsconfig = require('get-tsconfig');
var fs = require('fs');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);

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
  const packageJson = await findPackageJson(filePath);
  return packageJson?.type ?? "commonjs";
}

const applySourceMap = sourceMap.installSourceMapSupport();
const tsconfig = process.env.ESBK_TSCONFIG_PATH ? {
  path: path__default["default"].resolve(process.env.ESBK_TSCONFIG_PATH),
  config: getTsconfig.parseTsconfig(process.env.ESBK_TSCONFIG_PATH)
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

const isDirectoryPattern = /\/(?:$|\?)/;
const isolatedLoader = sourceMap.compareNodeVersion([20, 0, 0]) >= 0;
let sendToParent = process.send ? process.send.bind(process) : void 0;
let mainThreadPort;
const _globalPreload = ({ port }) => {
  mainThreadPort = port;
  sendToParent = port.postMessage.bind(port);
  return `
	const require = getBuiltin('module').createRequire("${(typeof document === 'undefined' ? new (require('u' + 'rl').URL)('file:' + __filename).href : (document.currentScript && document.currentScript.src || new URL('loaders-deprecated-37aa27d7.cjs', document.baseURI).href))}");
	require('update-plz').installSourceMapSupport(port);
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
const globalPreload = isolatedLoader ? _globalPreload : void 0;
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
const supportsNodePrefix = sourceMap.compareNodeVersion([14, 13, 1]) >= 0 || sourceMap.compareNodeVersion([12, 20, 0]) >= 0;
const resolve = async function(specifier, context, defaultResolve, recursiveCall) {
  if (!supportsNodePrefix && specifier.startsWith("node:")) {
    specifier = specifier.slice(5);
  }
  if (isDirectoryPattern.test(specifier)) {
    return await tryDirectory(specifier, context, defaultResolve);
  }
  const isPath = specifier.startsWith(fileProtocol) || isRelativePathPattern.test(specifier);
  if (tsconfigPathsMatcher && !isPath && !context.parentURL?.includes("/node_modules/")) {
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
    const tsPaths = sourceMap.resolveTsPath(specifier);
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
const load = async function(url$1, context, defaultLoad) {
  if (sendToParent) {
    sendToParent({
      type: "dependency",
      path: url$1
    });
  }
  if (isJsonPattern.test(url$1)) {
    if (!context.importAssertions) {
      context.importAssertions = {};
    }
    context.importAssertions.type = "json";
  }
  const loaded = await defaultLoad(url$1, context);
  if (!loaded.source) {
    return loaded;
  }
  const filePath = url$1.startsWith("file://") ? url.fileURLToPath(url$1) : url$1;
  const code = loaded.source.toString();
  if (
    // Support named imports in JSON modules
    loaded.format === "json" || tsExtensionsPattern.test(url$1)
  ) {
    const transformed = await index.transform(
      code,
      filePath,
      {
        tsconfigRaw: fileMatcher?.(filePath)
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

const _getFormat = async function(url, context, defaultGetFormat) {
  if (isJsonPattern.test(url)) {
    return { format: "module" };
  }
  try {
    return await defaultGetFormat(url, context, defaultGetFormat);
  } catch (error) {
    if (error.code === "ERR_UNKNOWN_FILE_EXTENSION" && url.startsWith(fileProtocol)) {
      const format = await getFormatFromFileUrl(url);
      if (format) {
        return { format };
      }
    }
    throw error;
  }
};
const _transformSource = async function(source, context, defaultTransformSource) {
  const { url: url$1 } = context;
  const filePath = url$1.startsWith("file://") ? url.fileURLToPath(url$1) : url$1;
  if (process.send) {
    process.send({
      type: "dependency",
      path: url$1
    });
  }
  if (isJsonPattern.test(url$1) || tsExtensionsPattern.test(url$1)) {
    const transformed = await index.transform(
      source.toString(),
      filePath,
      {
        tsconfigRaw: fileMatcher?.(filePath)
      }
    );
    return {
      source: applySourceMap(transformed, url$1)
    };
  }
  const result = await defaultTransformSource(source, context, defaultTransformSource);
  if (context.format === "module") {
    const dynamicImportTransformed = index.transformDynamicImport(filePath, result.source.toString());
    if (dynamicImportTransformed) {
      result.source = applySourceMap(
        dynamicImportTransformed,
        url$1
      );
    }
  }
  return result;
};
const nodeSupportsDeprecatedLoaders = sourceMap.compareNodeVersion([16, 12, 0]) < 0;
const getFormat = nodeSupportsDeprecatedLoaders ? _getFormat : void 0;
const transformSource = nodeSupportsDeprecatedLoaders ? _transformSource : void 0;

exports.getFormat = getFormat;
exports.globalPreload = globalPreload;
exports.load = load;
exports.resolve = resolve;
exports.transformSource = transformSource;
