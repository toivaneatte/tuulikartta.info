/*
 * Tuulikartta.info - Traffic Layer Module
 * Digitraffic LAM (Liikenteen Automaattinen Mittaus) station data
 */

var saa = saa || {};
globalThis.saa = globalThis.saa || {};
saa = globalThis.saa;

(function (traffic, undefined) {
  'use strict';

  const STATIONS_URL = 'https://tie.digitraffic.fi/api/tms/v1/stations';
  const DATA_URL = 'https://tie.digitraffic.fi/api/tms/v1/stations/data';
  const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
  const STALE_THRESHOLD_MS = 15 * 60 * 1000;
  const AJAX_TIMEOUT_MS = 15000;

  saa.traffic.layerGroup = L.layerGroup();

  let stationMeta = {}; // id -> { lat, lng, name, roadNumber }
  let metaLoaded = false;
  let refreshTimer = null;

  function getVolumeColor(vph) {
    if (vph < 500) return '#22c55e';
    if (vph < 1500) return '#eab308';
    if (vph < 3000) return '#f97316';
    return '#ef4444';
  }

  function extractVolume(sensorValues) {
    let s1 = null;
    let s2 = null;

    for (let i = 0; i < sensorValues.length; i++) {
      const s = sensorValues[i];
      if (s.name === 'OHITUKSET_60MIN_KIINTEA_SUUNTA1') {
        s1 = s.value;
      } else if (s.name === 'OHITUKSET_60MIN_KIINTEA_SUUNTA2') {
        s2 = s.value;
      } else if (s.name === 'OHITUKSET_60MIN_LIUKUVA_SUUNTA1' && s1 === null) {
        s1 = s.value;
      } else if (s.name === 'OHITUKSET_60MIN_LIUKUVA_SUUNTA2' && s2 === null) {
        s2 = s.value;
      }
    }

    if (s1 === null && s2 === null) return null;
    return (s1 || 0) + (s2 || 0);
  }

  function drawMarkers(liveData) {
    saa.traffic.layerGroup.clearLayers();

    if (!liveData || !liveData.stations) return;

    const now = Date.now();

    for (let i = 0; i < liveData.stations.length; i++) {
      const station = liveData.stations[i];
      const meta = stationMeta[station.id];

      if (!meta) continue;

      if (station.dataUpdatedTime) {
        const age = now - new Date(station.dataUpdatedTime).getTime();
        if (age > STALE_THRESHOLD_MS) continue;
      }

      const volume = extractVolume(station.sensorValues || []);
      if (volume === null) continue;

      const updatedAt = station.dataUpdatedTime
        ? moment.utc(station.dataUpdatedTime).local().format('DD.MM.YYYY HH:mm')
        : '-';

      const marker = L.circleMarker([meta.lat, meta.lng], {
        radius: 6,
        fillColor: getVolumeColor(volume),
        color: '#fff',
        weight: 1,
        opacity: 0.9,
        fillOpacity: 0.8,
      });

      marker.bindPopup(
        '<b>' +
          meta.name.replace(/_/g, ' ') +
          '</b><br>' +
          'Tie: ' +
          meta.road +
          '<br>' +
          'Liikenne: ' +
          volume +
          ' ajon/h<br>' +
          'Päivitetty: ' +
          updatedAt,
        { maxWidth: 250 }
      );

      saa.traffic.layerGroup.addLayer(marker);
    }
  }

  function fetchLiveData() {
    $.ajax({
      url: DATA_URL,
      dataType: 'json',
      timeout: AJAX_TIMEOUT_MS,
      success: function (data) {
        drawMarkers(data);
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(fetchLiveData, REFRESH_INTERVAL_MS);
      },
      error: function () {
        console.error('Liikennedata: live-datan lataus epäonnistui');
      },
    });
  }

  traffic.init = function () {
    saa.traffic.layerGroup.addTo(saa.Tuulikartta.map);

    if (metaLoaded) {
      fetchLiveData();
      return;
    }

    $.when(
      $.ajax({ url: STATIONS_URL, dataType: 'json', timeout: AJAX_TIMEOUT_MS }),
      $.ajax({ url: DATA_URL, dataType: 'json', timeout: AJAX_TIMEOUT_MS })
    )
      .done(function (metaRes, liveRes) {
        const metaData = metaRes[0];
        if (metaData && metaData.features) {
          for (let i = 0; i < metaData.features.length; i++) {
            const f = metaData.features[i];
            if (!f.properties || !f.geometry) continue;
            // Skip stations explicitly removed or with known bad state
            if (f.properties.state === 'REMOVED_TEMPORARILY' || f.properties.state === 'REMOVED_PERMANENTLY') continue;
            const coords = f.geometry.coordinates; // [lng, lat, elevation]
            const name = f.properties.name || String(f.properties.id);
            stationMeta[f.properties.id] = {
              lat: coords[1],
              lng: coords[0],
              name: name,
              road: name.split('_')[0], // e.g. "vt1_Espoo_Hirvisuo" → "vt1"
            };
          }
        }
        metaLoaded = true;

        drawMarkers(liveRes[0]);
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(fetchLiveData, REFRESH_INTERVAL_MS);
      })
      .fail(function () {
        saa.Tuulikartta.map.removeLayer(saa.traffic.layerGroup);
        console.error('Liikennedata: metadatan lataus epäonnistui');
      });
  };

  traffic.stop = function () {
    clearTimeout(refreshTimer);
    saa.Tuulikartta.map.removeLayer(saa.traffic.layerGroup);
  };
})((saa.traffic = saa.traffic || {}));
