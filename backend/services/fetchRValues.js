/*
Author: Kasper Kivistö
Description: Function for fetching R values from space.fmi API and converting them into a structured format for the frontend. Currently used in GET /api/radiation/rvalue
*/

const logger = require('../utils/logger');
const config = require('../config');

// ---------------------------------------------------------
// Functions for fetching and processing R value data from space.fmi API
// ---------------------------------------------------------
async function getRValues() {
  const url = config.SpaceFMIURL;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(config.apiTimeoutMs) });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const json = await response.json();
    //logger.info("Raw R value data: " + JSON.stringify(json));

    // convert the API response into an array of objects with the desired structure
    const dataArray = Object.values(json.data);
    const result = [];

    for (const item of dataArray) {
      const tmp = {
        station: item['Asema'],
        lat: item['Leveyspiiri'],
        lon: item['Pituuspiiri'],
        time: item['Aika'],
        type: 'R',
        rVal: item['R-luku'],
        upperLim: item['Ylempi raja-arvo'],
        lowerLim: item['Alempi raja-arvo'],
        rProb: null,
      };

      const prob = item['Revontulten todennäköisyys'];

      if (prob === 'Revontulet epätodennäköisiä') {
        tmp.rProb = 'low';
      } else if (prob === 'Revontulet mahdollisia') {
        tmp.rProb = 'medium';
      } else if (prob === 'Revontulet todennäköisiä') {
        tmp.rProb = 'high';
      }

      result.push(tmp);
    }

    return result;
  } catch (error) {
    console.error('Avaruussäädata ei saatavilla:', error);
    throw error;
  }
}

module.exports = {
  getRValues,
};
