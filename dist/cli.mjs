#!/usr/bin/env node
import { command, cli } from 'cleye';
import { v as version } from './package-d4734a72.mjs';
import { r as require } from './pkgroll_create-require-b579c0bc.mjs';
import { pathToFileURL, fileURLToPath } from 'url';
import spawn from 'cross-spawn';
import { s as supportsModuleRegister } from './node-features-a792cc3d.mjs';
import { constants } from 'os';
import path from 'path';
import { watch } from 'chokidar';
import { typeFlag } from 'type-flag';
import { gray, lightCyan } from 'kolorist';
import 'module';

function run(argv, options) {
  const environment = { ...process.env };
  const stdio = [
    "inherit",
    // stdin
    "inherit",
    // stdout
    "inherit",
    // stderr
    "ipc"
    // parent-child communication
  ];
  if (options) {
    if (options.noCache) {
      environment.TSX_DISABLE_CACHE = "1";
    }
    if (options.tsconfigPath) {
      environment.TSX_TSCONFIG_PATH = options.tsconfigPath;
    }
  }
  return spawn(
    process.execPath,
    [
      "--require",
      require.resolve("./preflight.cjs"),
      supportsModuleRegister ? "--import" : "--loader",
      pathToFileURL(require.resolve("./loader.mjs")).toString(),
      ...argv
    ],
    {
      stdio,
      env: environment
    }
  );
}

const ignoreAfterArgument = (ignoreFirstArgument = true) => {
  let ignore = false;
  return (type) => {
    if (ignore || type === "unknown-flag") {
      return true;
    }
    if (type === "argument") {
      ignore = true;
      return ignoreFirstArgument;
    }
  };
};
function removeArgvFlags(tsxFlags, argv = process.argv.slice(2)) {
  typeFlag(
    tsxFlags,
    argv,
    {
      ignore: ignoreAfterArgument()
    }
  );
  return argv;
}

const currentTime = () => (/* @__PURE__ */ new Date()).toLocaleTimeString();
const log = (...messages) => console.log(
  gray(currentTime()),
  lightCyan("[tsx]"),
  ...messages
);
const clearScreen = "\x1Bc";
function debounce(originalFunction, duration) {
  let timeout;
  return () => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(
      () => originalFunction(),
      duration
    );
  };
}

