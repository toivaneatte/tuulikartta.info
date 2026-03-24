<?php
date_default_timezone_set('Europe/Helsinki');

header('Content-Type: application/json');

// URLs for backend API endpoints: weather, radioation and cameras.
$backendUrlWeather = "http://backend:3000/api/weather/latest";
//$backendUrlWeather = "http://backend:3000/api/weather/favourites";
$backendUrlRValues = "http://backend:3000/api/radiation/rvalue";
$backendUrlExternalRadiation = "http://backend:3000/api/radiation/external";
$backendUrlNuclides = "http://backend:3000/api/radiation/nuclides";


// set timestamps to query
$timestamp = isset($_GET["time"]) ? $_GET["time"] : "now";

if ($timestamp && $timestamp !== "now") {
	$backendUrlWeather .= "?time=" . urlencode($timestamp);
	$backendUrlExternalRadiation .= "?time=" . urlencode($timestamp);
	$backendUrlNuclides .= "?time=" . urlencode($timestamp);
}

// Utility function to fetch multiple URLs in parallel using cURL multihandles
function fetchMultiple($urls) {
	error_log("Fetching multiple URLs in parallel...");
	$multiHandle = curl_multi_init();
	$curlHandles = [];

	foreach ($urls as $key => $url) {
		$ch = curl_init($url);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true); // Return response as string
		curl_setopt($ch, CURLOPT_TIMEOUT, 60); // 60 second timeout
		curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10); // 10 second connection timeout
		curl_multi_add_handle($multiHandle, $ch);
		$curlHandles[$key] = $ch;
	}

	do {
		$status = curl_multi_exec($multiHandle, $active);
		if ($active) {
			curl_multi_select($multiHandle);
		}
	} while ($active && $status == CURLM_OK);

	$results = [];
    foreach ($curlHandles as $key => $ch) {
			$content = curl_multi_getcontent($ch);

			if (curl_errno($ch)) {
				error_log("Error fetching URL for key '$key': " . curl_error($ch));
				$results[$key] = null;
			} else {
				error_log("$key HTTP status: " . curl_getinfo($ch, CURLINFO_HTTP_CODE));
        error_log("$key response length: " . strlen($content));
			}
			
			$results[$key] = $content;
		}

	curl_multi_close($multiHandle);
	return $results;
}

// use the utility function to fetch all data in parallel
$responses = fetchMultiple([
	"synop" => $backendUrlWeather,
	"rvalues" => $backendUrlRValues,
	"radiation" => $backendUrlExternalRadiation,
	"nuclides" => $backendUrlNuclides
]);
error_log("Responses fetched");

// Decode JSON responses into associative arrays, handling nulls
$synopArray = json_decode($responses["synop"], true) ?? [];
$rValuesArray = json_decode($responses["rvalues"], true) ?? [];
$externalRadiationArray = json_decode($responses["radiation"], true) ?? [];
$nuclidesArray = json_decode($responses["nuclides"], true) ?? [];

// error_log("synop data: " . $responses["synop"]); // debugging logs
// error_log("External radiation data: " . $responses["radiation"]); // debugging logs
// error_log("Nuclide data: " . $responses["nuclides"]); // debugging logs

error_log("Responses decoded, combining data...");
$combinedData = [
	...$synopArray,
	...$rValuesArray,
	...$externalRadiationArray,
	...$nuclidesArray
];
//error_log("Combined data array: " . json_encode($combinedData)); // debugging logs

error_log("Data combined, outputting JSON...");
print json_encode($combinedData);


// TÄSTÄ ALASPÄIN KAIKKEA EI VIELÄ LISÄTTY BACKENDIIN!!
// ÄLÄ POISTA ENNEKUIN KAIKKI TOIMII BACKENDISSÄ!!

/*
// road observations = tiesää
$roadSettings = array();
$roadSettings["stationtype"]    = "road";
$roadSettings["bbox"]           = "16.58,58.81,34.8,70.61,epsg::4326";
$roadData = $dataMiner->getRoadData($timestamp, $roadSettings, false);
error_log("road data handled");

// $roadData = $dataMiner->serializeData($roadData);
*/


// STUK observations = säteily
/*

error_log("Fetching external radiation data from backend...");
$radiationSettings = array();
$radiationSettings["stationtype"]    = "radiation";
$radiationSettings["parameters"]     = "DR_PT10M_avg";
$radiationSettings["storedquery_id"] = "stuk::observations::external-radiation::latest::multipointcoverage";
$radiationData = $dataMiner->multipointcoverage($timestamp, $radiationSettings, false);
error_log("External radiation data: " . $radiationData); // debugging logs




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

$combinedData = array_merge($synopdata, $roadData, $radiationData, $airRadioData, $R_Values);
error_log("data combined");

print json_encode($combinedData);
*/


