<?php
date_default_timezone_set('Europe/Helsinki');

header('Content-Type: application/json');

// URLs for backend API endpoints: weather, radioation and cameras.
$backendUrlWeather = "http://backend:3000/api/weather/latest";
//$backendUrlWeather = "http://backend:3000/api/weather/favourites";
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
	"nuclides" => $backendUrlNuclides,
	"roadobs" => $backendUrlRoadObs
]);
error_log("Responses fetched");

// Decode JSON responses into associative arrays, handling nulls
$synopArray = json_decode($responses["synop"], true) ?? [];
$rValuesArray = json_decode($responses["rvalues"], true) ?? [];
$externalRadiationArray = json_decode($responses["radiation"], true) ?? [];
$nuclidesArray = json_decode($responses["nuclides"], true) ?? [];
$roadArray = json_decode($responses["roadobs"], true) ?? [];
error_log("Responses decoded");

// error_log("synop data: " . $responses["synop"]); // debugging logs
// error_log("External radiation data: " . $responses["radiation"]); // debugging logs
// error_log("Nuclide data: " . $responses["nuclides"]); // debugging logs

error_log("Responses decoded, combining data...");
$combinedData = [
	...$synopArray,
	...$rValuesArray,
	...$externalRadiationArray,
	...$nuclidesArray,
	...$roadArray
];
//error_log("Combined data array: " . json_encode($combinedData)); // debugging logs

error_log("Data combined, outputting JSON...");
print json_encode($combinedData);
