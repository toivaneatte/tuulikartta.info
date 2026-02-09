const fs = require('fs');
const { parse } = require('csv-parse/sync');

const logger = require('./logger');

function readConfig() {
  try {
    const file = fs.readFileSync('config.csv', 'utf-8');
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