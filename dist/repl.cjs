'use strict';

var repl = require('repl');
var _package = require('./package-eab616d0.cjs');
var index = require('./index-6a8696ce.cjs');
require('url');
require('esbuild');
require('crypto');
require('fs');
require('path');
require('os');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var repl__default = /*#__PURE__*/_interopDefaultLegacy(repl);

console.log(
  `Welcome to tsx v${_package.version} (Node.js ${process.version}).
Type ".help" for more information.`
);
const nodeRepl = repl__default["default"].start();
const { eval: defaultEval } = nodeRepl;
const preEval = async function(code, context, filename, callback) {
  const transformed = await index.transform(
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
  ).catch(
    (error) => {
      console.log(error.message);
      return { code: "\n" };
    }
  );
  return defaultEval.call(this, transformed.code, context, filename, callback);
};
nodeRepl.eval = preEval;
