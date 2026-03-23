/*
Author: Kasper Kivistö
Description: This file contains the controller for handling weather-related API endpoints. It includes functions for fetching weather station data from the FMI Open Data API, caching it in Redis, and returning it as JSON or XML responses. The controller also includes a function for showing Redis memory usage information.
*/

const weatherRouter = require('express').Router()
const { request } = require('express')

const logger = require('../utils/logger');
const redisClient = require('../utils/redisClient');
const config = require('../config');
const { db, insertMapObsMany, getLatestMapTimestamp, getClosestMapTimestamp, getMapObsByTimestamp, deleteOldMapObservations, getLatestFavouritePerStation, getClosestFavouritePerStation } = require('../utils/db');
const { parseFMIMultipointcoverage } = require('../utils/fmiParser');
const { fetchDailyAggregates } = require('../utils/dailyValuesFetcher');

// ---------------------------------------------------------
// Functions for fetching and processing weather data from FMI API
// ---------------------------------------------------------
const fetchNewFMIData = async (url) => {
  logger.info(`Fetching weather data from FMI API with URL: ${url}`);
  const xml = await fetch(url).then(r => r.text());
  const observations = await parseFMIMultipointcoverage(xml, config.favouriteParameters);
  logger.info(`Fetched and processed ${observations.length} observations from FMI API.`);
  return observations;
}


// ---------------------------------------------------------
// Functions for showing Redis memory info
// ---------------------------------------------------------
const redisMemoryInfo = async () => {
  try {
    const info = await redisClient.info('memory');

    const used = info.match(/used_memory_human:(.*)/)[1].trim();
    const max = info.match(/maxmemory_human:(.*)/)[1].trim();

    console.log('Used:', used);
    console.log('Max:', max);
  } catch (err) {
    logger.error(`Error fetching Redis memory info: ${err.message}`);
  }
}


// ---------------------------------------------------------
// Function for URL time construction
// ---------------------------------------------------------
// Params:
//   timestamp  – ISO string or 'now' used for start-of-day window
//   fmisid     – when set, uses FMISingleStationURL
//   starttime  – explicit ISO window start (graph requests, forwarded from PHP setTime)
//   endtime    – explicit ISO window end   (graph requests, forwarded from PHP setTime)
//   parameters – comma-separated FMI parameter list; overrides the hardcoded one in the base URL

// When starttime+endtime are supplied they take priority over the timestamp logic
const constructURL = (timestamp = null, { fmisid, starttime, endtime, parameters } = {}) => {
  let baseURL = fmisid ? config.FMISingleStationURL : config.FMIWeatherURL;

  // Replace the hardcoded parameter list in the base URL
  if (parameters) {
    baseURL = baseURL.replace(/parameters=[^&]+/, `parameters=${parameters}`);
  }

  // Graph requests: PHP already computed the correct 24-h window via setTime().
  if (starttime && endtime) {
    let url = `${baseURL}starttime=${starttime}&endtime=${endtime}&`;
    if (fmisid) url += `fmisid=${fmisid}&`;
    return url;
  }

  let startTime, endTime;
  if (timestamp && timestamp !== 'now') {
    endTime = new Date(timestamp);
    startTime = new Date(endTime);
    startTime.setUTCHours(0, 0, 0, 0); // set to the start of UTC day
  } else {
    const now = new Date();
    endTime = now;
    startTime = new Date(now);
    startTime.setHours(0, 0, 0, 0); // set to the start of today (local time)
  }

  let url = `${baseURL}starttime=${startTime.toISOString()}&endtime=${endTime.toISOString()}&`;
  if (fmisid) url += `fmisid=${fmisid}&`;
  return url;
}



// ---------------------------------------------------------
// Classify a timestamp as 'current' (≤30 min ago), 'historical' (>30 min ago),
// or 'future'. Used by /xml endpoint.
// ---------------------------------------------------------
const CURRENT_WINDOW_MS = 30 * 60 * 1000;

const classifyTime = (timestamp) => {
  if (!timestamp || timestamp === 'now') return 'current';
  const ts = new Date(timestamp);
  if (isNaN(ts.getTime())) return 'current';
  const diffMs = Date.now() - ts.getTime();
  logger.info(`Timestamp: ${timestamp}, age: ${(diffMs / 60000)} min`);
  if (diffMs < 0) return 'future';
  if (diffMs <= CURRENT_WINDOW_MS) return 'current';
  return 'historical';
};


