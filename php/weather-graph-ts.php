<?php
ob_start();
error_reporting(0);
set_time_limit(300);
require_once("dataMiner.php");

$output = '';
try {
    $latlon      = filter_input(INPUT_GET, 'latlon', FILTER_SANITIZE_FULL_SPECIAL_CHARS);
    $fmisid      = filter_input(INPUT_GET, 'fmisid', FILTER_SANITIZE_FULL_SPECIAL_CHARS);
    $type        = filter_input(INPUT_GET, 'type', FILTER_SANITIZE_FULL_SPECIAL_CHARS);
    $timestamp   = filter_input(INPUT_GET, 'timestamp', FILTER_SANITIZE_FULL_SPECIAL_CHARS);

    $dataMiner = new DataMiner();
    $data = [];
    if ($type == 'road') {
        $settings = array();
        $settings["stationtype"]    = "road";
        $settings["parameters"]     = "ws,wg,wd,vis,prst1,ta,pri";
        $settings["storedquery_id"] = "livi::observations::road::default::multipointcoverage";
        $settings["fmisid"]         = $fmisid;

        $obs = $dataMiner->multipointcoverage($timestamp,$settings,true);
        $observationData = [];
        foreach ( $obs as $key => $observation ) {

            $tmp = $observation;
            $tmp["datatype"] = "observation";
            $tmp["station"] = "synop";
            $tmp["ws_10min"] = $observation['ws'];
            $tmp["wg_10min"] = $observation['wg'];
            $tmp["wd_10min"] = $observation['wd'];
            $tmp["t2m"] = $observation['ta'];
            unset($tmp["ws"]);
            unset($tmp["wg"]);
            unset($tmp["wd"]);
            unset($tmp["ta"]);
            array_push($observationData,$tmp);
        }

        $obs = $observationData;

    }
    if ($type == 'synop') {

      $obs = [];
      // If cached timeseries is too short, use FMI fallback for a full graph window
      $minCachedPointsForGraph = 24;
      $requestTime = $timestamp ?? 'now';
      $backendUrl = "http://backend:3000/api/weather/favourites/graph?fmisid=" . urlencode($fmisid) . "&time=" . urlencode($timestamp ?? 'now');
      $backendResponse = @file_get_contents($backendUrl);
      if ($backendResponse !== false) {
        $cachedObs = json_decode($backendResponse, true);
        if (is_array($cachedObs) && count($cachedObs) >= $minCachedPointsForGraph) {
          $obs = $cachedObs;
          error_log("[weather-graph-ts] synop graph source=cache fmisid={$fmisid} time={$requestTime} points=" . count($cachedObs));
        } else {
          $count = is_array($cachedObs) ? count($cachedObs) : 0;
          error_log("[weather-graph-ts] synop cache too small fmisid={$fmisid} time={$requestTime} points={$count} min={$minCachedPointsForGraph}");
        }
      } else {
        error_log("[weather-graph-ts] synop cache request failed fmisid={$fmisid} time={$requestTime}");
      }

      // Fallback to direct FMI fetch if this station has no cached data yet
      // or if cached data has too few points for a sensible graph
      if (empty($obs)) {

        $settings = array();
        $settings["stationtype"]    = "synop";
        $settings["parameters"]     = "ws_10min,wg_10min,wd_10min,t2m,n_man,r_1h,vis";
        $settings["storedquery_id"] = "fmi::observations::weather::multipointcoverage";
        $settings["timestep"]       = "10";
        $settings["fmisid"]         = $fmisid;

        error_log("[weather-graph-ts] synop graph source=fmi fmisid={$fmisid} time={$requestTime}");
        $obs = $dataMiner->multipointcoverage($timestamp,$settings,true);
      }

        $snowSettings = array();
        $snowSettings["parameters"]     = "snow";
        $snowSettings["storedquery_id"] = "fmi::observations::weather::daily::multipointcoverage";
        $snowSettings["fmisid"]         = $fmisid;

        try {
            $snowObs = $dataMiner->multipointcoverage($timestamp,$snowSettings,true,21);
        } catch (Exception $e) {
            $snowObs = [];
        }
    }

    if ($type == 'radiation') {
        $settings = array();
        $settings["stationtype"]    = "radiation";
        $settings["parameters"]     = "DR_PT10M_avg";
        $settings["storedquery_id"] = "stuk::observations::external-radiation::multipointcoverage";
        $settings["fmisid"]         = $fmisid;
        $settings["timestep"]       = "10";

        $obs = $dataMiner->multipointcoverage($timestamp,$settings,true);
      /* this does not work yet... TODO
        $url = "http://backend:3000/api/radiation/external/" . $fmisid . "?time=" . urlencode($timestamp);
        $response = file_get_contents($url);
        $obs = json_decode($response, true) ?? [];
        error_log("Radiation Obs: " . $response);
        */
    }

    if ($type == 'air_radio') {
        $settings = array();
        $settings["storedquery_id"] = "stuk::observations::air::radionuclide-activity-concentration::multipointcoverage";
        $settings["fmisid"] = $fmisid;

        $obs = $dataMiner->nuclideMultipointcoverage($timestamp, $settings, true);
    }

    if ($type == 'magnetometer') {

        $settings = array();
        $settings["parameters"]     = "MAGNX_PT1M_AVG,MAGNY_PT1M_AVG,MAGNZ_PT1M_AVG";
        $settings["storedquery_id"] = "fmi::observations::magnetometer::simple";
        $settings["bbox"]           = "16.58,58.81,34.8,70.61,epsg::4326";
        $settings["timestep"]       = "10";

        $obs = $dataMiner->magnetometer($timestamp,$settings,true);

        // magnetometer data can not be filtered in api call so we need to filter it here
        foreach ($obs as $key => $data) {
          if ($data['fmisid'] !== $fmisid) {
            unset($obs[$key]);
          }
        }
        $obs = array_values($obs); // reindex array after unsetting
    }

    $combinedData = [];
    $combinedData["obs"] = $obs;
    $combinedData["for"] = [];

    $combinedData = calcCumulativeSum($combinedData);
    // Only calculate wind directions if we have wind data
    $hasWindData = false;
    if(!empty($combinedData["obs"])) {
        $hasWindData = isset($combinedData["obs"][0]['ws_10min']) || isset($combinedData["obs"][0]['wd_10min']);
    }
    $winddirections = $hasWindData ? resolveWindDirection($combinedData) : [];
    $result = formatHighChart($combinedData, $winddirections);

    if (!empty($snowObs)) {
        $result['obs']['snow_aws'] = [];
        foreach ($snowObs as $obs) {
            $val = isset($obs['snow_aws']) ? $obs['snow_aws'] : (isset($obs['snow']) ? $obs['snow'] : null);
            if ($val !== null && $val > 0) {
                $result['obs']['snow_aws'][] = [$obs['epochtime'] * 1000, floatval($val)];
            } else {
                $result['obs']['snow_aws'][] = [$obs['epochtime'] * 1000, null];
            }
        }
    }

    $output = json_encode($result);
} catch (Exception $e) {
    $output = json_encode(array('error' => $e->getMessage()));
}

