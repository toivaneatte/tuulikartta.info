// Backend settings for Tuulikartta.info
const version = '0.0.1';

// Server settings
const serverPort = 3000;
const debugMode = true;

// Needed URLs for data fetching and processing
const FMIWeatherURL = "http://opendata.fmi.fi/wfs?request=getFeature&stationtype=synop&parameters=ri_10min,ws_10min,wg_10min,wd_10min,vis,wawa,t2m,n_man,r_1h,snow_aws,pressure,rh,dewpoint&storedquery_id=fmi::observations::weather::multipointcoverage&bbox=16.58,58.81,34.8,70.61,epsg::4326&timestep=10&starttime=2026-02-07T22:00:00Z&endtime=2026-02-08T14:48:44Z";


// Favourite weather stations for the application
const favouriteStations = [
  { name: 'Helsinki-Vantaa', fmisid: 100971, onOff: 1 },
  { name: 'Helsinki-Kumpula', fmisid: 101044, onOff: 1 },
  { name: 'Helsinki-Malmi', fmisid: 101045, onOff: 0 },
  { name: 'Helsinki-Mäkelänkatu', fmisid: 101046, onOff: 1 },
  { name: 'Helsinki-Pasila', fmisid: 101047, onOff: 0 },
  { name: 'Helsinki-Vallila', fmisid: 101048, onOff: 1 },
];

module.exports = {
  version,
  serverPort,
  debugMode,
  FMIWeatherURL,
  favouriteStations
};