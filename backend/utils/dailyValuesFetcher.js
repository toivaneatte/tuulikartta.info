/*
Fetches daily aggregate weather observation values.
max gust, max wind, max and min temp, daily precipitation for each station for the current day.
*/

const config = require('../config');
const { parseFMIMultipointcoverage } = require('./fmiParser');
const { updateMapObsDailyValues } = require('./db');
const logger = require('./logger');

// Returns a Date object representing midnight Helsinki time (in UTC) for the given date.
const getMidnightHelsinki = (date) => {
  const datePart = date.toLocaleDateString('en-CA', { timeZone: 'Europe/Helsinki' });
  const noonUTC = new Date(`${datePart}T12:00:00Z`);
  const helsinkiHour = parseInt(
    new Intl.DateTimeFormat('en', { timeZone: 'Europe/Helsinki', hour: '2-digit', hour12: false }).format(noonUTC),
    10
  );
  const offsetHours = helsinkiHour - 12; // 2 for UTC+2 (winter), 3 for UTC+3 (summer)
  const utcMidnight = new Date(`${datePart}T00:00:00Z`);
  return new Date(utcMidnight.getTime() - offsetHours * 3600000);
};

// Fetches daily aggregate observations from FMI and calculates running max/min/sum per station.
// endTimestamp: ISO string or null (null = use current time)
//   - null:          stores results into map_observations SQLite rows, returns latest per station
//   - ISO string:    does NOT store, returns aggregates at that specific timestamp per station
const fetchDailyAggregates = async (endTimestamp) => {
  const end = endTimestamp ? new Date(endTimestamp) : new Date();
  const start = getMidnightHelsinki(end);

  const baseURL = config.FMIWeatherURL.replace(
    /parameters=[^&]+/,
    `parameters=${config.dailyAggregateParameters}`
  );
  const url = `${baseURL}starttime=${start.toISOString()}&endtime=${end.toISOString()}&`;
  logger.info(`Fetching daily aggregates: ${start.toISOString()} → ${end.toISOString()}`);

  let observations;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    let xml;
    try {
      xml = await fetch(url, { signal: controller.signal }).then(r => r.text());
    } finally {
      clearTimeout(timeoutId);
    }
    observations = await parseFMIMultipointcoverage(xml, config.dailyAggregateParameters);
  } catch (err) {
    logger.error(`Error fetching daily aggregates: ${err.message}`);
    return null;
  }

  if (!observations || observations.length === 0) {
    logger.info('No daily aggregate observations fetched');
    return null;
  }

  // Group by fmisid and sort ascending by timestamp
  const byStation = {};
  for (const obs of observations) {
    if (!byStation[obs.fmisid]) byStation[obs.fmisid] = [];
    byStation[obs.fmisid].push(obs);
  }
  for (const fmisid of Object.keys(byStation)) {
    byStation[fmisid].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  // Calculate running aggregates per station per timestamp
  const aggregated = [];
  for (const fmisid of Object.keys(byStation)) {
    let wg_1d = null, ws_1d = null, tmax = null, tmin = null, rr_1d = 0;
    let wg_max_dir = null, ws_max_dir = null;

    for (const obs of byStation[fmisid]) {
      if (obs.wg_10min !== null) {
        if (wg_1d === null || obs.wg_10min > wg_1d) {
          wg_1d = obs.wg_10min;
          wg_max_dir = obs.wd_10min ?? null;
        }
      }
      if (obs.ws_10min !== null) {
        if (ws_1d === null || obs.ws_10min > ws_1d) {
          ws_1d = obs.ws_10min;
          ws_max_dir = obs.wd_10min ?? null;
        }
      }
      if (obs.t2m !== null) {
        tmax = tmax === null ? obs.t2m : Math.max(tmax, obs.t2m);
        tmin = tmin === null ? obs.t2m : Math.min(tmin, obs.t2m);
      }
      if (obs.r_1h !== null) rr_1d += obs.r_1h;

      aggregated.push({
        fmisid: obs.fmisid,
        timestamp: obs.timestamp,
        wg_1d,
        ws_1d,
        tmax,
        tmin,
        rr_1d: Math.round(rr_1d * 10) / 10,
        wg_max_dir,
        ws_max_dir,
      });
    }
  }

  // Store into map_observations when called without endTimestamp (no-time-param case)
  if (!endTimestamp) {
    let updated = 0;
    for (const row of aggregated) {
      const result = updateMapObsDailyValues.run(row);
      updated += result.changes;
    }
    logger.info(`Updated daily aggregates for ${updated} map_observations rows`);
  }

  // Return latest aggregates per station
  const latestByStation = {};
  for (const row of aggregated) {
    if (!latestByStation[row.fmisid] || row.timestamp > latestByStation[row.fmisid].timestamp) {
      latestByStation[row.fmisid] = row;
    }
  }
  return Object.values(latestByStation);
};

module.exports = { fetchDailyAggregates };
