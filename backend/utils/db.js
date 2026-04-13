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

// Add daily aggregate columns to map_observations and favourite_observations if they don't exist yet
const dailyColumns = ['wg_1d', 'ws_1d', 'tmax', 'tmin', 'rr_1d', 'wg_max_dir', 'ws_max_dir'];
for (const col of dailyColumns) {
  try { db.exec(`ALTER TABLE map_observations ADD COLUMN ${col} REAL`); } catch (e) {}
  try { db.exec(`ALTER TABLE favourite_observations ADD COLUMN ${col} REAL`); } catch (e) {}
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
  ORDER BY ABS(julianday(SUBSTR(timestamp, 1, 19)) - julianday(SUBSTR(?, 1, 19)))
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

// Returns the second most recent distinct timestamp from favourite_observations
const getSecondLatestFavouriteTimestamp = db.prepare(`
  SELECT DISTINCT timestamp FROM favourite_observations
  ORDER BY timestamp DESC
  LIMIT 1 OFFSET 1
`);

// Returns all favourite observations for a given exact timestamp
const getFavouriteObsByTimestamp = db.prepare(`
  SELECT * FROM favourite_observations WHERE timestamp = ?
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

// Returns favourite observations for a single station in a time range (inclusive)
const getFavouriteObsRangeByStation = db.prepare(`
  SELECT * FROM favourite_observations
  WHERE fmisid = ? AND timestamp >= ? AND timestamp <= ?
  ORDER BY timestamp ASC
`);

// Updates daily aggregate columns for a specific fmisid + timestamp row
const updateMapObsDailyValues = db.prepare(`
  UPDATE map_observations
  SET wg_1d=@wg_1d, ws_1d=@ws_1d, tmax=@tmax, tmin=@tmin, rr_1d=@rr_1d,
      wg_max_dir=@wg_max_dir, ws_max_dir=@ws_max_dir
  WHERE fmisid=@fmisid AND timestamp=@timestamp
`);

// Updates daily aggregate columns for a specific fmisid + timestamp in favourite_observations
const updateFavouriteDailyValues = db.prepare(`
  UPDATE favourite_observations
  SET wg_1d=@wg_1d, ws_1d=@ws_1d, tmax=@tmax, tmin=@tmin, rr_1d=@rr_1d,
      wg_max_dir=@wg_max_dir, ws_max_dir=@ws_max_dir
  WHERE fmisid=@fmisid AND timestamp=@timestamp
`);

// Returns all favourite_observations rows from the given timestamp onwards, ordered for aggregate calc
const getFavouriteObsSince = db.prepare(`
  SELECT * FROM favourite_observations WHERE timestamp >= ? ORDER BY fmisid ASC, timestamp ASC
`);

// Most recent non-null r_1h per station in map_observations (no timestamp filter, for current data)
const getLatestR1hMapObs = db.prepare(`
  SELECT fmisid, r_1h FROM map_observations
  WHERE (fmisid, timestamp) IN (
    SELECT fmisid, MAX(timestamp) FROM map_observations
    WHERE r_1h IS NOT NULL
    GROUP BY fmisid
  )
`);

// Most recent non-null r_1h per station in favourite_observations at or before a given timestamp
const getLatestR1hFavObs = db.prepare(`
  SELECT fmisid, r_1h FROM favourite_observations
  WHERE (fmisid, timestamp) IN (
    SELECT fmisid, MAX(timestamp) FROM favourite_observations
    WHERE r_1h IS NOT NULL AND timestamp <= ?
    GROUP BY fmisid
  )
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
  getSecondLatestFavouriteTimestamp,
  getFavouriteObsByTimestamp,
  getClosestFavouritePerStation,
  getFavouriteObsRangeByStation,
  updateFavouriteDailyValues,
  getFavouriteObsSince,
  getLatestR1hMapObs,
  getLatestR1hFavObs,
};
