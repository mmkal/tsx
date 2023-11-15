'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var pkgroll_createRequire = require('./pkgroll_create-require-eb0c4352.cjs');
var repl = require('repl');
var index$1 = require('./index-6a8696ce.cjs');
var index = require('./esm/index.cjs');
require('module');
require('url');
require('esbuild');
require('crypto');
require('fs');
require('path');
require('os');
require('worker_threads');
require('./node-features-84a305a1.cjs');
require('./source-map.cjs');
require('source-map-support');
require('./resolve-ts-path-43f50656.cjs');
require('get-tsconfig');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var repl__default = /*#__PURE__*/_interopDefaultLegacy(repl);

function patchEval(nodeRepl) {
  const { eval: defaultEval } = nodeRepl;
  const preEval = async function(code, context, filename, callback) {
    try {
      const transformed = await index$1.transform(
        code,
        filename,
        {
          loader: "ts",
          tsconfigRaw: {
            compilerOptions: {
              preserveValueImports: true
            }
          },
          define: {
            require: "global.require"
          }
        }
      );
      code = transformed.code;
    } catch {
    }
    return defaultEval.call(this, code, context, filename, callback);
  };
  nodeRepl.eval = preEval;
}
const { start } = repl__default["default"];
repl__default["default"].start = function() {
  const nodeRepl = Reflect.apply(start, this, arguments);
  patchEval(nodeRepl);
  return nodeRepl;
};

pkgroll_createRequire.require("./cjs/index.cjs");

exports.globalPreload = index.globalPreload;
exports.initialize = index.initialize;
exports.load = index.load;
exports.resolve = index.resolve;