const killProcess = async (childProcess) => {
  const waitForExit = new Promise((resolve) => {
    childProcess.on("exit", resolve);
  });
  childProcess.kill();
  await waitForExit;
};
const flags = {
  noCache: {
    type: Boolean,
    description: "Disable caching",
    default: false
  },
  tsconfig: {
    type: String,
    description: "Custom tsconfig.json path"
  },
  clearScreen: {
    type: Boolean,
    description: "Clearing the screen on rerun",
    default: true
  },
  ignore: {
    type: [String],
    description: "Paths & globs to exclude from being watched"
  }
};
const watchCommand = command({
  name: "watch",
  parameters: ["<script path>"],
  flags,
  help: {
    description: "Run the script and watch for changes"
  },
  /**
   * ignoreAfterArgument needs to parse the first argument
   * because cleye will error on missing arguments
   *
   * Remove once cleye supports error callbacks on missing arguments
   */
  ignoreArgv: ignoreAfterArgument(false)
}, (argv) => {
  const rawArgvs = removeArgvFlags(flags, process.argv.slice(3));
  const options = {
    noCache: argv.flags.noCache,
    tsconfigPath: argv.flags.tsconfig,
    clearScreen: argv.flags.clearScreen,
    ignore: argv.flags.ignore,
    ipc: true
  };
  let runProcess;
  const spawnProcess = () => {
    const childProcess = run(rawArgvs, options);
    childProcess.on("message", (data) => {
      if (data && typeof data === "object" && "type" in data && data.type === "dependency" && "path" in data && typeof data.path === "string") {
        const dependencyPath = data.path.startsWith("file:") ? fileURLToPath(data.path) : data.path;
        if (path.isAbsolute(dependencyPath)) {
          watcher.add(dependencyPath);
        }
      }
    });
    return childProcess;
  };
  let waitingExits = false;
  const reRun = debounce(async () => {
    if (waitingExits) {
      log("forcing restart");
      runProcess.kill("SIGKILL");
      return;
    }
    if ((runProcess == null ? void 0 : runProcess.exitCode) === null) {
      log("restarting");
      waitingExits = true;
      await killProcess(runProcess);
      waitingExits = false;
    } else {
      log("rerunning");
    }
    if (options.clearScreen) {
      process.stdout.write(clearScreen);
    }
    runProcess = spawnProcess();
  }, 100);
  reRun();
  function exit(signal) {
    process.exit(
      /**
       * https://nodejs.org/api/process.html#exit-codes
       * >128 Signal Exits: If Node.js receives a fatal signal such as SIGKILL or SIGHUP,
       * then its exit code will be 128 plus the value of the signal code. This is a
       * standard POSIX practice, since exit codes are defined to be 7-bit integers, and
       * signal exits set the high-order bit, and then contain the value of the signal
       * code. For example, signal SIGABRT has value 6, so the expected exit code will be
       * 128 + 6, or 134.
       */
      128 + constants.signals[signal]
    );
  }
  function relaySignal(signal) {
    if (runProcess && runProcess.exitCode === null) {
      runProcess.on("close", () => exit(signal));
      runProcess.kill(signal);
    } else {
      exit(signal);
    }
  }
  process.once("SIGINT", relaySignal);
  process.once("SIGTERM", relaySignal);
  const watcher = watch(
    argv._,
    {
      cwd: process.cwd(),
      ignoreInitial: true,
      ignored: [
        // Hidden directories like .git
        "**/.*/**",
        // Hidden files (e.g. logs or temp files)
        "**/.*",
        // 3rd party packages
        "**/{node_modules,bower_components,vendor}/**",
        ...options.ignore
      ],
      ignorePermissionErrors: true
    }
  ).on("all", reRun);
  process.stdin.on("data", reRun);
});

const tsxFlags = {
  noCache: {
    type: Boolean,
    description: "Disable caching"
  },
  tsconfig: {
    type: String,
    description: "Custom tsconfig.json path"
  }
};
cli({
  name: "tsx",
  parameters: ["[script path]"],
  commands: [
    watchCommand
  ],
  flags: {
    ...tsxFlags,
    version: {
      type: Boolean,
      alias: "v",
      description: "Show version"
    },
    help: {
      type: Boolean,
      alias: "h",
      description: "Show help"
    }
  },
  help: false,
  ignoreArgv: ignoreAfterArgument()
}, (argv) => {
  if (argv.flags.version) {
    process.stdout.write(`tsx v${version}
node `);
  } else if (argv.flags.help) {
    argv.showHelp({
      description: "Node.js runtime enhanced with esbuild for loading TypeScript & ESM"
    });
    console.log(`${"-".repeat(45)}
`);
  }
  const childProcess = run(
    removeArgvFlags(tsxFlags),
    {
      noCache: Boolean(argv.flags.noCache),
      tsconfigPath: argv.flags.tsconfig
    }
  );
  const relaySignal = async (signal) => {
    const message = await Promise.race([
      /**
       * If child received a signal, it detected a keypress or
       * was sent a signal via process group.
       *
       * Ignore it and let child handle it.
       */
      new Promise((resolve) => {
        function onKillSignal(data) {
          if (data && data.type === "kill") {
            resolve(data.signal);
            childProcess.off("message", onKillSignal);
          }
        }
        childProcess.on("message", onKillSignal);
      }),
      new Promise((resolve) => {
        setTimeout(resolve, 10);
      })
    ]);
    if (!message) {
      childProcess.kill(signal);
    }
  };
  process.on("SIGINT", relaySignal);
  process.on("SIGTERM", relaySignal);
  childProcess.on(
    "close",
    (code) => process.exit(code)
  );
});
