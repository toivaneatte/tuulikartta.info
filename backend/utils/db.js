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

  CREATE TABLE IF NOT EXISTS map_observations (
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
  CREATE INDEX IF NOT EXISTS idx_map_timestamp
    ON map_observations (timestamp);
`);

logger.info('SQLite schema ready');

// Add daily aggregate columns to map_observations if they don't exist yet
const dailyColumns = ['wg_1d', 'ws_1d', 'tmax', 'tmin', 'rr_1d', 'wg_max_dir', 'ws_max_dir'];
for (const col of dailyColumns) {
  try {
    db.exec(`ALTER TABLE map_observations ADD COLUMN ${col} REAL`);
  } catch (e) {
    // Column already exists, ignore
  }
}

// Delete observations older than retentionDays. Returns number of deleted rows.
const deleteOldObservations = (retentionDays) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const result = db.prepare(
    `DELETE FROM favourite_observations WHERE timestamp < ?`
  ).run(cutoff.toISOString());
  return result.changes;
};

const insertMapObs = db.prepare(`
  INSERT INTO map_observations
    (fmisid, station, timestamp, lat, lon,
     ri_10min, ws_10min, wg_10min, wd_10min, vis, wawa,
     t2m, n_man, r_1h, snow_aws, pressure, rh, dewpoint)
  VALUES
    (@fmisid, @station, @timestamp, @lat, @lon,
     @ri_10min, @ws_10min, @wg_10min, @wd_10min, @vis, @wawa,
     @t2m, @n_man, @r_1h, @snow_aws, @pressure, @rh, @dewpoint)
  ON CONFLICT(fmisid, timestamp) DO NOTHING
`);

const insertMapObsMany = db.transaction((rows) => {
  for (const row of rows) insertMapObs.run(row);
});

// Returns the most recent timestamp present in map_observations
const getLatestMapTimestamp = db.prepare(`
  SELECT timestamp FROM map_observations ORDER BY timestamp DESC LIMIT 1
`);

// Returns the closest distinct timestamp to the given ISO string
const getClosestMapTimestamp = db.prepare(`
  SELECT timestamp FROM map_observations
  ORDER BY ABS(strftime('%s', timestamp) - strftime('%s', ?))
  LIMIT 1
`);

// Returns all station rows for a given exact timestamp
const getMapObsByTimestamp = db.prepare(`
  SELECT * FROM map_observations WHERE timestamp = ?
`);

// Returns the latest observation per fmisid from favourite_observations
const getLatestFavouritePerStation = db.prepare(`
  SELECT * FROM favourite_observations
  WHERE (fmisid, timestamp) IN (
    SELECT fmisid, MAX(timestamp) FROM favourite_observations GROUP BY fmisid
  )
`);

// Returns the closest observation per fmisid to a given ISO timestamp
const getClosestFavouritePerStation = db.prepare(`
  SELECT fo.* FROM favourite_observations fo
  WHERE fo.timestamp = (
    SELECT timestamp FROM favourite_observations
    WHERE fmisid = fo.fmisid
    ORDER BY ABS(strftime('%s', timestamp) - strftime('%s', ?))
    LIMIT 1
  )
`);

// Updates daily aggregate columns for a specific fmisid + timestamp row
const updateMapObsDailyValues = db.prepare(`
  UPDATE map_observations
  SET wg_1d=@wg_1d, ws_1d=@ws_1d, tmax=@tmax, tmin=@tmin, rr_1d=@rr_1d,
      wg_max_dir=@wg_max_dir, ws_max_dir=@ws_max_dir
  WHERE fmisid=@fmisid AND timestamp=@timestamp
`);

// Delete map_observations older than retentionMinutes
const deleteOldMapObservations = (retentionMinutes) => {
  const cutoff = new Date(Date.now() - retentionMinutes * 60 * 1000);
  const result = db.prepare(
    `DELETE FROM map_observations WHERE timestamp < ?`
  ).run(cutoff.toISOString());
  return result.changes;
};

module.exports = {
  db,
  deleteOldObservations,
  insertMapObsMany,
  getLatestMapTimestamp,
  getClosestMapTimestamp,
  getMapObsByTimestamp,
  deleteOldMapObservations,
  updateMapObsDailyValues,
  getLatestFavouritePerStation,
  getClosestFavouritePerStation,
};
