/*
Author: 
Description: 
*/

const logger = require('../utils/logger');
const config = require('../config');

async function parseRoadCameras(meta, data, timestamp) {
  if (!meta?.features || !data?.stations) return meta;

  // Create lookup table for stations (O(1) access)
  const dataLookup = Object.fromEntries(data.stations.map((s) => [s.id, s]));

  // Merge data into features
  for (const feature of meta.features) {
    const stationId = feature.properties.id;
    const freshData = dataLookup[stationId];

    if (!freshData) continue;

    // Copy updated time
    if (freshData.dataUpdatedTime) {
      feature.properties.dataUpdatedTime = freshData.dataUpdatedTime;
    }

    // Merge presets if they exist
    if (feature.properties.presets && freshData.presets) {
      const presetLookup = Object.fromEntries(freshData.presets.map((p) => [p.id, p]));

      for (const preset of feature.properties.presets) {
        const match = presetLookup[preset.id];
        if (match?.measuredTime) {
          preset.measuredTime = match.measuredTime;
        }
      }
    }
  }

  return meta;
}

async function parseSingleRoadCamera(meta, data, timestamp) {
  if (!meta?.properties || !meta.properties.presets || !data?.presets) {
    return meta; // Nothing to merge
  }

  // Create a lookup table for presets for O(1) access
  const presetLookup = Object.fromEntries(data.presets.map((p) => [p.id, p]));

  // Merge measuredTime from fresh data into metadata presets
  for (const metaPreset of meta.properties.presets) {
    const match = presetLookup[metaPreset.id];
    if (match?.measuredTime) {
      metaPreset.measuredTime = match.measuredTime;
    }
  }

  // Copy dataUpdatedTime if available
  if (data.dataUpdatedTime) {
    meta.properties.dataUpdatedTime = data.dataUpdatedTime;
  }

  return meta;
}

module.exports = {
  parseRoadCameras,
  parseSingleRoadCamera,
};