// ---------------------------------------------------------
// Converts a raw observation object from FMI parser or SQLite row to the
// station response format with epochtime, dewpoint difference and type fields.
// ---------------------------------------------------------
const obsToStation = (obs) => {
  const epochtime = Math.floor(new Date(obs.timestamp).getTime() / 1000);
  const t2mdewpoint = (obs.t2m !== null && obs.dewpoint !== null)
    ? parseFloat((obs.t2m - obs.dewpoint).toFixed(2))
    : null;
  return {
    fmisid:      obs.fmisid,
    station:     obs.station,
    lat:         obs.lat,
    lon:         obs.lon,
    time:        obs.timestamp,
    epochtime,
    type:        'synop',
    ri_10min:    obs.ri_10min,
    ws_10min:    obs.ws_10min,
    wg_10min:    obs.wg_10min,
    wd_10min:    obs.wd_10min,
    vis:         obs.vis,
    wawa:        obs.wawa,
    t2m:         obs.t2m,
    n_man:       obs.n_man,
    r_1h:        obs.r_1h,
    snow_aws:    obs.snow_aws,
    pressure:    obs.pressure,
    rh:          obs.rh,
    dewpoint:    obs.dewpoint,
    t2mdewpoint,
    wg_1d:       obs.wg_1d  ?? null,
    ws_1d:       obs.ws_1d  ?? null,
    tmax:        obs.tmax   ?? null,
    tmin:        obs.tmin   ?? null,
    rr_1d:       obs.rr_1d  ?? null,
  };
};

// ---------------------------------------------------------
// Compute the latest observation per station from a list of observations.
// Used for /latest endpoint when fetching a one off request with a timestamp from FMI API.
// ---------------------------------------------------------
const computeLatestPerStation = (observations) => {
  const byStation = {};
  observations.forEach(obs => {
    if (!byStation[obs.fmisid] || obs.timestamp > byStation[obs.fmisid].timestamp) {
      byStation[obs.fmisid] = obs;
    }
  });
  return Object.values(byStation).map(obsToStation);
};


// ---------------------------------------------------------
// GET /api/weather/latest
// optional query param: ?time=2026-02-25T14:30:00Z
// example: /api/weather/latest?time=2026-03-10T14:30:00Z
//
// can be called with or without timestamp
// with timestamp: returns the observation closest to that time (from SQLite if within 5 min, else from FMI API)
// without timestamp: returns the latest observation for each station (from SQLite if data is fresh enough, else from FMI API)
// ---------------------------------------------------------
weatherRouter.get('/latest', async (req, res) => {
  const timestamp = req.query.time;

  if (timestamp && timestamp !== 'now' && new Date(timestamp) > new Date()) {
    logger.info(`Rejected future timestamp: ${timestamp}`);
    return res.status(400).send({ error: 'No data available for future timestamps' });
  }


  // When time param is given:


  // time given: SQLite if close enough, else FMI API
  if (timestamp && timestamp !== 'now') {
    const closest = getClosestMapTimestamp.get(timestamp);
    const diffMs = closest
      ? Math.abs(new Date(timestamp).getTime() - new Date(closest.timestamp).getTime())
      : Infinity;

    if (closest && diffMs <= 5 * 60 * 1000) {
      const rows = getMapObsByTimestamp.all(closest.timestamp);
      logger.info(`SQLite hit for time=${timestamp}, snapshot at ${closest.timestamp} (diff: ${Math.round(diffMs / 60000)} min, ${rows.length} stations)`);
      return res.send(rows.map(obsToStation));
    }

    // Not in SQLite, fetch the observations for the requested timestamp from FMI API.
    // Is not stored in sql since this is a historical request.
    logger.info(`No SQLite data within 5 min of ${timestamp}, fetching from FMI API`);
    const endTime = new Date(timestamp);
    const startTime = new Date(endTime.getTime() - 10 * 60 * 1000);
    const url = `${config.FMIWeatherURL}starttime=${startTime.toISOString()}&endtime=${endTime.toISOString()}&`;
    let observations;
    try {
      observations = await fetchNewFMIData(url);
    } catch (err) {
      logger.error(`Error fetching from FMI API: ${err.message}`);
      return res.status(502).send({ error: 'Failed to fetch data from FMI API' });
    }
    const dailyValues = await fetchDailyAggregates(timestamp);
    const dailyByFmisid = {};
    if (dailyValues) {
      for (const d of dailyValues) dailyByFmisid[d.fmisid] = d;
    }
    const obsWithDaily = observations.map(obs => ({ ...obs, ...dailyByFmisid[obs.fmisid] }));
    return res.send(computeLatestPerStation(obsWithDaily));
  }


  // No time param given, or it is "now":

  // For delaying the fetch from fmi, so all stations have updated their observations, before the fetch.
  const fetchDelayMinutes = 2;

  // Return SQLite data if latest observation is fresh enough
  const latestRow = getLatestMapTimestamp.get();
  if (latestRow) {
    const dataAgeMs = Date.now() - new Date(latestRow.timestamp).getTime();
    if (dataAgeMs < (config.currentDataMaxAgeMinutes + fetchDelayMinutes) * 60 * 1000) {
      const rows = getMapObsByTimestamp.all(latestRow.timestamp);
      logger.info(`SQLite data fresh (age: ${Math.round(dataAgeMs / 1000)}s), returning ${rows.length} stations`);
      return res.send(rows.map(obsToStation));
    }
  }

  // no time, or time is "now", but it is not fresh enough.
  // Fetch from FMI, store all rows.  Return the latest observations per station.

  const now = new Date();
  const endTime = new Date(now.getTime() - fetchDelayMinutes * 60 * 1000);
  const startTime = new Date(endTime.getTime() - config.mapObservationsWindowMinutes * 60 * 1000);
  const url = `${config.FMIWeatherURL}starttime=${startTime.toISOString()}&endtime=${endTime.toISOString()}&`;
  logger.info(`Fetching /latest from FMI API (last ${config.mapObservationsWindowMinutes} min)`);

  let observations;
  try {
    observations = await fetchNewFMIData(url);
  } catch (err) {
    logger.error(`Error fetching /latest from FMI API: ${err.message}`);
    return res.status(502).send({ error: 'Failed to fetch data from FMI API' });
  }

  try {
    insertMapObsMany(observations);
    logger.info(`Stored ${observations.length} observations in map_observations`);
    const deleted = deleteOldMapObservations(config.mapObservationsWindowMinutes);
    if (deleted > 0) logger.info(`Deleted ${deleted} old map_observations rows`);
  } catch (err) {
    logger.error(`Error storing map_observations: ${err.message}`);
  }

  await fetchDailyAggregates(null);
  const freshRow = getLatestMapTimestamp.get();
  const rows = getMapObsByTimestamp.all(freshRow.timestamp);
  res.send(rows.map(obsToStation));
});



