/*
Calculates running daily aggregate values (max gust, max wind, max/min temp, daily precipitation)
for all favourite_observations rows from midnight Helsinki time onwards.
Called after each cron insert and after the 24h backfill.
*/

const { db, getFavouriteObsSince, updateFavouriteDailyValues } = require('./db');
const logger = require('./logger');

// Returns a Date object representing midnight Helsinki time (in UTC) for the given date.
const getMidnight = (date) => {
  const datePart = date.toLocaleDateString('en-CA', { timeZone: 'Europe/Helsinki' });
  const noonUTC = new Date(`${datePart}T12:00:00Z`);
  const helsinkiHour = parseInt(
    new Intl.DateTimeFormat('en', {
      timeZone: 'Europe/Helsinki',
      hour: '2-digit',
      hour12: false,
    }).format(noonUTC),
    10
  );
  const offsetHours = helsinkiHour - 12;
  const utcMidnight = new Date(`${datePart}T00:00:00Z`);
  return new Date(utcMidnight.getTime() - offsetHours * 3600000);
};

const updateManyDailyValues = db.transaction((rows) => {
  for (const row of rows) updateFavouriteDailyValues.run(row);
  return rows.length;
});

const calculateFavouriteDailyAggregates = () => {
  const midnight = getMidnight(new Date());
  const observations = getFavouriteObsSince.all(midnight.toISOString());

  if (observations.length === 0) return;

  // Group by fmisid (already sorted fmisid ASC, timestamp ASC)
  const byStation = {};
  for (const obs of observations) {
    if (!byStation[obs.fmisid]) byStation[obs.fmisid] = [];
    byStation[obs.fmisid].push(obs);
  }

  const updates = [];
  for (const fmisid of Object.keys(byStation)) {
    let wg_1d = null,
      ws_1d = null,
      tmax = null,
      tmin = null,
      rr_1d = 0;
    let wg_max_dir = null,
      ws_max_dir = null;

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

      updates.push({
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

  const count = updateManyDailyValues(updates);
  logger.info(`Calculated daily aggregates for ${count} favourite_observations rows`);
};

module.exports = { calculateFavouriteDailyAggregates };
