/*
Description: Parses FMI multipointcoverage XML into an array of observation
objects. Uses the logic of dataMiner.php multipointcoverage but in JS.
Uses xml2js which is a project dependency.
*/

const xml2js = require('xml2js');
const logger = require('./logger');
const xmlParser = new xml2js.Parser({
  explicitArray: true,
});

/*
 * parseFMIMultipointcoverage
 * @param {string} xmlString  - raw XML from FMI API
 * @param {string} parameters - comma-separated parameter names matching the order
 *                              they appear in the XML (e.g. 'ws_10min,wd_10min,...')
 * @param {string|null} type - optional type to include in the output (e.g. "radiation")
 * @returns {Array} array of observation objects, one per station per timestamp
 */
const parseFMIMultipointcoverage = async (xmlString, parameters, type = null) => {
  const parsedData = await xmlParser.parseStringPromise(xmlString);
  const members = parsedData['wfs:FeatureCollection']['wfs:member'];
  const paramList = parameters.split(',');
  const results = [];

  members.forEach((member) => {
    const obs = member['omso:GridSeriesObservation'][0];

    // Station names + fmisids
    const stationMembers =
      obs['om:featureOfInterest'][0]['sams:SF_SpatialSamplingFeature'][0]['sam:sampledFeature'][0][
        'target:LocationCollection'
      ][0]['target:member'];

    const stations = stationMembers.map((s) => {
      const loc = s['target:Location'][0];
      return {
        name: loc['gml:name'][0]._,
        fmisid: parseInt(loc['gml:identifier'][0]._, 10),
      };
    });

    // Station coordinates as strings, for example: "61.418 23.604"
    const pointMembers =
      obs['om:featureOfInterest'][0]['sams:SF_SpatialSamplingFeature'][0]['sams:shape'][0][
        'gml:MultiPoint'
      ][0]['gml:pointMember'];

    const coords = pointMembers.map((p) => p['gml:Point'][0]['gml:pos'][0].trim());

    //  Positions block: each line is "lat lon epoch"
    const positionsRaw =
      obs['om:result'][0]['gmlcov:MultiPointCoverage'][0]['gml:domainSet'][0][
        'gmlcov:SimpleMultiPoint'
      ][0]['gmlcov:positions'][0];

    const positionRows = positionsRaw
      .trim()
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    // 4. Values block: each line has one value per parameter
    const valuesRaw =
      obs['om:result'][0]['gmlcov:MultiPointCoverage'][0]['gml:rangeSet'][0]['gml:DataBlock'][0][
        'gml:doubleOrNilReasonTupleList'
      ][0];

    const valueRows = valuesRaw
      .trim()
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    // 5. Combine: one result row per position row
    positionRows.forEach((posRow, i) => {
      const parts = posRow.split(/\s+/);
      const lat = parseFloat(parts[0]);
      const lon = parseFloat(parts[1]);
      const epoch = parseInt(parts[2], 10);
      const timestamp = new Date(epoch * 1000).toISOString();

      // Match station by coordinate proximity
      const stationIdx = coords.findIndex((c) => {
        const cp = c.split(/\s+/);
        return Math.abs(parseFloat(cp[0]) - lat) < 0.01 && Math.abs(parseFloat(cp[1]) - lon) < 0.01;
      });
      const station = stationIdx >= 0 ? stations[stationIdx] : stations[i % stations.length];

      // Parse measurement values for this row
      const vals = valueRows[i]?.split(/\s+/) ?? [];
      const measurements = {};
      paramList.forEach((param, idx) => {
        const v = parseFloat(vals[idx]);
        measurements[param] = isNaN(v) ? null : v;
      });

      // return station name, fmisid, lat, lon, timestamp, epochtime, measurements and type (if provided)
      results.push({
        fmisid: station.fmisid,
        station: station.name,
        timestamp,
        epochtime: epoch,
        lat,
        lon,
        type,
        ...measurements,
      });
    });
  });

  return results;
};

/**
 *
 * @param {*} xmlString
 * @returns
 */
