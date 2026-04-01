/*
Author: Kasper Kivistö
Description: Controller for road observation-related endpoints. Currently includes:
- GET /api/road/obs: Fetches road observation data from a specified API, parses the XML response, and returns an array of observation objects.

*/

const roadRouter = require('express').Router()
const logger = require('../utils/logger');
const config = require('../config');
const setTimeService = require('../services/setTime');
const { mergeHistoricData, parseRoadObs, parseSingleRoadObs } = require('../services/parseRoadObs');
const { parseRoadCameras, parseSingleRoadCamera } = require('../services/parseRoadCameras');

// ---------------------------------------------------------
// GET /api/road/obs endpoint for fetching road observations from Digitraffic API
// ---------------------------------------------------------
roadRouter.get('/obs', async (req, res) => {
  logger.info("GET request received at /api/road/obs");
  // get the URL from config
  let metaURL = config.roadObsURL;
  let dataURL = metaURL + "/data";
  const headers = {
    "Accept-Encoding": "gzip",
    "Accept": "application/json",
    "User-Agent": config.digitrafficAPIuser
  };

  //start by making time stamp
  const timestamp = req.query.time || "now";
  const UTCtimestamp = setTimeService.setTimeRoad(timestamp);
  
  // TODO: for historical data, we might need to use this like in other enpoints. But at the moment no timestamp is given to the API.
  //URL += setTimeService.setTime(timestamp, false); // isGraph = false for map data
  //logger.debug("Constructed URL for road observations metadata: " + metaURL);
  //logger.debug("Constructed URL for road observations data: " + dataURL);

  // fetch actual data from API
  try {
    // fetch metadata first to get the list of stations, then fetch data for those stations. 
    const [metaResponse, dataResponse] = await Promise.all([
      fetch(metaURL, {headers}).then(r => r.json()),
      fetch(dataURL, {headers}).then(r => r.json())
    ]);

    let historicData = [];

    let first = true;

    for (const station of metaResponse.features) {
      let stationData = dataResponse.stations.find(s => s.id === station.properties.id);
      let historicURL = `${config.roadObsURL}/${station.properties.id}/data/history${UTCtimestamp}`;
      if (first) {
        logger.debug("FIRST STATION HISTORY URL:", historicURL);
      }
      const historyResponse = await fetch(historicURL, {headers}).then(r => r.json());
      let mergedData = mergeHistoricData(station, stationData, historyResponse);
      historicData.push(mergedData);
      if (first) {
        first = false;
      }
    }

    // parse the responses and return the observations
    logger.info("Road observation metadata and data fetched successfully. Parsing responses...");
    const observations = await parseRoadObs(metaResponse, historicData, UTCtimestamp);
    
    res.set('Content-Type', 'application/json');
    res.json(observations);

  } catch (error) {
    logger.error("Error in /api/road/obs endpoint:", error);
    res.status(500).json({ error: "Failed to fetch road observations" });
  }
});

