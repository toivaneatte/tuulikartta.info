<?php

/**
 * DataMiner class
 * @author Ville Ilkka
 */

  function setTime($timestamp, $graph) {
    $url = "";
    if($graph) {
      if ( $timestamp === "now" ) {
        $endtime = new DateTime();
        $end     = $endtime->format('Y-m-d\TH:i:s\Z');
        $start   = $endtime->sub(new DateInterval('PT24H'));
        $start   = $start->format('Y-m-d\TH:i:s\Z');
        
        $url     = "&starttime={$start}&endtime={$end}";
      } else {
        $endtime = new DateTime($timestamp);
        $end     = $endtime->format('Y-m-d\TH:i:s\Z');
        $start   = $endtime->sub(new DateInterval('PT24H'));
        $start   = $start->format('Y-m-d\TH:i:s\Z');

        $url     = "&starttime={$start}&endtime={$end}";
      }

    } else {
      if ( $timestamp === "now" ) {
        $start  = new DateTime('', new DateTimezone('Europe/Helsinki'));
        $start->setTime(0,0);
        $start->setTimezone(new DateTimeZone('UTC'));
        $start  = $start->format('Y-m-d\TH:i:s\Z');
        $url    = "&starttime={$start}";
      } else {
        $endtime = new DateTime('@' . $timestamp, new DateTimeZone('UTC'));
        $end     = $endtime->format('Y-m-d\TH:i:s\Z');
        $endtime->setTimezone(new DateTimeZone('Europe/Helsinki'));

        $starttime = $endtime->setTime(0,0);
        $starttime->setTimezone(new DateTimeZone('UTC'));
        $start     = $starttime->format('Y-m-d\TH:i:s\Z');

        $url     = "&starttime={$start}&endtime={$end}";
      }
    }
    return $url;
  }

  /**
  *
  * Parse observation data from WFS multipointcoverage
  * @param    timestamp timestamp or now if latest observations
  * @param    settings array that contains required query parameters
  * @return   graph true if graph dat request
  *
  */

  function multipointcoverage($timestamp,$settings,$graph) {
      date_default_timezone_set("UTC");

      $url = "";
      $url .= "http://opendata.fmi.fi/wfs?request=getFeature";

      foreach($settings as $key => $value) {
        $url .= "&{$key}={$value}";
      }

      $url = $url . setTime($timestamp, $graph);

      // print URL for testing
      print_r("\n----\nThis is URL: " . $url . "\n----\n");

      $ctx = stream_context_create(array('http'=>
          array(
              'timeout' => 240,  //1200 Seconds is 20 Minutes
          )
      ));
      $xmlData = file_get_contents($url, false, $ctx);
      if($xmlData == false) {
          return [];
      }
      if($xmlData == "") {
          return [];
      }

      $resultString = simplexml_load_string($xmlData);

      $result = array();
      $tmp = array();
      $final = [];

      $data = $resultString->children("wfs", true);
      $params = explode(",", $settings["parameters"]);

      $result1 = [];
      $result2 = [];
      foreach ($data->member as $key => $locations) {

          // station names and fmisid's
          $stations = $locations
                  -> children("omso", true)->GridSeriesObservation
                  -> children("om", true)->featureOfInterest
                  -> children("sams", true)->SF_SpatialSamplingFeature
                  -> children("sam", true)->sampledFeature
                  -> children("target", true)->LocationCollection->member;

          foreach ($stations as $station) {
              $tmp = [];
              $name = $station -> children ("target", true)->Location
                              -> children ("gml", true)->name;
              $fmisid = $station -> children ("target", true)->Location
                              -> children ("gml", true)->identifier;

              $tmp["station"] = (string)$name;
              $tmp["fmisid"] = (int)$fmisid;
              array_push($result1,$tmp);
          }

          // station names and coordinates
          $stations = $locations
                  -> children("omso", true)->GridSeriesObservation
                  -> children("om", true)->featureOfInterest
                  -> children("sams", true)->SF_SpatialSamplingFeature
                  -> children("sams", true)->shape
                  -> children("gml", true)->MultiPoint;

          foreach ($stations->pointMember as $station) {
              $tmp = [];
              $name = $station -> children ("gml", true)->Point
                              -> children ("gml", true)->name;
              $pos = $station  -> children ("gml", true)->Point
                              -> children ("gml", true)->pos;

              $tmp["station"] = (string)$name;
              $tmp["pos"] = (string)$pos;
              array_push($result2,$tmp);
          }

          // merge station arrays
          $stations = [];
          foreach($result1 as $key => $station) {
              $stations[$key] = array_merge($result1[$key],$result2[$key]);
          }

          // station coordinates and timestamps
          $latlons = $locations
                  -> children("omso", true)->GridSeriesObservation
                  -> children("om", true)->result
                  -> children("gmlcov", true)->MultiPointCoverage
                  -> children("gml", true)->domainSet
                  -> children("gmlcov", true)->SimpleMultiPoint
                  -> children("gmlcov", true)->positions;

          $latlons = explode("                ",(string)$latlons);
          $numberOfStations = count($latlons);
          $i = 0;
          $timestamps = [];
          foreach ($latlons as $latlon) {
              $tmp = [];
              if($i>0 && $i<($numberOfStations-1)) {
                  $latlon = explode(" ",(string)$latlon);
                  $tmp["lat"] = floatval($latlon[0]);
                  $tmp["lon"] = floatval($latlon[1]);
                  $epoch = str_replace("\n", "", $latlon[3]);
                  $tmp["epochtime"] = floatval($epoch);

                  // convert UNIX timestamp to time
                  $tmp["time"] = date("Y-m-d\TH:i:s\Z", intval($latlon[3]));
                  $tmp["type"] = $settings["stationtype"];
                  array_push($timestamps,$tmp);
              }
              $i++;
          }

          // combine station arrays as one
          $i = 0;
          $result = [];
          foreach($timestamps as $measurement) {
              $posstring = sprintf("%0.5f",$measurement["lat"])." ".sprintf("%0.5f",$measurement["lon"]). " ";
              if($posstring == $stations[$i]["pos"]) {
                  array_push($result,array_merge($stations[$i],$measurement));
              } else {
                  $i++;
                  array_push($result,array_merge($stations[$i],$measurement));
              }
          }

          // actual observations
          $parameters = explode(",",$settings["parameters"]);
          $observations = $locations
                  -> children("omso", true)->GridSeriesObservation
                  -> children("om", true)->result
                  -> children("gmlcov", true)->MultiPointCoverage
                  -> children("gml", true)->rangeSet
                  -> children("gml", true)->DataBlock
                  -> children("gml", true)->doubleOrNilReasonTupleList;

          $observations = explode("                ",(string)$observations);

          $tmp = [];
          foreach($observations as $key => $observation) {
              if($key > 0 and $key < (count($observations)-1))
              $tmp[$key] = explode(" ",$observation);
          }

          $observations = [];
          foreach($tmp as $observation) {
              for($x=0; $x<count($parameters); $x++) {
                  if(is_numeric($observation[$x]) === true) {
                      $tmp2[$parameters[$x]] = floatval($observation[$x]);
                  } else {
                      $tmp2[$parameters[$x]] = null;
                  }

              }
              array_push($observations,$tmp2);
          }

          // merge station data and observation arrays
          foreach($observations as $key => $observation) {
              array_push($final,array_merge($result[$key],$observations[$key]));
          }

      }
      return $final;
  }

  function main () {
    $settings = array();
    $settings["stationtype"]    = "synop";
    $settings["parameters"]     = "ri_10min,ws_10min,wg_10min,wd_10min,vis,wawa,t2m,n_man,r_1h,snow_aws,pressure,rh,dewpoint";
    $settings["storedquery_id"] = "fmi::observations::weather::multipointcoverage";
    $settings["bbox"]           = "16.58,58.81,34.8,70.61,epsg::4326";
    $settings["timestep"]       = "10";

    $timestamp = time();

    print_r("\n----\nThis is time: " . $timestamp . "\n----\n");

    $data = multipointcoverage($timestamp,$settings,false);
    print_r($data);
  }
 

main();
?>