// ---------------------------------------------------------
// GET /api/weather/xml endpoint for fetching weather station data from FMI API and returning it as XML (depricated - fix later)
// ---------------------------------------------------------
weatherRouter.get('/xml', async (req, res) => {
  const timestamp = req.query.time || 'now';
  const { fmisid, starttime, endtime, parameters } = req.query;
  const timeType = classifyTime(timestamp);

  // Reject future timestamps, no data exists yet
  if (timeType === 'future') {
    logger.info(`Rejected future timestamp: ${timestamp}`);
    return res.status(400).send({ error: 'No data available for future timestamps' });
  }

  const current = timeType === 'current';

  // Use a per-station cache key when a specific station is requested so that
  // different stations don't overwrite each other's cached data.
  const cacheKey = fmisid ? `weather:xml:${fmisid}` : 'weather:xml';

  // Cache-first for current (≤30 min) requests. Per-station key prevents
  // different stations from colliding. Historical requests always bypass cache.
  const useCache = current;

  if (useCache && redisClient.isOpen) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.info(`Cache found, returning cached XML (key: ${cacheKey})`);
        res.set('Content-Type', 'application/xml');
        return res.send(cached);
      }
    } catch (err) {
      logger.error(`Error accessing Redis cache: ${err.message}`);
    }
  } else if (!redisClient.isOpen) {
    logger.error('Redis client is not connected, skipping cache');
  }

  // Fetch from FMI API
  logger.info(`No cached data found, fetching from FMI API (timestamp: ${timestamp}, fmisid: ${fmisid ?? 'all'})`);
  const url = constructURL(current ? null : timestamp, { fmisid, starttime, endtime, parameters });
  logger.info(`Constructed URL: ${url}`);

  const xmlData = await fetch(url)
    .then(r => r.text())
    .catch(err => {
      logger.error(`Error fetching weather data from FMI API: ${err.message}`);
      return null;
    });

  if (!xmlData) {
    return res.status(502).send({ error: 'Failed to fetch data from FMI API' });
  }

  // Cache current data (per-station key when fmisid is present)
  if (useCache && redisClient.isOpen) {
    try {
      await redisClient.set(cacheKey, xmlData, { EX: 1800 });
      logger.info(`Cached XML in Redis 30 min (key: ${cacheKey})`);
      redisMemoryInfo();
    } catch (err) {
      logger.error(`Error caching data in Redis: ${err.message}`);
    }
  }

  res.set('Content-Type', 'application/xml');
  res.send(xmlData);
})

// ---------------------------------------------------------
// GET /api/weather/favourites - returns latest observation for all favourite stations
// Optional query param: ?time=2026-02-25T14:30:00Z
// Without time: returns the most recent observation per station
// With time: returns the closest observation per station to the given timestamp
// Same format as /latest
// ---------------------------------------------------------
weatherRouter.get('/favourites', (req, res) => {
  const time = req.query.time;
  let rows;

  try {
    // if time is given and it is not "now", return the closest observations to that time, if they are within 5 minutes of the requested time.
    if (time && time !== 'now') {
      const reqMs = new Date(time).getTime();
      rows = getClosestFavouritePerStation.all(time).filter(row =>
        Math.abs(new Date(row.timestamp).getTime() - reqMs) <= 5 * 60 * 1000
      );
    } else {
      // otherwise return the latest observations per station
      rows = getLatestFavouritePerStation.all();
    }
  } catch (err) {
    logger.error(`Error querying favourite_observations: ${err.message}`);
    return res.status(500).send({ error: 'Internal error' });
  }

  if (!rows || rows.length === 0) {
    return res.status(404).send({ error: 'No data found' });
  }

  logger.info(`Returning ${rows.length} favourite station observations`);
  res.send(rows.map(obsToStation));
})

// ---------------------------------------------------------
// Other endpoints return 404 Not Found
// ---------------------------------------------------------
weatherRouter.get('/', (req, res) => {
  return res.status(404).send({ error: 'Not found' });
})

module.exports = weatherRouter