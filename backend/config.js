// Backend settings for Tuulikartta.info
const version = '0.0.2';

// Server settings
const serverPort = 3000;
const debugMode = true;

// Needed URLs for data fetching and processing
// ----------------------------------------------------------
// URL for FMI api for fetching weather data for all stations in Finland
const FMIWeatherURL = "http://opendata.fmi.fi/wfs?request=getFeature&stationtype=synop&parameters=ri_10min,ws_10min,wg_10min,wd_10min,vis,wawa,t2m,n_man,r_1h,snow_aws,pressure,rh,dewpoint&storedquery_id=fmi::observations::weather::multipointcoverage&bbox=16.58,58.81,34.8,70.61,epsg::4326&timestep=10&";
// Used for graph requests (single station by fmisid)
const FMISingleStationURL = "http://opendata.fmi.fi/wfs?request=getFeature&storedquery_id=fmi::observations::weather::multipointcoverage&parameters=ri_10min,ws_10min,wg_10min,wd_10min,vis,wawa,t2m,n_man,r_1h,snow_aws,pressure,rh,dewpoint&timestep=10&";

// Start and endtime look like this (debugging)
// starttime=2026-02-07T22:00:00Z&endtime=2026-02-08T14:48:44Z&

// URL for fetching R values from space.fmi API
const SpaceFMIURL = "https://space.fmi.fi/MIRACLE/RWC/data/r_index_latest_fi.json";

// URL for fetching external radiation data from FMI STUK API
const STUKRadiationURL = "https://opendata.fmi.fi/wfs?request=getFeature&stationType=radiation&parameters=DR_PT10M_avg&storedquery_id=stuk::observations::external-radiation::latest::multipointcoverage&";

// URL for fetching external radiation data from FMI STUK API
const STUKRadiationGraphURL = "https://opendata.fmi.fi/wfs?request=getFeature&stationType=radiation&parameters=DR_PT10M_avg&storedquery_id=stuk::observations::external-radiation::multipointcoverage&timestep=10&";

// URL for fetching nuclide data from FMI STUK API
const STUKNuclidesURL = "https://opendata.fmi.fi/wfs?request=getFeature&storedquery_id=stuk::observations::air::radionuclide-activity-concentration::multipointcoverage&bbox=16.58,58.81,34.8,70.61,epsg::4326";

// URL for fetching road observations from digitraffic API
const roadObsURL = "https://tie.digitraffic.fi/api/weather/v1/stations";
const digitrafficAPIuser = "Tuulen-Viemät/Tuulikartta.info-v2";

// URL for fetching digitraffic camera data
const roadCameraURL = "https://tie.digitraffic.fi/api/weathercam/v1/stations";
// ----------------------------------------------------------

// Parameters to fetch for favourite stations (same as all stations)
const favouriteParameters = 'ri_10min,ws_10min,wg_10min,wd_10min,vis,wawa,t2m,n_man,r_1h,snow_aws,pressure,rh,dewpoint';

// Lightweight parameters for daily aggregate fetch (max gust, max wind, temp, precipitation)
const dailyAggregateParameters = 'wg_10min,ws_10min,t2m,r_1h,wd_10min';

// Favourite weather stations for the application. The names can be whatever, fmisid is the important part.
const favouriteStations = [
  { name: 'Tampere-pirkkala lentoasema', fmisid: 101118, onOff: 1 },
  { name: 'Tampere siilinkari', fmisid: 101311, onOff: 1 },
  { name: 'Hailuoto marjaniemi', fmisid: 101784, onOff: 1 },
  { name: 'Kaskinen sälgrund', fmisid: 101256, onOff: 1 },
  { name: 'Pyhtää lentokenttä', fmisid: 107029, onOff: 1 },
  { name: 'Pyhäjärvi ojakylä', fmisid: 101705, onOff: 1 },
  { name: 'Kuopio ritoniemi', fmisid: 101580, onOff: 1 },
  { name: 'Lappeenranta hiekkapakka', fmisid: 101252, onOff: 1 },
  { name: 'Pyhätunturi', fmisid: 101958, onOff: 1 },
];


// How many days to keep favourite station observations in SQLite
const favouriteRetentionDays = 3;

// On cold start (or when no recent favourite rows exist), how many hours
// of favourite observations to backfill into SQLite cache.
const favouriteInitialBackfillHours = 72;

// How many minutes the latest observation data is considered fresh before re-fetching from FMI
const currentDataMaxAgeMinutes = 10;

// Timeout for all external API requests (in milliseconds)
const apiTimeoutMs = 10 * 1000;

// In minutes. For how long all of the observations are kept in the database.
// observations older than this are fetched straight from fmi api.
const mapObservationsWindowMinutes = 210;

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
  FMISingleStationURL,
  SpaceFMIURL,
  STUKRadiationURL,
  STUKRadiationGraphURL,
  STUKNuclidesURL,
  roadObsURL,
  digitrafficAPIuser,
  roadCameraURL,
  favouriteStations,
  fetchFavouritePeriod,
  favouriteRetentionDays,
  favouriteInitialBackfillHours,
  favouriteParameters,
  currentDataMaxAgeMinutes,
  apiTimeoutMs,
  mapObservationsWindowMinutes,
  dailyAggregateParameters,
};