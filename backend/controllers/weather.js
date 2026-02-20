const weatherRouter = require('express').Router()
const { request } = require('express')
const xml2js = require('xml2js');

const logger = require('../utils/logger');
const redisClient = require('../utils/redisClient');
const config = require('../config');

const xmlParser = new xml2js.Parser();

/* URL for fetching weather data from FMI Open Data API in Tuulikartta.info:*/

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
// GET /api/weather endpoint for fetching weather station data from FMI API and returning it as JSON
// ---------------------------------------------------------
weatherRouter.get('/json', async (req, res) => {
  const cached = await redisClient.get('weather:stations'); // Check Redis cache first

  if (cached) {
    logger.info('Returning cached weather station data');
    return res.send(JSON.parse(cached));
  }

  const url = 'http://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::multipointcoverage&place=tampere&place=helsinki&'
  
  // get data from FMI API
  const stations = await fetchNewFMIData(url);

  // cache the data in Redis for 30 minutes
  await redisClient.set(
    'weather:stations',
    JSON.stringify(stations),
    { EX: 1800 }
  );
  logger.info('Cached weather station data in Redis for 30 minutes');
  // return that data
  res.send(stations);
})

// ---------------------------------------------------------
// GET /api/weather/xml endpoint for fetching weather station data from FMI API and returning it as XML (depricated - fix later)
// ---------------------------------------------------------
weatherRouter.get('/xml', async (req, res) => {
  try {
    // check cache first 
    const cached = await redisClient.get('weather:xml');

    if (cached) {
      logger.info('Returning cached weather station data');
      redisMemoryInfo(); // get info about Redis memory usage
      return res.send(cached);
    }

    // continue fetching if not in cache
    logger.info('No cached data found, fetching from FMI API');
    const xmlData = await fetch(config.FMIWeatherURL)
      .then(r => r.text())
      .catch(err => {
        logger.error(`Error fetching weather data from FMI API: ${err.message}`);
        throw new Error('Failed to fetch weather data from FMI API');
      });

    // cache the data in Redis for 30 minutes
    await redisClient.set(
      'weather:xml',
      xmlData,
      { EX: 1800 }
    );
    logger.info('Cached weather XML data in Redis for 30 minutes');
    redisMemoryInfo(); // get info about Redis memory usage

    // return xml data as response
    res.set('Content-Type', 'application/xml');
    res.send(xmlData);

  } catch (err) {
    logger.error(`Error in /api/weather/xml: ${err.message}`);
    res.status(500).send({ error: 'Internal server error' });
  }

  
})

// ---------------------------------------------------------
// Other endpoints return 404 Not Found
// ---------------------------------------------------------
weatherRouter.get('/', (req, res) => {
  return res.status(404).send({ error: 'Not found' });
})

module.exports = weatherRouter