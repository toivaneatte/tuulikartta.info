/*
Description: Parses FMI multipointcoverage XML into an array of observation
objects. Uses the logic of dataMiner.php multipointcoverage but in JS.
Uses xml2js which is a project dependency.
*/

const xml2js = require('xml2js');
const xmlParser = new xml2js.Parser();

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

  members.forEach(member => {
    const obs = member['omso:GridSeriesObservation'][0];

    // Station names + fmisids
    const stationMembers = obs['om:featureOfInterest'][0]
      ['sams:SF_SpatialSamplingFeature'][0]['sam:sampledFeature'][0]
      ['target:LocationCollection'][0]['target:member'];

    const stations = stationMembers.map(s => {
      const loc = s['target:Location'][0];
      return {
        name: loc['gml:name'][0]._,
        fmisid: parseInt(loc['gml:identifier'][0]._, 10)
      };
    });

    // Station coordinates as strings, for example: "61.418 23.604"
    const pointMembers = obs['om:featureOfInterest'][0]
      ['sams:SF_SpatialSamplingFeature'][0]['sams:shape'][0]
      ['gml:MultiPoint'][0]['gml:pointMember'];

    const coords = pointMembers.map(p =>
      p['gml:Point'][0]['gml:pos'][0].trim()
    );

    //  Positions block: each line is "lat lon epoch"
    const positionsRaw = obs['om:result'][0]
      ['gmlcov:MultiPointCoverage'][0]['gml:domainSet'][0]
      ['gmlcov:SimpleMultiPoint'][0]['gmlcov:positions'][0];

    const positionRows = positionsRaw.trim().split('\n')
      .map(r => r.trim()).filter(r => r.length > 0);

    // 4. Values block: each line has one value per parameter
    const valuesRaw = obs['om:result'][0]
      ['gmlcov:MultiPointCoverage'][0]['gml:rangeSet'][0]
      ['gml:DataBlock'][0]['gml:doubleOrNilReasonTupleList'][0];

    const valueRows = valuesRaw.trim().split('\n')
      .map(r => r.trim()).filter(r => r.length > 0);

    // 5. Combine: one result row per position row
    positionRows.forEach((posRow, i) => {
      const parts = posRow.split(/\s+/);
      const lat = parseFloat(parts[0]);
      const lon = parseFloat(parts[1]);
      const epoch = parseInt(parts[2], 10);
      const timestamp = new Date(epoch * 1000).toISOString();

      // Match station by coordinate proximity
      const stationIdx = coords.findIndex(c => {
        const cp = c.split(/\s+/);
        return Math.abs(parseFloat(cp[0]) - lat) < 0.01 &&
               Math.abs(parseFloat(cp[1]) - lon) < 0.01;
      });
      const station = stationIdx >= 0
        ? stations[stationIdx]
        : stations[i % stations.length];

      // Parse measurement values for this row
      const vals = valueRows[i]?.split(/\s+/) ?? [];
      const measurements = {};
      paramList.forEach((param, idx) => {
        const v = parseFloat(vals[idx]);
        measurements[param] = isNaN(v) ? null : v;
      });

      // return station name, fmisid, lat, lon, timestamp, measurements and type (if provided)
      results.push({
        fmisid: station.fmisid,
        station: station.name,
        timestamp,
        lat,
        lon,
        type,
        ...measurements
      });
    });
  });

  return results;
};

module.exports = { parseFMIMultipointcoverage };
