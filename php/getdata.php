<?php
require_once("dataMiner.php");
date_default_timezone_set('Europe/Helsinki');

header('Content-Type: application/json');

// URLs for backend API endpoints: weather, radioation and cameras.
$backendUrlWeather = isset($_GET["favourites"]) && $_GET["favourites"] === "1"
  ? "http://backend:3000/api/weather/favourites"
  : "http://backend:3000/api/weather/latest";
$backendUrlRValues = "http://backend:3000/api/radiation/rvalue";
$backendUrlExternalRadiation = "http://backend:3000/api/radiation/external";
$backendUrlNuclides = "http://backend:3000/api/radiation/nuclides";
$backendUrlRoadObs = "http://backend:3000/api/road/obs";

// set timestamps to query
$timestamp = isset($_GET["time"]) ? $_GET["time"] : "now";

if ($timestamp && $timestamp !== "now") {
	$backendUrlWeather .= "?time=" . urlencode($timestamp);
	$backendUrlExternalRadiation .= "?time=" . urlencode($timestamp);
	$backendUrlNuclides .= "?time=" . urlencode($timestamp);
	$backendUrlRoadObs .= "?time=" . urlencode($timestamp);
}

// Create an instance of DataMiner to fetch magnetometer data
// TODO: Refactor to use backend
$dataMiner = new DataMiner();

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
	$statuses = [];
	foreach ($curlHandles as $key => $ch) {
		$content = curl_multi_getcontent($ch);
		if (curl_errno($ch)) {
			error_log("Error fetching URL for key '$key': " . curl_error($ch));
			$results[$key] = null;
			$statuses[$key] = 0;
		} else {
			$results[$key] = $content;
			$statuses[$key] = curl_getinfo($ch, CURLINFO_HTTP_CODE);
		}
		curl_multi_remove_handle($multiHandle, $ch);
	}

	curl_multi_close($multiHandle);
	return ['content' => $results, 'statuses' => $statuses];
}

// use the utility function to fetch all data in parallel
$fetched = fetchMultiple([
	"synop" => $backendUrlWeather,
	"rvalues" => $backendUrlRValues,
	"radiation" => $backendUrlExternalRadiation,
	"nuclides" => $backendUrlNuclides,
	"roadobs" => $backendUrlRoadObs
]);
$responses = $fetched['content'];
$statuses  = $fetched['statuses'];
error_log("Responses fetched");

// Earth's magnetic field
// TODO: Refactor to use backend
$magnSettings = array();
$magnSettings["parameters"]     = "MAGNX_PT1M_AVG,MAGNY_PT1M_AVG,MAGNZ_PT1M_AVG";
$magnSettings["storedquery_id"] = "fmi::observations::magnetometer::simple";
$magnSettings["bbox"]           = "16.58,58.81,34.8,70.61,epsg::4326";
$magnSettings["timestep"]       = "10";
$magnData = $dataMiner->magnetometer($timestamp, $magnSettings, false) ?? [];
error_log("magnetometer data handled");

// Decode JSON responses into associative arrays, handling nulls
$synopDecoded = json_decode($responses["synop"], true);
if ($synopDecoded && isset($synopDecoded['error'])) {
	http_response_code(502);
	echo json_encode(['error' => $synopDecoded['error']]);
	exit;
}
$synopArray = $synopDecoded ?? [];
$rValuesArray = json_decode($responses["rvalues"], true) ?? [];
$externalRadiationArray = json_decode($responses["radiation"], true) ?? [];
$nuclidesArray = json_decode($responses["nuclides"], true) ?? [];
$roadArray = json_decode($responses["roadobs"], true) ?? [];
error_log("Responses decoded");

// Build warnings for failed secondary sources
$warnings = [];
$sourceLabels = [
	"rvalues"   => "Avaruussäädata ei saatavilla",
	"radiation" => "Säteilydata ei saatavilla",
	"nuclides"  => "Nuklidimittaukset ei saatavilla",
	"roadobs"   => "Tiesääasemien data ei saatavilla",
];
foreach ($sourceLabels as $key => $label) {
	if ($statuses[$key] !== 200) {
		$warnings[] = $label;
	}
}

// error_log("synop data: " . $responses["synop"]); // debugging logs
// error_log("R value data: " . $responses["rvalues"]); // debugging logs
// error_log("External radiation data: " . $responses["radiation"]); // debugging logs
// error_log("Nuclide data: " . $responses["nuclides"]); // debugging logs

error_log("Responses decoded, combining data...");
$combinedData = [
	...$synopArray,
	...$rValuesArray,
	...$externalRadiationArray,
	...$nuclidesArray,
	...$roadArray,
	...$magnData
];
//error_log("Combined data array: " . json_encode($combinedData)); // debugging logs

error_log("Data combined, outputting JSON...");
print json_encode(['data' => $combinedData, 'warnings' => $warnings]);
