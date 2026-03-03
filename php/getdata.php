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

// road observations
$roadSettings = array();
$roadSettings["stationtype"]    = "road";
$roadSettings["parameters"]     = "ILMA";
$roadSettings["bbox"]           = "16.58,58.81,34.8,70.61,epsg::4326";
$roadData = $dataMiner->roadData($timestamp, $roadSettings, false);
error_log("road data handled");

$roadData = $dataMiner->serializeData($roadData);

// STUK observations
$radiationSettings = array();
$radiationSettings["stationtype"]    = "radiation";
$radiationSettings["parameters"]     = "DR_PT10M_avg";
$radiationSettings["storedquery_id"] = "stuk::observations::external-radiation::latest::multipointcoverage";
$radiationData = $dataMiner->multipointcoverage($timestamp, $radiationSettings, false);
error_log("radiation data handled");

// Use the non-::latest:: query with a 90-day window so that each nuclide's
// most recent measurement is found independently (different nuclides are
// measured on different schedules and ::latest:: only returns one common
// timestamp, leaving other nuclides as NaN).
$nuclideSettings = array();
$nuclideSettings["storedquery_id"] = "stuk::observations::air::radionuclide-activity-concentration::multipointcoverage";
$nuclideSettings["bbox"]           = "16.58,58.81,34.8,70.61,epsg::4326";
$nuclideData = $dataMiner->nuclideMultipointcoverage($timestamp, $nuclideSettings, true, 90);
error_log("nuclide data handled");

// Merge all time-series entries by station (fmisid), keeping the most recent
// non-null value seen for each nuclide individually.
$airRadioByKey = [];
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

	$fmisid = isset($entry["fmisid"]) ? intval($entry["fmisid"]) : null;
	$timeString = isset($entry["time"]) ? $entry["time"] : null;
	$epochTime = isset($entry["epochtime"]) ? $entry["epochtime"] : null;
	if ($epochTime === null && $timeString) {
		$epochTime = strtotime($timeString);
		if ($epochTime === false) {
			$epochTime = null;
		}
	}

	// Use fmisid as merge key; fall back to coordinate string if fmisid missing
	$key = $fmisid !== null ? $fmisid : (floatval($lat) . ',' . floatval($lon));

	if (!isset($airRadioByKey[$key])) {
		$airRadioByKey[$key] = [
			"station"      => isset($entry["station"]) ? $entry["station"] : "",
			"fmisid"       => $fmisid,
			"lat"          => floatval($lat),
			"lon"          => floatval($lon),
			"time"         => $timeString,
			"epochtime"    => $epochTime,
			"type"         => "air_radio",
			"Pb-210"       => null,
			"Be-7"         => null,
			"Cs-137"       => null,
			"_ep_Pb210"    => null,  // per-nuclide epoch trackers (removed before output)
			"_ep_Be7"      => null,
			"_ep_Cs137"    => null,
		];
	}

	// For each nuclide keep the most recent non-null value
	$nuclideEpochs = ['Pb-210' => '_ep_Pb210', 'Be-7' => '_ep_Be7', 'Cs-137' => '_ep_Cs137'];
	foreach ($nuclideEpochs as $nuclide => $epochKey) {
		$val = isset($entry[$nuclide]) ? $entry[$nuclide] : null;
		if ($val !== null) {
			$stored = $airRadioByKey[$key][$epochKey];
			if ($stored === null || $epochTime > $stored) {
				$airRadioByKey[$key][$nuclide]  = $val;
				$airRadioByKey[$key][$epochKey] = $epochTime;
			}
		}
	}
}

// Strip internal tracking keys before output
$airRadioData = [];
foreach ($airRadioByKey as $row) {
	unset($row['_ep_Pb210'], $row['_ep_Be7'], $row['_ep_Cs137']);
	$airRadioData[] = $row;
}

// Combine all data
$combinedData = array_merge($synopdata, $roadData, $radiationData, $airRadioData);
error_log("data combined");

print json_encode($combinedData);