const parseNuclideMultipointcoverage = async (xmlString) => {
  const parsedData = await xmlParser.parseStringPromise(xmlString);

  const membersRaw = parsedData?.['wfs:FeatureCollection']?.['wfs:member'];

  const members = Array.isArray(membersRaw) ? membersRaw : membersRaw ? [membersRaw] : [];

  const airRadioByKey = {};

  // start by iterating through all members (observations)
  logger.debug(`Parsing nuclide multipointcoverage, number of members: ${members.length}`);
  for (const member of members) {
    // Extract core fields once per member, since they are needed for all parameters
    const obs = member['omso:PointObservation']?.[0];
    if (!obs) continue;

    const foi = obs['om:featureOfInterest']?.[0]?.['sams:SF_SpatialSamplingFeature']?.[0];

    const location = foi?.['sam:sampledFeature']?.[0]?.['target:Location']?.[0];

    const name = location?.['gml:name']?.[0]?._ || '';
    const fmisidRaw = location?.['gml:identifier']?.[0]?._;
    const fmisid = fmisidRaw ? parseInt(fmisidRaw) : null;

    const timeValue =
      obs['om:phenomenonTime']?.[0]?.['gml:TimePeriod']?.[0]?.['gml:endPosition']?.[0] || '';

    let epochTime = timeValue ? Math.floor(new Date(timeValue).getTime() / 1000) : null;

    // --- Coordinates ---
    let lat = null;
    let lon = null;

    const pos = foi?.['sams:shape']?.[0]?.['gml:Point']?.[0]?.['gml:pos']?.[0];

    if (pos) {
      const parts = pos.trim().split(/\s+/);
      if (parts.length >= 2) {
        lon = parseFloat(parts[0]);
        lat = parseFloat(parts[1]);

        if (lat < 40 && lon > 40) {
          [lat, lon] = [lon, lat];
        }
      }
    }

    if (lat == null || lon == null) continue;

    // --- Key ---
    const key = fmisid !== null ? fmisid : `${parseFloat(lat)},${parseFloat(lon)}`;

    // --- Init station if needed ---
    if (!airRadioByKey[key]) {
      airRadioByKey[key] = {
        station: name,
        fmisid,
        lat,
        lon,
        time: timeValue,
        epochtime: epochTime,
        type: 'air_radio',
        'Pb-210': null,
        'Be-7': null,
        'Cs-137': null,
        _ep_Pb210: null,
        _ep_Be7: null,
        _ep_Cs137: null,
      };
    }

    // --- Parameters & values ---
    const fields =
      obs['om:result']?.[0]?.['gmlcov:MultiPointCoverage']?.[0]?.['gmlcov:rangeType']?.[0]?.[
        'swe:DataRecord'
      ]?.[0]?.['swe:field'] || [];

    const tupleText =
      obs['om:result']?.[0]?.['gmlcov:MultiPointCoverage']?.[0]?.['gml:rangeSet']?.[0]?.[
        'gml:DataBlock'
      ]?.[0]?.['gml:doubleOrNilReasonTupleList']?.[0] || '';

    const values = tupleText.trim() ? tupleText.trim().split(/\s+/) : [];

    const nuclideEpochs = {
      'Pb-210': '_ep_Pb210',
      'Be-7': '_ep_Be7',
      'Cs-137': '_ep_Cs137',
    };

    for (let i = 0; i < fields.length; i++) {
      const paramName = fields[i]?.$?.name;
      if (!paramName || !(paramName in nuclideEpochs)) continue;

      let val = values[i] ?? null;

      if (val === '' || String(val).toLowerCase() === 'nan') {
        val = null;
      } else if (!isNaN(val)) {
        val = parseFloat(val);
      }

      if (val !== null) {
        const epochKey = nuclideEpochs[paramName];
        const stored = airRadioByKey[key][epochKey];

        if (stored === null || epochTime > stored) {
          airRadioByKey[key][paramName] = val;
          airRadioByKey[key][epochKey] = epochTime;
        }
      }
    }
  }

  // --- Final cleanup ---
  return Object.values(airRadioByKey).map((row) => {
    delete row._ep_Pb210;
    delete row._ep_Be7;
    delete row._ep_Cs137;
    return row;
  });
};

module.exports = { parseFMIMultipointcoverage, parseNuclideMultipointcoverage };
