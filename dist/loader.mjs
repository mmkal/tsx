import { r as require } from './pkgroll_create-require-862fe310.mjs';
import repl from 'repl';
import { t as transform } from './index-fdd79e29.mjs';
export { globalPreload, initialize, load, resolve } from './esm/index.mjs';
import 'module';
import 'url';
import 'esbuild';
import 'crypto';
import 'magic-string';
import 'es-module-lexer';
import 'es-module-lexer/js';
import 'fs';
import 'path';
import 'os';
import 'worker_threads';
import './node-features-a792cc3d.mjs';
import './source-map.mjs';
import 'source-map-support';
import './resolve-ts-path-a8cb04a4.mjs';
import 'get-tsconfig';

function patchEval(nodeRepl) {
  const { eval: defaultEval } = nodeRepl;
  const preEval = async function(code, context, filename, callback) {
    try {
      const transformed = await transform(
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
const { start } = repl;
repl.start = function() {
  const nodeRepl = Reflect.apply(start, this, arguments);
  patchEval(nodeRepl);
  return nodeRepl;
};

require("./cjs/index.cjs");
