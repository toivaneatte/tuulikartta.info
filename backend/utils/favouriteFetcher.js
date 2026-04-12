/*
Scheduled fetcher for favourite station weather data.
Fetches XML from FMI API, parses it, and stores observations in SQLite.
Observation data that is too old is deleted on each run.
Fetch interval and observation data retention period are defined and configurable in config.js
as fetchFavouritePeriod and favouriteRetentionDays.
*/

const nodeCron = require('node-cron');
const logger = require('./logger');
const config = require('../config');
const { parseFMIMultipointcoverage } = require('./fmiParser');
const { db, deleteOldObservations } = require('./db');
const { calculateFavouriteDailyAggregates } = require('./favouriteDailyAggregates');

const insertObs = db.prepare(`
  INSERT INTO favourite_observations
    (fmisid, station, timestamp, lat, lon,
     ri_10min, ws_10min, wg_10min, wd_10min, vis, wawa,
     t2m, n_man, r_1h, snow_aws, pressure, rh, dewpoint)
  VALUES
    (@fmisid, @station, @timestamp, @lat, @lon,
     @ri_10min, @ws_10min, @wg_10min, @wd_10min, @vis, @wawa,
     @t2m, @n_man, @r_1h, @snow_aws, @pressure, @rh, @dewpoint)
  ON CONFLICT(fmisid, timestamp) DO UPDATE SET
    ri_10min = COALESCE(excluded.ri_10min,  ri_10min),
    ws_10min = COALESCE(excluded.ws_10min,  ws_10min),
    wg_10min = COALESCE(excluded.wg_10min,  wg_10min),
    wd_10min = COALESCE(excluded.wd_10min,  wd_10min),
    vis      = COALESCE(excluded.vis,       vis),
    wawa     = COALESCE(excluded.wawa,      wawa),
    t2m      = COALESCE(excluded.t2m,       t2m),
    n_man    = COALESCE(excluded.n_man,     n_man),
    r_1h     = COALESCE(excluded.r_1h,      r_1h),
    snow_aws = COALESCE(excluded.snow_aws,  snow_aws),
    pressure = COALESCE(excluded.pressure,  pressure),
    rh       = COALESCE(excluded.rh,        rh),
    dewpoint = COALESCE(excluded.dewpoint,  dewpoint)
`);

const countRows = db.prepare('SELECT COUNT(*) as c FROM favourite_observations');
const countRecentRows = db.prepare(
  `SELECT COUNT(*) as c FROM favourite_observations WHERE timestamp >= @since`
);

const insertMany = db.transaction((rows) => {
  const before = countRows.get().c;
  for (const row of rows) insertObs.run(row);
  const after = countRows.get().c;
  const inserted = after - before;
  return { inserted, updated: rows.length - inserted };
});

// Parse fetch interval in minutes from cron expression (e.g. '*/30 * * * *' -> 30)
const parseCronIntervalMinutes = (cron) => {
  const match = cron.match(/^\*\/(\d+)/);
  return match ? parseInt(match[1], 10) : 10;
};
const fetchIntervalMinutes = parseCronIntervalMinutes(config.fetchFavouritePeriod);
// Fetch window = interval + 2 min overlap, so it updates observations that might have been missed in the previous fetch.
const fetchWindowMinutes = fetchIntervalMinutes + 2;
logger.info(`Fetch interval: ${fetchIntervalMinutes} min, window: ${fetchWindowMinutes} min`);

logger.info('Starting favourite stations weather data fetcher...');
nodeCron.schedule(config.fetchFavouritePeriod, async () => {
  logger.info('Favourite stations data fetcher triggered');

  // If DB has no recent data (e.g. fresh start), backfill 24h; otherwise use normal window
  const since10min = new Date();
  since10min.setMinutes(since10min.getMinutes() - 10);
  const hasRecentData = countRecentRows.get({ since: since10min.toISOString() }).c > 0;
  const initialBackfillHours = Number.isFinite(config.favouriteInitialBackfillHours)
    ? config.favouriteInitialBackfillHours
    : 72;
  const windowMinutes = hasRecentData ? fetchWindowMinutes : initialBackfillHours * 60;
  if (!hasRecentData) logger.info(`No recent data found — fetching ${initialBackfillHours}h backfill`);

  // Build URL with explicit parameters and only enabled stations
  const startTime = new Date();
  startTime.setMinutes(startTime.getMinutes() - windowMinutes);
  const startISO = startTime.toISOString();

  let baseURL = 'http://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature' +
    `&storedquery_id=fmi::observations::weather::multipointcoverage` +
    `&parameters=${config.favouriteParameters}` +
    `&timestep=10` +
    `&starttime=${startISO}&`;

  for (const station of config.favouriteStations) {
    if (station.onOff === 1) {
      baseURL += `fmisid=${station.fmisid}&`;
    }
  }

  // Fetch raw XML from FMI API
  const xml = await fetch(baseURL)
    .then(r => r.text())
    .catch(err => {
      logger.error(`Error in Cron fetching data from FMI API: ${err}`);
      return null;
    });

  if (!xml) {
    logger.error('Favourite stations fetch returned no data, skipping');
    return;
  }

  // Parse XML and store in SQLite
  let observations;
  try {
    observations = await parseFMIMultipointcoverage(xml, config.favouriteParameters);
  } catch (err) {
    logger.error(`Error parsing favourite stations XML: ${err.message}`);
    return;
  }

  try {
    const { inserted, updated } = insertMany(observations);
    logger.info(`Parsed ${observations.length} observations, inserted ${inserted} new, updated ${updated} existing`);
  } catch (err) {
    logger.error(`Error inserting observations into SQLite: ${err.message}`);
    return;
  }

  calculateFavouriteDailyAggregates();

  // Clean up rows older than configured retention period
  const deleted = deleteOldObservations(config.favouriteRetentionDays);
  if (deleted > 0) {
    logger.info(`Deleted ${deleted} old observations from SQLite`);
  }
});
