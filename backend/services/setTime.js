/*
Author: Kasper Kivistö
Description: Function for calculating start and endtime for API. Taken from dataMiner.php and adapted to JS and added new features.
*/

const { DateTime } = require('luxon');

/**
 * setTime calculates the start and end time parameters for FMI API requests based on the provided timestamp and whether the data is for graph or map.
 * @param {*} timestamp - ISO string or "now". For graph data, it defines the end of a 24h window. For map data, it defines the end of the day window.
 * @param {boolean} isGraph - If true, calculates a 24h window ending at the timestamp. If false, calculates a window from the start of the day to the timestamp.
 * @returns {string} - A URL query string with the appropriate starttime and endtime parameters for the FMI API.
 */
function setTime(timestamp, isGraph) {
  let url = '';

  if (isGraph) {
    // For graph data, we want a 24h window ending at the requested timestamp (or now)
    const end = timestamp === 'now' ? DateTime.utc() : DateTime.fromISO(timestamp, { zone: 'utc' });

    // The start time is 24 hours before the end time
    const start = end.minus({ hours: 24 });

    url = `&starttime=${start.toISO({ suppressMilliseconds: true })}&endtime=${end.toISO({ suppressMilliseconds: true })}`;
  } else {
    // For map data, we want all observations from the start of the day until now (or the requested timestamp)
    if (timestamp === 'now') {
      const start = DateTime.now().setZone('Europe/Helsinki').startOf('day').toUTC();

      url = `&starttime=${start.toISO({ suppressMilliseconds: true })}`;
    } else {
      // If a specific timestamp is provided, we want data from the start of that day until the timestamp
      const end = DateTime.fromISO(timestamp, { zone: 'utc' });

      const start = end.setZone('Europe/Helsinki').startOf('day').toUTC();

      url = `&starttime=${start.toISO({ suppressMilliseconds: true })}&endtime=${end.toISO({ suppressMilliseconds: true })}`;
    }
  }

  return url;
}

/**
 *  setDayRange calculates the start and end time parameters for FMI API requests based on the provided timestamp, whether the data is for graph or map, and a custom day range for graph data.
 * @param {*} timestamp - ISO string or "now". For graph data, it defines the end of the window. For map data, it defines the end of the day window.
 * @param {*} isGraph  - If true, calculates a window of rangeDays ending at the timestamp. If false, calculates a window from the start of the day to the timestamp.
 * @param {*} rangeDays  - For graph data, defines how many days the window should cover. If not a valid positive integer, defaults to 1 day.
 * @returns  - A URL query string with the appropriate starttime and endtime parameters for the FMI API.
 */
const setDayRange = (timestamp, isGraph, rangeDays) => {
  if (!isGraph) {
    return '';
  }

  // check if rangeDays is a valid positive integer, if not default to 1 day
  const days = Number.isInteger(rangeDays) && rangeDays > 1 ? rangeDays : 1;

  const end = timestamp === 'now' ? DateTime.utc() : DateTime.fromISO(timestamp, { zone: 'utc' });

  const start = end.minus({ days });

  return `&starttime=${start.toISO({ suppressMilliseconds: true })}&endtime=${end.toISO({ suppressMilliseconds: true })}`;
};

module.exports = {
  setTime,
  setDayRange,
};
