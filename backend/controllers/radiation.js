/*
Author: 
Description:

*/

const radiationRouter = require('express').Router()
const logger = require('../utils/logger');
const config = require('../config');

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
    res.send(rValues);
  } catch (error) {
    logger.error("Error in /api/radiation/rvalue endpoint:", error);
    res.status(500).json({ error: "Failed to fetch R values" });
  }
});

// ---------------------------------------------------------
// Other endpoints return 404 Not Found
// ---------------------------------------------------------
radiationRouter.get('/', (req, res) => {
  return res.status(404).send({ error: 'Not found' });
})

module.exports = radiationRouter;