ob_end_clean();
header('Content-Type: application/json');
echo $output;

/**
 *
 * Calculate cumulative precipitation
 * @param    data as php aarray
 * @return   data as javascript array string
 *
 */

function calcCumulativeSum($data) {
    $precSum = 0;
    $tmpData = [];
    foreach($data["obs"] as $observation) {
        $tmp = $observation;
        if(isset($observation["r_1h"]) && is_numeric($observation["r_1h"])) {
            $precSum = round($precSum + $observation["r_1h"],1);
        }
        $tmp["rr1h_calc"] = $precSum;
        array_push($tmpData,$tmp);
    }
    $data["obs"] = $tmpData;
    return $data;
}

  function normalizeDataKey($key) {
    return strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $key));
  }

  function getNormalizedValue($array, $normalized, $aliases) {
    foreach ($aliases as $alias) {
      if (array_key_exists($alias, $normalized)) {
        return $normalized[$alias];
      }
      if (array_key_exists($alias, $array)) {
        return $array[$alias];
      }
    }

    $primary = $aliases[0];
    foreach ($normalized as $key => $value) {
      if (strpos($key, $primary) !== false) {
        return $value;
      }
    }

    return null;
  }


function resolveWindDirection($data) {
  $dir = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW"
  ];

  $speed = [
    0 => ["Tyyntä", 0, "#ffffff"],
    1 => ["Heikkoa", 1, "#e6f7ff"],
    2 => ["Kohtalaista", 4, "#ccffcc"], 
    3 => ["Navakkaa", 7, "#ffff99"],
    4 => ["Kovaa", 14, "#ffcc00"],
    5 => ["Myrskyä", 21, "#ff3300"],
    6 => ["Kovaa myrskyä", 25, "#ff0066"],
    7 => ["Ankaraa myrskyä", 28, "#cc0099"],
    8 => ["Hirmymyrskyä", 32, "#6600cc"]
  ];

  $values = [];
  foreach($speed as $key => $value) {
    $values[$key] = [];
    $values[$key]['name'] = $speed[$key][0];
    $values[$key]['fillColor'] = $speed[$key][2];   
    $values[$key]['data'] = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];

  };

  // count valid wind observations
  $valid = 0;
  foreach($data['obs'] as $key => $observation) {
    if(is_numeric($observation['ws_10min'])) {
      $valid++;
    }
  }

  $x=1;  
  for($z=0; $z<9; $z++) {
    for($i=0; $i<16; $i++) {
      $k=0;
      foreach($data['obs'] as $key => $observation) {
        $dirIndex = (int)round($observation['wd_10min']/22.5) % 16;
        if($dir[$dirIndex] === $dir[$i] && ($observation['ws_10min'] > $speed[$x-1][1] && $observation['ws_10min'] <= $speed[$x][1]) ) {
          $k++;
        }
      }
      if($valid > 0) {
        $values[$z]['data'][$i] = round(100*($k/$valid),1);
      } else {
        $values[$z]['data'][$i] = 0;
      }
    }
    $x++;
  }

  return $values;
}

