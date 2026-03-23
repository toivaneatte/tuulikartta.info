/*
Author: Kasper Kivistö
Description: Controller for road observation-related endpoints. Currently includes:
- GET /api/road/obs: Fetches road observation data from a specified API, parses the XML response, and returns an array of observation objects.

*/

const roadRouter = require('express').Router()
const logger = require('../utils/logger');
const config = require('../config');
const setTimeService = require('../services/setTime');
const { parseFMIMultipointcoverage } = require('../utils/fmiParser');

const DEBUG = config.debugMode;

// ---------------------------------------------------------
// GET /api/road/obs endpoint for fetching road observations from **WHAT API?**
// ---------------------------------------------------------
roadRouter.get('/obs', async (req, res) => {
  logger.info("GET request received at /api/road/obs");
  // get the URL from config
  let URL = config.roadObsURL;

  //start by making time stamp
  const timestamp = req.query.time || "now";
  
  URL += setTimeService.setTime(timestamp, false); // isGraph = false for map data
  logger.debug("Constructed URL for road observations: " + URL);

  // fetch actual data from API
  try {
    const responseXml = await fetch(URL).then(r => r.text());
    if (!responseXml) {
      throw new Error(`HTTP error: ${responseXml.status}`);
    }
    const observations = await parseFMIMultipointcoverage(responseXml, false);
    logger.info("Parsed road observations, number of observations: " + observations.length);

    res.set('Content-Type', 'application/json');
    res.send(observations);

  } catch (error) {
    logger.error("Error in /api/road/obs endpoint:", error);
    res.status(500).json({ error: "Failed to fetch road observations" });
  }
});

// ---------------------------------------------------------
// GET /api/road/camera endpoint for fetching road camera data from **WHAT API?**
// ---------------------------------------------------------
roadRouter.get('/camera', async (req, res) => {
  logger.info("GET request received at /api/road/camera");
  // get the URL from config
  let URL = config.roadCameraURL;

  //start by making time stamp
  const timestamp = req.query.time || "now";
  
  URL += setTimeService.setTime(timestamp, false);
  logger.debug("Constructed URL for road cameras: " + URL);

  // fetch actual data from API
});

// ---------------------------------------------------------
// Other endpoints return 404 Not Found
// ---------------------------------------------------------
roadRouter.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

module.exports = roadRouter;