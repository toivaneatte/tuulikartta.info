const weatherRouter = require('express').Router()
const { request } = require('express')
const xml2js = require('xml2js');

const csvReader = require('../utils/csvReader');
const logger = require('../utils/logger');
const redisClient = require('../utils/redisClient');

const config = csvReader.readConfig();
const xmlParser = new xml2js.Parser();

/* URL for fetching weather data from FMI Open Data API in Tuulikartta.info:

http://opendata.fmi.fi/wfs?request=getFeature&stationtype=synop&parameters=ri_10min,ws_10min,wg_10min,wd_10min,vis,wawa,t2m,n_man,r_1h,snow_aws,pressure,rh,dewpoint&storedquery_id=fmi::observations::weather::multipointcoverage&bbox=16.58,58.81,34.8,70.61,epsg::4326&timestep=10&starttime=2026-02-07T22:00:00Z&endtime=2026-02-08T14:48:44Z

*/

/* The new URL for fetching weather data from FMI Open Data API:

http://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::forecast::harmonie::surface::point::multipointcoverage&place=helsinki&

*/

/* Test URL 

http://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::multipointcoverage&place=helsinki&

*/

/*
Functions for fetching and processing weather data from FMI API
*/
const fetchNewFMIData = async (url) => {
  logger.info(`Fetching weather data from FMI API with URL: ${url}`);
  const parsedData = await fetch(url)
    .then(r => r.text())
    .then(xmlString => xmlParser.parseStringPromise(xmlString))
  
  result1 = []; // this has [{ name: 'Helsinki-Vantaa', fmisid: 100971 }]
  // all the weather stations are in this array
  result2 = []; // this has [{ name: 'Helsinki-Vantaa', coordinates: [24.963, 60.317] }]
  const members = parsedData['wfs:FeatureCollection']['wfs:member'] 
  
  /*
  Start the iteration of members
  */
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

/*
GET /api/weather endpoint for fetching weather station data from FMI API
*/
weatherRouter.get('/', async (req, res) => {
  const cached = await redisClient.get('weather:stations'); // Check Redis cache first

  if (cached) {
    logger.info('Returning cached weather station data');
    return res.send(JSON.parse(cached));
  }

  const url = 'http://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::multipointcoverage&place=tampere&place=helsinki&'
  
  // get data from FMI API
  const stations = await fetchNewFMIData(url);

  // cache the data in Redis for 1 hour
  await redisClient.set(
    'weather:stations',
    JSON.stringify(stations),
    { EX: 3600 }
  );
  logger.info('Cached weather station data in Redis for 1 hour');
  // return that data
  res.send(stations);
})

module.exports = weatherRouter