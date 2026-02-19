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

$nuclideSettings = array();
$nuclideSettings["storedquery_id"] = "stuk::observations::air::radionuclide-activity-concentration::latest::multipointcoverage";
$nuclideSettings["bbox"]           = "16.58,58.81,34.8,70.61,epsg::4326";
$nuclideSettings["timestep"]       = "10";
$nuclideData = $dataMiner->nuclideMultipointcoverage($timestamp, $nuclideSettings, false);
error_log("nuclide data handled");

$airRadioData = [];
foreach ($nuclideData as $entry) {
	$lat = isset($entry["lat"]) ? $entry["lat"] : null;
	$lon = isset($entry["lon"]) ? $entry["lon"] : null;

	if (($lat === null || $lon === null) && isset($entry["pos"])) {
		$posParts = preg_split('/\s+/', trim($entry["pos"]));
		if (count($posParts) >= 2) {
			$lat = floatval($posParts[0]);
			$lon = floatval($posParts[1]);
		}
	}

	if ($lat === null || $lon === null) {
		continue;
	}

	$timeString = isset($entry["time"]) ? $entry["time"] : null;
	$epochTime = isset($entry["epochtime"]) ? $entry["epochtime"] : null;
	if ($epochTime === null && $timeString) {
		$epochTime = strtotime($timeString);
		if ($epochTime === false) {
			$epochTime = null;
		}
	}

	$airRadioData[] = [
		"station" => isset($entry["station"]) ? $entry["station"] : "",
		"fmisid" => isset($entry["fmisid"]) ? $entry["fmisid"] : null,
		"lat" => floatval($lat),
		"lon" => floatval($lon),
		"time" => $timeString,
		"epochtime" => $epochTime,
		"type" => "air_radio",
		"Pb-210" => isset($entry["Pb-210"]) ? $entry["Pb-210"] : null,
		"Be-7" => isset($entry["Be-7"]) ? $entry["Be-7"] : null,
		"Cs-137" => isset($entry["Cs-137"]) ? $entry["Cs-137"] : null
	];
}

// Combine all data
$combinedData = array_merge($synopdata, $radiationData, $airRadioData);
error_log("data combined");

print json_encode($combinedData);
