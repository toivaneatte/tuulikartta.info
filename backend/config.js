// Backend settings for Tuulikartta.info
const version = '0.0.1';

// Server settings
const serverPort = 3000;
const debugMode = true;

// Needed URLs for data fetching and processing
const FMIWeatherURL = "http://opendata.fmi.fi/wfs?request=getFeature&stationtype=synop&parameters=ri_10min,ws_10min,wg_10min,wd_10min,vis,wawa,t2m,n_man,r_1h,snow_aws,pressure,rh,dewpoint&storedquery_id=fmi::observations::weather::multipointcoverage&bbox=16.58,58.81,34.8,70.61,epsg::4326&timestep=10&";

// Start and endtime look like this (debugging)
// starttime=2026-02-07T22:00:00Z&endtime=2026-02-08T14:48:44Z&


// Parameters to fetch for favourite stations (same as all stations)
const favouriteParameters = 'ri_10min,ws_10min,wg_10min,wd_10min,vis,wawa,t2m,n_man,r_1h,snow_aws,pressure,rh,dewpoint';

// Favourite weather stations for the application
const favouriteStations = [
  { name: 'Pirkkala', fmisid: 101118, onOff: 1 },
  { name: 'Tampere', fmisid: 101311, onOff: 1 },
];


// How many days to keep favourite station observations in SQLite
const favouriteRetentionDays = 3;

// fetch data for favourite stations in this period.
const fetchFavouritePeriod = '*/10 * * * *'
/*
* * * * *
│ │ │ │ │
│ │ │ │ └── day of week
│ │ │ └──── month
│ │ └────── day of month
│ └──────── hour
└────────── minute
*/
// Examples:
// Every 5 minutes: '*/5 * * * *'
// Every 30 minutes: '*/30 * * * *'

module.exports = {
  version,
  serverPort,
  debugMode,
  FMIWeatherURL,
  favouriteStations,
  fetchFavouritePeriod,
  favouriteRetentionDays,
  favouriteParameters
};