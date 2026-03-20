/*
Author: 
Description:

*/

const radiationRouter = require('express').Router()
const logger = require('../utils/logger');
const config = require('../config');
const setTimeService = require('../services/setTime');
const { parseFMIMultipointcoverage } = require('../utils/fmiParser');

const DEBUG = config.debugMode;
// tänne R luvut (avaruussäkeskus), STUK FMI (Ulkoinen säteily) ja ilman radioaktiivisuus (STUK FMI)

// ja joskus vielä maan maagneettikenttä (STUK FMI)

// ---------------------------------------------------------
// Functions for fetching and processing R value data from space.fmi API
// ---------------------------------------------------------
async function getRValues() {
  const url = config.SpaceFMIURL;

  try {
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const json = await response.json();
    logger.info("Fetched R values from space.fmi API");
    //logger.info("Raw R value data: " + JSON.stringify(json));

    // convert the API response into an array of objects with the desired structure
    const dataArray = Object.values(json.data);
    const result = [];

    for (const item of dataArray) {
      const tmp = {
        station: item["Asema"],
        lat: item["Leveyspiiri"],
        lon: item["Pituuspiiri"],
        time: item["Aika"],
        type: "magnetometer",
        rVal: item["R-luku"],
        upperLim: item["Ylempi raja-arvo"],
        lowerLim: item["Alempi raja-arvo"],
        rProb: null
      };

      const prob = item["Revontulten todennäköisyys"];

      if (prob === "Revontulet epätodennäköisiä") {
        tmp.rProb = "low";
      } else if (prob === "Revontulet mahdollisia") {
        tmp.rProb = "medium";
      } else if (prob === "Revontulet todennäköisiä") {
        tmp.rProb = "high";
      }

      result.push(tmp);
    }

    return result;

    } catch (error) {
    console.error("Error fetching R values:", error);
    throw error;
  }
}

// ---------------------------------------------------------
// GET /api/radiation/rvalue endpoint for fetching R values from space.fmi API
// ---------------------------------------------------------
radiationRouter.get('/rvalue', async (req, res) => {
  try {
    const rValues = await getRValues();
    res.set('Content-Type', 'application/json');
    res.send(rValues);
  } catch (error) {
    logger.error("Error in /api/radiation/rvalue endpoint:", error);
    res.status(500).json({ error: "Failed to fetch R values" });
  }
});

// ---------------------------------------------------------
// GET /api/radiation/exteral endpoint for fetching external radiation data from STUK FMI API
// ---------------------------------------------------------
radiationRouter.get('/external', async (req, res) => {
  // get the URL from config
  let URL = config.STUKRadiationURL;

  //start by making time stamp
  const timestamp = req.query.time || "now";
  logger.debug("Timestamp is: " + timestamp);

  URL += setTimeService(timestamp, false); // isGraph = false for map data
  logger.debug("Constructed URL for STUK FMI API: " + URL);

  // fetch actual data from API
  try {
    const responseXml = await fetch(URL).then(r => r.text());
    
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
    res.status(500).json({ error: "Failed to fetch external radiation data" });
  }
});


// ---------------------------------------------------------
// Other endpoints return 404 Not Found
// ---------------------------------------------------------
radiationRouter.get('/', (req, res) => {
  return res.status(404).send({ error: 'Not found' });
})

module.exports = radiationRouter;