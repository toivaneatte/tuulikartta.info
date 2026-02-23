/*
Author: Kasper Kivistö
Description: This file contains the fethcer for fetching weather station data for the favourite stations defined in config.js. The fetcher is scheduled to run every 30mins using node-cron, and it fetches the data from the FMI Open Data API and stores it in Redis cache. The fetcher also logs the fetching process and any errors that occur.
*/

const nodeCron = require('node-cron');
const logger = require('./logger');
const config = require('../config');
const redisClient = require('../utils/redisClient');



logger.info('Starting favourite stations weather data fetcher...');
nodeCron.schedule(config.fetchFavouritePeriod, async () => {
  logger.info('Favourite stations data fetcher triggered')
  // start creating the URL
  var baseURL = 'http://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::multipointcoverage&';
  for ( const station of config.favouriteStations) {
    if (station.onOff === 1) {
      baseURL += `place=${station.name.toLowerCase()}&`
    }
  }
  //logger.info(`Constructed URL for fetching favourite stations: ${baseURL}`);

  // get data from FMI API
/*
  const stations = await fetch(baseURL)
    .then(r => r.text())
    .catch(err => {
      logger.error(`Error in Cron fetching data from FMI API: ${err}`);
      return null;
    });
*/

  //logger.info(`Fetched data for favourite stations. Caching data in Redis...`);
});