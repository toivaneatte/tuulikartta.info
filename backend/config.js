// Backend settings for Tuulikartta.info
const version = '0.0.1';

// Server settings
const serverPort = 3000;
const debugMode = true;

// Needed URLs for data fetching and processing
// Used for the main map (all stations)
const FMIWeatherURL = "http://opendata.fmi.fi/wfs?request=getFeature&stationtype=synop&parameters=ri_10min,ws_10min,wg_10min,wd_10min,vis,wawa,t2m,n_man,r_1h,snow_aws,pressure,rh,dewpoint&storedquery_id=fmi::observations::weather::multipointcoverage&bbox=16.58,58.81,34.8,70.61,epsg::4326&timestep=10&";
// Used for graph requests (single station by fmisid)
const FMISingleStationURL = "http://opendata.fmi.fi/wfs?request=getFeature&storedquery_id=fmi::observations::weather::multipointcoverage&parameters=ri_10min,ws_10min,wg_10min,wd_10min,vis,wawa,t2m,n_man,r_1h,snow_aws,pressure,rh,dewpoint&timestep=10&";

// Start and endtime look like this (debugging)
// starttime=2026-02-07T22:00:00Z&endtime=2026-02-08T14:48:44Z&


// Parameters to fetch for favourite stations (same as all stations)
const favouriteParameters = 'ri_10min,ws_10min,wg_10min,wd_10min,vis,wawa,t2m,n_man,r_1h,snow_aws,pressure,rh,dewpoint';

// Favourite weather stations for the application. The names can be whatever, fmisid is the important part.
const favouriteStations = [
  { name: 'Pirkkala', fmisid: 101118, onOff: 1 },
  { name: 'Tampere', fmisid: 101311, onOff: 1 },
  { name: 'Hailuoto marjaniemi', fmisid: 101784, onOff: 1 },
  { name: 'Kaskinen sälgrund', fmisid: 101256, onOff: 1 },
  { name: 'Pyhtää lentokenttä', fmisid: 107029, onOff: 1 },
  { name: 'Pyhäjärvi ojakylä', fmisid: 101705, onOff: 1 },
  { name: 'Kuopio ritoniemi', fmisid: 101580, onOff: 1 },
  { name: 'Lappeenranta hiekkapakka', fmisid: 101252, onOff: 1 },
  { name: 'Pyhä', fmisid: 101958, onOff: 1 },
];


// How many days to keep favourite station observations in SQLite
const favouriteRetentionDays = 3;

// How many minutes the latest observation data is considered fresh before re-fetching from FMI
const currentDataMaxAgeMinutes = 10;

// In minutes. How long the observations are kept in the database.
// observations older than this are fetched straight from fmi api.
const mapObservationsWindowMinutes = 210;

// fetch data for favourite stations in this period.
const fetchFavouritePeriod = '*/1 * * * *'
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
  FMISingleStationURL,
  favouriteStations,
  fetchFavouritePeriod,
  favouriteRetentionDays,
  favouriteParameters,
  currentDataMaxAgeMinutes,
  mapObservationsWindowMinutes,
};