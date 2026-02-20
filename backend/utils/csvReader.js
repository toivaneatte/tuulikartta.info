const fs = require('fs');
const { parse } = require('csv-parse/sync');

const logger = require('./logger');

function readConfig(filename) {
  try {
    logger.info(`Reading configuration from ${filename}`);
    const file = fs.readFileSync(filename, 'utf-8');
    const records = parse(file, {
      columns: true,
      skip_empty_lines: true
    });
    return records;
  } catch (err) {
    logger.error('Error reading config file:', err);
    return [];
  }
}

module.exports = {
  readConfig
};