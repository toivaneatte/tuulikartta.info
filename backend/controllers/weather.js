/*
Author: Kasper Kivistö
Description: This file contains the controller for handling weather-related API endpoints. It includes functions for fetching weather station data from the FMI Open Data API, caching it in Redis, and returning it as JSON or XML responses. The controller also includes a function for showing Redis memory usage information.
*/

const weatherRouter = require('express').Router()
const { request } = require('express')

const logger = require('../utils/logger');
const redisClient = require('../utils/redisClient');
const config = require('../config');
const { db } = require('../utils/db');
const { parseFMIMultipointcoverage } = require('../utils/fmiParser');


/* The new URL for fetching weather data from FMI Open Data API:
http://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::forecast::harmonie::surface::point::multipointcoverage&place=helsinki&
*/

/* Test URL 
http://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::multipointcoverage&place=helsinki&
*/

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
// GET /api/weather endpoint for fetching weather station data from FMI API and returning it as JSON
// ---------------------------------------------------------
weatherRouter.get('/json', async (req, res) => {
  let cached = null; 

  if (redisClient.isOpen) {
    try { cached = await redisClient.get('weather:json');}
    catch (err) { logger.error(`Error accessing Redis cache: ${err.message}`);}
  } else {
    logger.error('Redis client is not connected, skipping cache');
  }

  if (cached) {
    logger.info('Returning cached weather station data');
    return res.send(JSON.parse(cached));
  }


  // get data from FMI API
  const url = constructURL();
  const stations = await fetchNewFMIData(url);

  // cache the data in Redis for 30 minutes
  if (!redisClient.isOpen) {
    logger.error('Redis client is not connected, skipping cache');
  } else {
    try {
      await redisClient.set(
        'weather:json',
        JSON.stringify(stations),
        { EX: 1800 }
      );
      logger.info('Cached weather station data in Redis for 30 minutes');
    } catch (err) {
      logger.error(`Error caching data in Redis: ${err.message}`);
    }
  }
  // return that data
  res.send(stations);
})

// ---------------------------------------------------------
// Classify a timestamp as 'current' (≤30 min ago), 'historical' (>30 min ago),
// or 'future'
// ---------------------------------------------------------
const CURRENT_WINDOW_MS = 30 * 60 * 1000;

const classifyTime = (timestamp) => {
  if (!timestamp || timestamp === 'now') return 'current';
  const ts = new Date(timestamp);
  if (isNaN(ts.getTime())) return 'current'; // unparseable, treat as current
  const diffMs = Date.now() - ts.getTime();
  logger.info(`Timestamp: ${timestamp}, age: ${(diffMs / 60000)} min`);
  if (diffMs < 0) return 'future';
  if (diffMs <= CURRENT_WINDOW_MS) return 'current';
  return 'historical';
};

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
// GET /api/weather/favourites/:fmisid - returns parsed observations from SQLite
// Optional query param: ?time=2026-02-25T14:30:00Z
// Without time: returns the most recent observation for the station
// With time: returns the observation closest to the given timestamp
// ---------------------------------------------------------
weatherRouter.get('/favourites/:fmisid', (req, res) => {
  const fmisid = parseInt(req.params.fmisid, 10);
  if (isNaN(fmisid)) {
    return res.status(400).send({ error: 'Invalid fmisid' });
  }

  const time = req.query.time;
  let row;

  try {
    if (time) {
      row = db.prepare(`
        SELECT * FROM favourite_observations
        WHERE fmisid = ?
        ORDER BY ABS(strftime('%s', timestamp) - strftime('%s', ?))
        LIMIT 1
      `).get(fmisid, time);
    } else {
      row = db.prepare(`
        SELECT * FROM favourite_observations
        WHERE fmisid = ?
        ORDER BY timestamp DESC
        LIMIT 1
      `).get(fmisid);
    }
  } catch (err) {
    logger.error(`Error querying SQLite for fmisid ${fmisid}: ${err.message}`);
    return res.status(500).send({ error: 'Internal error' });
  }

  if (!row) {
    return res.status(404).send({ error: 'No data found for this station' });
  }

  logger.info(`Returning favourite observation for fmisid ${fmisid}`);
  res.send(row);
})

// ---------------------------------------------------------
// Other endpoints return 404 Not Found
// ---------------------------------------------------------
weatherRouter.get('/', (req, res) => {
  return res.status(404).send({ error: 'Not found' });
})

module.exports = weatherRouter