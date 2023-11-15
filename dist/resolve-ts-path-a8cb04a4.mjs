import path from 'path';

const tsExtensions = /* @__PURE__ */ Object.create(null);
tsExtensions[".js"] = [".ts", ".tsx", ".js", ".jsx"];
tsExtensions[".jsx"] = [".tsx", ".ts", ".jsx", ".js"];
tsExtensions[".cjs"] = [".cts"];
tsExtensions[".mjs"] = [".mts"];
const resolveTsPath = (filePath) => {
  const extension = path.extname(filePath);
  const [extensionNoQuery, query] = path.extname(filePath).split("?");
  const possibleExtensions = tsExtensions[extensionNoQuery];
  if (possibleExtensions) {
    const extensionlessPath = filePath.slice(0, -extension.length);
    return possibleExtensions.map(
      (tsExtension) => extensionlessPath + tsExtension + (query ? `?${query}` : "")
    );
  }
};

export { resolveTsPath as r };
