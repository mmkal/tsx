'use strict';

var pkgroll_createRequire = require('./pkgroll_create-require-bf0ed779.cjs');
var os = require('os');
require('./suppress-warnings.cjs');
require('module');

pkgroll_createRequire.require("./cjs/index.cjs");
if (process.send) {
  let relaySignal = function(signal) {
    process.send({
      type: "kill",
      signal
    });
    if (process.listenerCount(signal) === 0) {
      process.exit(128 + os.constants.signals[signal]);
    }
  };
  const relaySignals = ["SIGINT", "SIGTERM"];
  for (const signal of relaySignals) {
    process.on(signal, relaySignal);
  }
  const { listenerCount } = process;
  process.listenerCount = function(eventName) {
    let count = Reflect.apply(listenerCount, this, arguments);
    if (relaySignals.includes(eventName)) {
      count -= 1;
    }
    return count;
  };
  const { listeners } = process;
  process.listeners = function(eventName) {
    const result = Reflect.apply(listeners, this, arguments);
    if (relaySignals.includes(eventName)) {
      return result.filter((listener) => listener !== relaySignal);
    }
    return result;
  };
}
