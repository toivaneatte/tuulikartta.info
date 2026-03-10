/*
SQLite database initialization for favourite station observations.
Creates the database file at DB_PATH (configurable via environment variable),
sets up the schema on first run, and exports a cleanup function for old rows.
*/

const Database = require('better-sqlite3');
const logger = require('./logger');

const DB_PATH = process.env.DB_PATH || '/var/data/favourites.db';

logger.info(`Opening SQLite database at ${DB_PATH}`);
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS favourite_observations (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    fmisid    INTEGER NOT NULL,
    station   TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    lat       REAL,
    lon       REAL,
    ri_10min  REAL,
    ws_10min  REAL,
    wg_10min  REAL,
    wd_10min  REAL,
    vis       REAL,
    wawa      REAL,
    t2m       REAL,
    n_man     REAL,
    r_1h      REAL,
    snow_aws  REAL,
    pressure  REAL,
    rh        REAL,
    dewpoint  REAL,
    UNIQUE(fmisid, timestamp)
  );
  CREATE INDEX IF NOT EXISTS idx_fmisid_timestamp
    ON favourite_observations (fmisid, timestamp);
`);

logger.info('SQLite schema ready');

// Delete observations older than retentionDays. Returns number of deleted rows.
const deleteOldObservations = (retentionDays) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const result = db.prepare(
    `DELETE FROM favourite_observations WHERE timestamp < ?`
  ).run(cutoff.toISOString());
  return result.changes;
};

module.exports = { db, deleteOldObservations };
