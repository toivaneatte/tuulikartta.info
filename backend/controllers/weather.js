/*
Author: Kasper Kivistö
Description: This file contains the controller for handling weather-related API endpoints. It includes functions for fetching weather station data from the FMI Open Data API, caching it in Redis, and returning it as JSON or XML responses. The controller also includes a function for showing Redis memory usage information.
*/

const weatherRouter = require('express').Router()
const { request } = require('express')
const xml2js = require('xml2js');  // not in use atm

const logger = require('../utils/logger');
const redisClient = require('../utils/redisClient');
const config = require('../config');
const { db } = require('../utils/db');
const { parseFMIMultipointcoverage } = require('../utils/fmiParser');

const xmlParser = new xml2js.Parser(); // not in use atm

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


/*
const fetchNewFMIData = async (url) => {
  logger.info(`Fetching weather data from FMI API with URL: ${url}`);
  const parsedData = await fetch(url)
    .then(r => r.text())
    .then(xmlString => xmlParser.parseStringPromise(xmlString))

  result1 = []; // this has [{ name: 'Helsinki-Vantaa', fmisid: 100971 }]
  // all the weather stations are in this array
  result2 = []; // this has [{ name: 'Helsinki-Vantaa', coordinates: [24.963, 60.317] }]
  const members = parsedData['wfs:FeatureCollection']['wfs:member']

  //Start the iteration of members
  members.forEach(member => {
    // station names and fmisids
    const stations =
      member['omso:GridSeriesObservation'][0]
        ['om:featureOfInterest'][0]
        ['sams:SF_SpatialSamplingFeature'][0]
        ['sam:sampledFeature'][0]
        ['target:LocationCollection'][0]
        ['target:member'];

    stations.forEach(station => {
      const location = station['target:Location'][0];
      const name = location['gml:name'][0]._;
      const fmisid = parseInt(location['gml:identifier'][0]._, 10);
      result1.push({
        name: name,
        fmisid: fmisid
      });
    })

    // station names and coordinates
    const stationLocations =
      member['omso:GridSeriesObservation'][0]
        ['om:featureOfInterest'][0]
        ['sams:SF_SpatialSamplingFeature'][0]
        ['sams:shape'][0]
        ['gml:MultiPoint'][0];
    const pointMembers = stationLocations['gml:pointMember'];

    pointMembers.forEach(station => {
      const point = station['gml:Point'][0];
      //logger.info(`Processing station: ${JSON.stringify(point)}`);

      const name = point['gml:name']?.[0] ?? null;
      const pos = point['gml:pos']?.[0] ?? null;
      //logger.info(`Station name: ${name}, Coordinates: ${pos}`);

      result2.push({
        name: name,
        pos: pos   // e.g. "23.761 61.498"
      });
    });
  })

  // The final array of stations with both fmisid and coordinates
  const final = result1.map((station, index) => ({
    ...station,
    ...result2[index]
  }));

  logger.info(`Fetched and processed ${final.length} weather stations from FMI API.`);
  return final;
}
*/

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
/*
const constructURL = () => {
  // this is the format:
  // starttime=2026-02-07T22:00:00Z&endtime=2026-02-08T14:48:44Z&

  const now = new Date();
  const startTime = new Date(now.getTime());
  startTime.setHours(0, 0, 0, 0); // set to the start of the day (00:00:00)
  const endTime = new Date(now.getTime()); // now

  const startISO = startTime.toISOString();
  const endISO = endTime.toISOString();

  const fullURL = `${config.FMIWeatherURL}starttime=${startISO}&endtime=${endISO}&`;
  return fullURL;
}
*/

const constructURLLatest = () => {
  // this is the format:
  // starttime=2026-02-07T22:00:00Z&endtime=2026-02-08T14:48:44Z&

  const now = new Date();
  const startTime = new Date(now.getTime() - 15 * 60 * 1000); // now - 15 minutes
  const endTime = new Date(now.getTime() + 10 * 60 * 1000);

  const startISO = startTime.toISOString();
  const endISO = endTime.toISOString();

  //const fullURL = `${config.FMIWeatherURL}starttime=${startISO}&endtime=${endISO}&`;
  const fullURL = `${config.FMIWeatherURL}starttime=${startISO}&`;
  return fullURL;
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
  const url = constructURLLatest();
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
// GET /api/weather/xml endpoint for fetching weather station data from FMI API and returning it as XML (depricated - fix later)
// ---------------------------------------------------------
weatherRouter.get('/xml', async (req, res) => {
  let cached = null;

  if (redisClient.isOpen) {
    // check cache first 
    try { cached = await redisClient.get('weather:xml');} 
    catch (err) { logger.error(`Error accessing Redis cache: ${err.message}`);}
  } 
  else {
    logger.error('Redis client is not connected, skipping cache');
  }

  if (cached) {
    logger.info('Returning cached weather station data');
    redisMemoryInfo(); // get info about Redis memory usage
    return res.send(cached);
  }

  // continue fetching if not in cache
  logger.info('No cached data found, fetching from FMI API');
  const url = constructURL();
  logger.info(`Constructed URL for fetching weather data: ${url}`);
  const xmlData = await fetch(url)
    .then(r => r.text())
    .catch(err => {
      logger.error(`Error fetching weather data from FMI API: ${err.message}`);
    });

  if (!redisClient.isOpen) {
    logger.error('Redis client is not connected, skipping cache');
  } 
  else {
    // cache the data in Redis for 30 minutes
    await redisClient.set(
      'weather:xml',
      xmlData,
      { EX: 1800 }
    );
    logger.info('Cached weather XML data in Redis for 30 minutes');
    redisMemoryInfo(); // get info about Redis memory usage
  } 
  // return xml data as response
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