/**
 *
 * Format data as a javascript array
 * @param    data as php aarray
 * @return   data as javascript array string
 *
 */


function formatHighChart($data, $winddirections) {
    // print json_encode($data);

    $formattedData = [];
    $formattedData["obs"] = [];
    $formattedData["for"] = [];
    foreach($formattedData as $key => $array) {
      $formattedData[$key]["wind"] = [];
      $formattedData[$key]["windrose"] = [];
      $formattedData[$key]["dir"] = [];
      $formattedData[$key]["rr1h"] = [];
      $formattedData[$key]["vis"] = [];
      $formattedData[$key]["n_man"] = [];
      $formattedData[$key]["temp"] = [];
      $formattedData[$key]["rr1h_calc"] = [];
      $formattedData[$key]["radiation"] = [];
      $formattedData[$key]["pb210"] = [];
      $formattedData[$key]["be7"] = [];
      $formattedData[$key]["cs137"] = [];
      $formattedData[$key]["magn_x"] = [];
      $formattedData[$key]["magn_y"] = [];
      $formattedData[$key]["magn_z"] = [];
      $formattedData[$key]["snow_aws"] = [];
    }

    foreach($data as $key => $dataArray) {
      $i = 0;
      foreach($dataArray as $array) {
        $normalized = [];
        foreach ($array as $k => $v) {
          $normalized[normalizeDataKey($k)] = $v;
        }

        $pb210Value = getNormalizedValue($array, $normalized, [
          'pb210',
          'pb210activityconcentration',
          'pb210activityconc',
          'pb210activity'
        ]);
        $be7Value = getNormalizedValue($array, $normalized, [
          'be7',
          'be7activityconcentration',
          'be7activityconc',
          'be7activity'
        ]);
        $cs137Value = getNormalizedValue($array, $normalized, [
          'cs137',
          'cs137activityconcentration',
          'cs137activityconc',
          'cs137activity'
        ]);
        // wind
        if(!empty($array['ws_10min'])) {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, $array['ws_10min']);
          array_push($tmp, $array['wg_10min']);
          array_push($formattedData['obs']['wind'], $tmp);
        } else {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, null);
          array_push($tmp, null);
          array_push($formattedData['obs']['wind'], $tmp);
        }

        // dir
        if(!empty($array['ws_10min']) && $i % 3 == 0) {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, $array['ws_10min']);
          array_push($tmp, $array['wd_10min']);
          array_push($formattedData['obs']['dir'], $tmp);
        } else {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, null);
          array_push($tmp, null);
          array_push($formattedData['obs']['dir'], $tmp);
        }

        // rr1h
        if(!empty($array['rr_1h'])) {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, $array['rr_1h']);
          array_push($formattedData['obs']['rr1h'], $tmp);
        } else {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, null);
          array_push($formattedData['obs']['rr1h'], $tmp);
        }

        // vis
        if(!empty($array['vis'])) {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, $array['vis']);
          array_push($formattedData['obs']['vis'], $tmp);
        } else {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, null);
          array_push($formattedData['obs']['vis'], $tmp);
        }

        // n_man
        if(!empty($array['n_man'])) {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, $array['n_man']);
          array_push($formattedData['obs']['n_man'], $tmp);
        } else {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, null);
          array_push($formattedData['obs']['n_man'], $tmp);
        }

        // temp
        if(!empty($array['t2m'])) {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, $array['t2m']);
          array_push($formattedData['obs']['temp'], $tmp);
        } else {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, null);
          array_push($formattedData['obs']['temp'], $tmp);
        }

        // rr1h_calc
        if(!empty($array['rr1h_calc'])) {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, $array['rr1h_calc']);
          array_push($formattedData['obs']['rr1h_calc'], $tmp);
        } else {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, null);
          array_push($formattedData['obs']['rr1h_calc'], $tmp);
        }

        // snow_aws
        if(isset($array['snow_aws']) && $array['snow_aws'] !== null && $array['snow_aws'] !== '') {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, floatval($array['snow_aws']));
          array_push($formattedData['obs']['snow_aws'], $tmp);
        } else {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, null);
          array_push($formattedData['obs']['snow_aws'], $tmp);
        }

        // radiation (DR_PT10M_avg)
        if(isset($array['DR_PT10M_avg']) && $array['DR_PT10M_avg'] !== null) {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, $array['DR_PT10M_avg']);
          array_push($formattedData['obs']['radiation'], $tmp);
        } else {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, null);
          array_push($formattedData['obs']['radiation'], $tmp);
        }

        // Pb-210
        if($pb210Value !== null) {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, $pb210Value);
          array_push($formattedData['obs']['pb210'], $tmp);
        }

        // Be-7
        if($be7Value !== null) {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, $be7Value);
          array_push($formattedData['obs']['be7'], $tmp);
        }

        // Cs-137
        if($cs137Value !== null) {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, $cs137Value);
          array_push($formattedData['obs']['cs137'], $tmp);
        }

        // Magnetometer X
        if(!empty($array['X'])) {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, $array['X']);
          array_push($formattedData['obs']['magn_x'], $tmp);
        } else {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, null);
          array_push($formattedData['obs']['magn_x'], $tmp);
        }
        // Magnetometer Y
        if(!empty($array['Y'])) {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, $array['Y']);
          array_push($formattedData['obs']['magn_y'], $tmp);
        } else {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, null);
          array_push($formattedData['obs']['magn_y'], $tmp);
        }
        // Magnetometer Z
        if(!empty($array['Z'])) {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, $array['Z']);
          array_push($formattedData['obs']['magn_z'], $tmp);
        } else {
          $tmp = [];
          array_push($tmp, $array['epochtime']*1000);
          array_push($tmp, null);
          array_push($formattedData['obs']['magn_z'], $tmp);
        }

        $i++;
      }
    }

    // Lajittele päivämäärän mukaan (indeksi 0 = epochtime ms)
    usort($formattedData['obs']['pb210'], fn($a, $b) => $a[0] <=> $b[0]);
    usort($formattedData['obs']['be7'],   fn($a, $b) => $a[0] <=> $b[0]);
    usort($formattedData['obs']['cs137'], fn($a, $b) => $a[0] <=> $b[0]);

    $formattedData['obs']['windrose'] = $winddirections;

    return $formattedData;

}