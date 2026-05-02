/*
Author: Kasper Kivistö
Description: Simple logger utility for the backend. Currently just wraps console.log and console.error, but can be extended in the future for more advanced logging features (e.g. log levels, file logging, etc.). The debug function only logs if debugMode is true in config.js.
*/

const config = require('../config');
const DEBUG = config.debugMode;

const info = (...params) => {
  console.log(...params);
};

const error = (...params) => {
  console.error(...params);
};

const debug = (...params) => {
  if (DEBUG) {
    console.debug(...params);
  }
};

module.exports = {
  info,
  error,
  debug,
};
