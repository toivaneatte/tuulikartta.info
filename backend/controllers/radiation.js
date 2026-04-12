/*
Author: Kasper Kivistö
Description: Controller for radiation-related endpoints. Currently includes:
- GET /api/radiation/rvalue: Fetches R values from space.fmi API and returns them in a structured format.
- GET /api/radiation/external: Fetches external radiation data from STUK FMI API, parses the XML response, and returns an array of observation objects.
- GET /api/radiation/nuclides: Fetches nuclide data from STUK FMI API, parses the XML response, and returns an array of observation objects.

*/

const radiationRouter = require('express').Router()
const logger = require('../utils/logger');
const config = require('../config');
const setTimeService = require('../services/setTime');
const { getRValues } = require('../services/fetchRValues');
const { parseFMIMultipointcoverage, parseNuclideMultipointcoverage } = require('../utils/fmiParser');

const DEBUG = config.debugMode;
/*
DONE:
- R values from avaruuskeskus space.fmi API 
- External radiation from ilmatieteenlaitos STUK FMI API 
- Nuclides from ilmatieteenlaitos STUK FMI API 

TODO:
- Earth magnetic field from ilmatieteenlaitos STUK FMI API (maagneettikenttä)
*/

// ---------------------------------------------------------
// GET /api/radiation/rvalue endpoint for fetching R values from space.fmi API
// ---------------------------------------------------------
radiationRouter.get('/rvalue', async (req, res) => {
  logger.info("GET /api/radiation/rvalue");
  try {
    const rValues = await getRValues();
    logger.info(`Fetched R values, number of observations: ${rValues.length}`);

    res.set('Content-Type', 'application/json');
    res.send(rValues);
  } catch (error) {
    logger.error("Error in /api/radiation/rvalue endpoint:", error);
    res.status(500).json({ error: "R-luvut ei saatavilla" });
  }
});

// ---------------------------------------------------------
// GET /api/radiation/exteral endpoint for fetching external radiation data from STUK FMI API
// ---------------------------------------------------------
radiationRouter.get('/external', async (req, res) => {
  logger.info("GET /api/radiation/external");
  // get the URL from config
  let URL = config.STUKRadiationURL;

  //start by making time stamp
  const timestamp = req.query.time || "now";
  
  URL += setTimeService.setTime(timestamp, false); // isGraph = false for map data
  // logger.debug("Constructed URL for external radiation: " + URL);

  // fetch actual data from API
  try {
    const responseXml = await fetch(URL, { signal: AbortSignal.timeout(config.apiTimeoutMs) }).then(r => r.text());

    if (!responseXml) {
      throw new Error(`HTTP error: ${responseXml.status}`);
    }

    // Parse the XML response using the utility function
    const result = await parseFMIMultipointcoverage(responseXml, 'DR_PT10M_avg', 'radiation');
    logger.info(`Parsed external radiation data, number of observations: ${result.length}`);

    res.set('Content-Type', 'application/json');
    res.send(result);

  } catch (error) {
    logger.error("Error in /api/radiation/external endpoint:", error);
    res.status(500).json({ error: "Ulkoinen säteily ei saatavilla" });
  }
});

// ---------------------------------------------------------
// GET /api/radiation/exteral endpoint for fetching external radiation data for one station from STUK FMI API
// ---------------------------------------------------------
radiationRouter.get('/external/:stationId', async (req, res) => {
  logger.info("GET /api/radiation/external");
  // get the URL from config
  let URL = `${config.STUKRadiationGraphURL}fmisid=${req.params.stationId}&`;

  //start by making time stamp
  const timestamp = req.query.time || "now";
  
  // add timestamp to URL
  URL += setTimeService.setTime(timestamp, true); // isGraph = true for graph data
  logger.debug("GET /api/radiation/external - URL: " + URL);

  // fetch actual data from API
  try {
    const responseXml = await fetch(URL, { signal: AbortSignal.timeout(config.apiTimeoutMs) }).then(r => r.text());

    if (!responseXml) {
      throw new Error(`HTTP error: ${responseXml.status}`);
    }

    // Parse the XML response using the utility function
    const result = await parseFMIMultipointcoverage(responseXml, 'DR_PT10M_avg,epochtime', 'radiation');
    logger.info(`Parsed external radiation data, number of observations: ${result.length}`);

    res.set('Content-Type', 'application/json');
    res.send(result);

  } catch (error) {
    logger.error("Error in /api/radiation/external endpoint:", error);
    res.status(500).json({ error: "Säteilydata ei saatavilla" });
  }
});

// ---------------------------------------------------------
// GET /api/radiation/nuclides endpoint for fetching nuclide data from STUK FMI API
// ---------------------------------------------------------
radiationRouter.get('/nuclides', async (req, res) => {
  logger.info("GET /api/radiation/nuclides");
  // get the URL from config
  let URL = config.STUKNuclidesURL;

  //start by making time stamp
  const timestamp = req.query.time || "now";
  
  URL += setTimeService.setDayRange(timestamp, true, 90); // isGraph = true for graph data
  //logger.debug("Constructed URL for nuclides: " + URL);

  // fetch actual data from API
  try{
    const responseXml = await fetch(URL, { signal: AbortSignal.timeout(config.apiTimeoutMs) }).then(r => r.text());

    if (!responseXml) {
      throw new Error(`HTTP error: ${responseXml.status}`);
    }

    // parse the XML response using the utility function
    const result = await parseNuclideMultipointcoverage(responseXml);
    logger.info(`Parsed nuclide data, number of observations: ${result.length}`);

    res.set('Content-Type', 'application/json');
    res.send(result);

  } catch (error) {
    logger.error("Error in /api/radiation/nuclides endpoint:", error);
    res.status(500).json({ error: "Ilman radioaktiivisuus ei saatavilla" });
  }
});

// ---------------------------------------------------------
// Other endpoints return 404 Not Found
// ---------------------------------------------------------
radiationRouter.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

module.exports = radiationRouter;