// ---------------------------------------------------------
// GET /api/road/obs(:stationId) endpoint for fetching road observations for a specific station from Digitraffic API
// ---------------------------------------------------------
roadRouter.get('/obs/:stationId', async (req, res) => {
  logger.info(`GET request received at /api/road/obs/${req.params.stationId}`);
  // get the URL from config
  let metaURL = `${config.roadObsURL}/${req.params.stationId}`;
  let dataURL = metaURL + "/data";
  const headers = {
    "Accept-Encoding": "gzip",
    "Accept": "application/json",
    "User-Agent": config.digitrafficAPIuser
  };

  //start by making time stamp
  const timestamp = req.query.time || "now";
  const UTCtimestamp = setTimeService.setTimeRoad(timestamp);
  
  //logger.debug(`Constructed URL for road observations metadata for station ${req.params.stationId}: ${metaURL}`);
  //logger.debug(`Constructed URL for road observations data for station ${req.params.stationId}: ${dataURL}`);

  try {
    // fetch metadata first to get the list of stations, then fetch data for those stations. 
    const [metaResponse, dataResponse] = await Promise.all([
      fetch(metaURL, {headers}).then(r => r.json()),
      fetch(dataURL, {headers}).then(r => r.json())
    ]);

    let historicData = [];

let first = true;

    for (const station of metaResponse.features) {
      let stationData = dataResponse.stations.find(s => s.id === station.properties.id);
      let historicURL = `${config.roadObsURL}/${station.properties.id}/data/history${UTCtimestamp}`;
      if (first) {
        logger.debug("FIRST STATION HISTORY URL:", historicURL);
      }
      const historyResponse = await fetch(historicURL, {headers}).then(r => r.json());
      let mergedData = mergeHistoricData(station, stationData, historyResponse);
      historicData.push(mergedData);
      if (first) {
        first = false;
      }
    }

    // parse the responses and return the observations
    logger.info(`Road observation metadata and data for station ${req.params.stationId} fetched successfully. Parsing responses...`);
    const observation = await parseSingleRoadObs(metaResponse, historicData, UTCtimestamp);
    
    res.set('Content-Type', 'application/json');
    res.json(observation);

  } catch (error) {
    logger.error(`Error in /api/road/obs/${req.params.stationId} endpoint:`, error);
    res.status(500).json({ error: `Failed to fetch road observations for station ${req.params.stationId}` });
  }
});

// ---------------------------------------------------------
// GET /api/road/camera endpoint for fetching road camera data from Digitraffic API
// ---------------------------------------------------------
roadRouter.get('/cameras', async (req, res) => {
  logger.info("GET /api/road/cameras");
  // get the URL from config
  let metaURL = config.roadCameraURL;
  let dataURL = metaURL + "/data";

  //start by making time stamp
  const timestamp = req.query.time || "now";
  const UTCtimestamp = setTimeService.setTime(timestamp, false); // isGraph = false for map data

  const headers = {
    "Accept": "application/json",
    "User-Agent": config.digitrafficAPIuser
  };

  try {
    // fetch actual data from API
    const [metaResponse, dataResponse] = await Promise.all([
      fetch(metaURL, { headers }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      fetch(dataURL, { headers }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    ]);

    // parse the responses and return the camera data
    logger.info("Road camera metadata and data fetched successfully. Parsing responses...");
    const cameras = await parseRoadCameras(metaResponse, dataResponse, UTCtimestamp);
    
    res.set('Content-Type', 'application/json');
    res.json(cameras);
  } catch (error) {
    logger.error("Error in /api/road/cameras endpoint:", error);
    res.status(500).json({ error: "Failed to fetch road camera data" });
    return;
  }
});

// ---------------------------------------------------------
// GET /api/road/cameras/:stationId endpoint for fetching road camera data from Digitraffic API for one station
// ---------------------------------------------------------
roadRouter.get('/cameras/:stationId', async (req, res) => {
  logger.info(`GET /api/road/cameras/${req.params.stationId}`);
  // get the URL from config
  let metaURL = `${config.roadCameraURL}/${req.params.stationId}`;
  let dataURL = metaURL + "/data";

  //start by making time stamp
  const timestamp = req.query.time || "now";
  const UTCtimestamp = setTimeService.setTime(timestamp, false); // isGraph = false for map data

  const headers = {
    "Accept": "application/json",
    "User-Agent": config.digitrafficAPIuser
  };

  try {
    // fetch actual data from API
    const [metaResponse, dataResponse] = await Promise.all([
      fetch(metaURL, { headers }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      fetch(dataURL, { headers }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    ]);

    // parse the responses and return the camera data
    logger.info(`Road camera metadata and data fetched successfully for station: ${req.params.stationId}. Parsing responses...`);
    const camera = await parseSingleRoadCamera(metaResponse, dataResponse, UTCtimestamp);
    
    res.set('Content-Type', 'application/json');
    res.json(camera);
  } catch (error) {
    logger.error("Error in /api/road/cameras endpoint:", error);
    res.status(500).json({ error: "Failed to fetch road camera data" });
    return;
  }
});

// ---------------------------------------------------------
// Other endpoints return 404 Not Found
// ---------------------------------------------------------
roadRouter.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

module.exports = roadRouter;