/*
Author: 
Description:
*/

const logger = require('../utils/logger');
const config = require('../config');

// ---------------------------------------------------------
// Functions for parsing road observation data from digitraffic API
// ---------------------------------------------------------
async function parseRoadObs(metaResponse, dataResponse, timestamp) {
  // start parsing the responses
    const stations = await metaResponse.json();
    const data = await dataResponse.json();

  // Index data by station id for easier lookup
  const indexedData = {};
  if (data.stations) {
    for( const station of data.stations ) {
      indexedData[station.id] = station.sensorValues;
    }
  }

  // Mapping the data to a more usable format
  const roadParamMap = {
    "SADE_INTENSITEETTI": "ri_10min",
    "KESKITUULI": "ws_10min",
    "MAKSIMITUULI": "wg_10min",
    "TUULENSUUNTA": "wd_10min",
    "NÄKYVYYS_M": "vis",
    "VALLITSEVA_SÄÄ": "wawa",
    "ILMA": "t2m",
    "LUMEN_MÄÄRÄ1": "snow_aws",
    "KASTEPISTE": "dewpoint"
  };

  result = [];

  for (const station of stations.features) {
    const props = station.properties;
    const stationId = props.id;

    if ( props.collectionStatus !== "GATHERING") continue; // skip stations that are not gathering data
    if ( !indexedData[stationId] ) continue; // skip stations that have no data

    const entry = {
      station: props.name,
      fmisid: stationId,
      lat: station.geometry.coordinates[1],
      lon: station.geometry.coordinates[0],
      type: "road",
      time: null,
      epochtime: null,

      ri_10min: null,
      ws_10min: null,
      wg_10min: null,
      wd_10min: null,
      vis: null,
      wawa: null,
      t2m: null,
      n_man: null,
      r_1h: null,
      snow_aws: null,
      pressure: null,
      dewpoint: null
    };
    
    let hasRecentSensor = false;
    for (const sensor of indexedData[stationId]) {
      if (!sensor.measuredTime) continue; // skip if no measured time
      const sensorTime = new Date(sensor.measuredTime).getTime();

      // skip older than 24h
      if (timestamp - sensorTime > 24 * 60 * 60 * 1000) continue;

      hasRecentSensor = true;
      const mappedName = roadParamMap[sensor.name];
      if (mappedName) {
        entry[mappedName] = Number(sensor.value);
        entry.time = sensor.measuredTime;
        entry.epochtime = Math.floor(sensorTime / 1000);
      }
    }
    if (hasRecentSensor) {
      result.push(entry);
    }
  }

  logger.info(`Parsed road observations: ${result.length}`);
  return result;
}

async function parseSingleRoadObs(metaResponse, dataResponse, timestamp) {
  // start parsing the responses
  const meta = await metaResponse.json();
  const data = await dataResponse.json();

  // Index data by station id for easier lookup
  if ( meta.properties.sensors && data.sensorValues ) {
    for ( const metaSensor of meta.properties.sensors ) {
      // find the matching sensor in data by id
      const match = data.sensorValues.find(
        sensor => sensor.id === metaSensor.id
      )

      // if there is a match, add the measured time to meta
      if (match) {
        metaSensor.measuredTime = match.measuredTime;
      }
    }

    // add the data updated time to meta if it exists
    if (data.dataUpdatedTime) {
      meta.properties.dataUpdatedTime = data.dataUpdatedTime;
    }

    // map the sensor values to the meta properties using the same mapping as in parseRoadObs
    meta.properties.sensorValues = data.sensorValues;
  }

  return meta;
};

module.exports = {
  parseRoadObs, parseSingleRoadObs
};