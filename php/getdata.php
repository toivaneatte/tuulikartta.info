<?php
require_once("dataMiner.php");
date_default_timezone_set('Europe/Helsinki');

header('Content-Type: application/json');

$timestamp = $_GET["time"];

$dataMiner = new DataMiner();

// synop observations
$settings = array();
$settings["stationtype"]    = "synop";
$settings["parameters"]     = "ri_10min,ws_10min,wg_10min,wd_10min,vis,wawa,t2m,n_man,r_1h,snow_aws,pressure,rh,dewpoint";
$settings["storedquery_id"] = "fmi::observations::weather::multipointcoverage";
$settings["bbox"]           = "16.58,58.81,34.8,70.61,epsg::4326";
$settings["timestep"]       = "10";
$synopdata = $dataMiner->multipointcoverage($timestamp, $settings, false);
error_log("synop data handled");

$synopdata = $dataMiner->serializeData($synopdata);

// STUK observations
$radiationSettings = array();
$radiationSettings["stationtype"]    = "radiation";
$radiationSettings["parameters"]     = "DR_PT10M_avg";
$radiationSettings["storedquery_id"] = "stuk::observations::external-radiation::latest::multipointcoverage";
$radiationData = $dataMiner->multipointcoverage($timestamp, $radiationSettings, false);
error_log("radiation data handled");

// Se harvemmin päivittyvä radionuklididata vaatii erillisen käsittelyn, joten jätetään se toistaiseksi pois.
// TODO: Implement proper parsing for radionuclide data
$airRadioData = [];

$nuclideSettings = array();
$nuclideSettings["storedquery_id"] = "stuk::observations::air::radionuclide-activity-concentration::latest::multipointcoverage";
$nuclideSettings["bbox"]           = "16.58,58.81,34.8,70.61,epsg::4326";
$nuclideSettings["timestep"]       = "10";
$nuclideData = $dataMiner->nuclideMultipointcoverage($timestamp, $nuclideSettings, false);
error_log("nuclide data handled");

// Combine all data
$combinedData = array_merge($synopdata, $radiationData);
error_log("data combined");

print json_encode($nuclideData);
//print json_encode($combinedData);
