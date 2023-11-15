import repl from 'repl';
import { v as version } from './package-d4734a72.mjs';
import { t as transform } from './index-626e2e8e.mjs';
import 'url';
import 'esbuild';
import 'crypto';
import 'magic-string';
import 'fs';
import 'path';
import 'os';

console.log(
  `Welcome to tsx v${version} (Node.js ${process.version}).
Type ".help" for more information.`
);
const nodeRepl = repl.start();
const { eval: defaultEval } = nodeRepl;
const preEval = async function(code, context, filename, callback) {
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
  ).catch(
    (error) => {
      console.log(error.message);
      return { code: "\n" };
    }
  );
  return defaultEval.call(this, transformed.code, context, filename, callback);
};
nodeRepl.eval = preEval;
