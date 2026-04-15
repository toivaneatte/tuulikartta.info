/* 
Author: 
Description: Service for parsing road observation data from the Digitraffic API. Currently includes:
- parseRoadObs: Parses the metadata and data responses from the Digitraffic API for road observations and returns an array of observation objects for the stations.
- parseSingleRoadObs: Parses the metadata and data responses from the Digitraffic API for a single station and returns a single observation object for that station.
*/

const logger = require('../utils/logger');
const config = require('../config');

/**
 *  Parse road observations from the metadata and data responses from the Digitraffic API. This is used for the /api/road/obs endpoint.
 * @param {*} stations  - the metadata response from the Digitraffic API containing the list of stations and their properties
 * @param {*} data  - the data response from the Digitraffic API containing the sensor values for the stations
 * @param {*} timestamp  - the timestamp for which to parse the observations (in milliseconds since epoch). Only sensor values measured within 24 hours of this timestamp will be included.
 * @returns  - an array of observation objects for the stations, each containing the station information and the relevant sensor values
 */
async function parseRoadObs(stations, data, timestamp) {
  // Normalize requested time so we can compare numeric timestamps correctly.
  let targetTime = timestamp === 'now'
    ? Date.now()
    : typeof timestamp === 'string'
      ? Date.parse(timestamp)
      : timestamp;

  if (Number.isNaN(targetTime)) {
    logger.warn(`parseRoadObs: invalid timestamp '${timestamp}', using current time`);
    targetTime = Date.now();
  }

  // Index data by station id for easier lookup
  const indexedData = {};
  if (data.stations) {
    for( const station of data.stations ) {
      indexedData[station.id] = station.sensorValues;
    }
  }

  // Mapping the data to match FMI format
  const roadParamMap = {
    "SADE_INTENSITEETTI": "ri_10min",
    "KESKITUULI": "ws_10min",
    "MAKSIMITUULI": "wg_10min",
    "TUULENSUUNTA": "wd_10min",
    "NÄKYVYYS_M": "vis",
    "VALLITSEVA_SÄÄ": "wawa",
    "ILMA": "t2m",
    "LUMEN_MÄÄRÄ1": "snow_aws",
    "KASTEPISTE": "dewpoint",
    "KASTEPISTE_ERO_ILMA": "t2mdewpoint",
    "ILMAN_LÄMPÖTILA_24H_MIN": "tmin",
    "ILMAN_LÄMPÖTILA_24H_MAX": "tmax",
    "SADESUMMA_LIUKUVA_24H": "rr_1d"
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
      snow_aws: null,
      dewpoint: null,
      t2mdewpoint: null,
      tmin: null,
      tmax: null,
      rr_1d: null
    };
    
    let hasRecentSensor = false;
    for (const sensor of indexedData[stationId]) {
      if (!sensor.measuredTime) continue; // skip if no measured time
      const sensorTime = new Date(sensor.measuredTime).getTime();

      // skip older than 24h relative to the requested timestamp
      if (targetTime - sensorTime > 24 * 60 * 60 * 1000) continue;

      // skip sensor values recorded after the requested timestamp
      if (sensorTime > targetTime) continue;

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

/**
 *  Parse a single road observation for a specific station. This is used for the /api/road/obs/:stationId endpoint.
 * @param {*} meta  - the metadata response from the Digitraffic API for a single station
 * @param {*} data  - the data response from the Digitraffic API for a single station
 * @param {*} timestamp  - the timestamp for which to parse the observation (in milliseconds since epoch)
 * @returns  - a single observation object for the station, or null if no valid observation is found
 */
async function parseSingleRoadObs(meta, data, timestamp) {
  // Index data by station id for easier lookup
  if ( meta.properties.sensors && data.sensorValues ) {
    for ( const metaSensor of meta.properties.sensors ) {
      // find the matching sensor in data by id
      const sensorMap = Object.fromEntries(
        data.sensorValues.map(s => [s.id, s])
      );
      const match = sensorMap[metaSensor.id];

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