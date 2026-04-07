/*
* Tuulikartta.info main class
* Copyright (C) 2017 Ville Ilkka
* 
* Main application coordinator - initializes namespace and delegates to modular components
*/

// URL for fetching the OSM base map
const OSM_TILE_SERVER_URL =
  window.APP_CONFIG?.OSM_TILE_SERVER_URL ||
  "http://localhost:8080/tile/{z}/{x}/{y}.png";

// Cluster symbol path fallback (camera cluster icon) - avoids undefined SYMBOL_PATH crashes
const SYMBOL_PATH = (window.SYMBOL_PATH || '../symbols/');

// Use globalThis for compatibility with both browser and test environments
globalThis.saa = globalThis.saa || {};
var saa = globalThis.saa;

(function (Tuulikartta, undefined) {
  'use strict'

  // Initialize namespace properties
  saa.Tuulikartta.data = []
  saa.Tuulikartta.debugvalue = false
  saa.Tuulikartta.timeValue = 'now'
  window.favouritesMode = false
  saa.Tuulikartta.timeStamp = ''
  saa.Tuulikartta.markerGroupSynop = L.layerGroup()
  saa.Tuulikartta.markerGroupRoad = L.layerGroup()
  var emptymarker = []
  var showForeignObservations = localStorage.getItem('foreignObservations') ? localStorage.getItem('foreignObservations') : false

  saa.Tuulikartta.graphIds = ""

  // observation update interval in ms
  var interval = 5*60000

  // geolocation
  var geoLocation

  // Set parameters to localstorage to remember previous state
  window.latitude = localStorage.getItem('latitude') ? localStorage.getItem('latitude') : 65
  window.longitude = localStorage.getItem('longitude') ? localStorage.getItem('longitude') : 25
  window.zoomlevel = localStorage.getItem('zoomlevel') ? localStorage.getItem('zoomlevel') : 8
  window.observationSource = localStorage.getItem('observationSource') ? localStorage.getItem('observationSource') : 'Näytä vain synop-asemat'
  window.selectedParameter = localStorage.getItem('selectedparameter') ? localStorage.getItem('selectedparameter') : 'ws_10min'
  window.startPosition = 0
  var toggleDataSelect = 'close'
  var minRoadZoomLevel = 8

  // Initialize marker cluster for road stations
  // Road observations are now clustered at all zoom levels (up to max zoom), to avoid marker overload.
  saa.Tuulikartta.markerGroupRoad = L.markerClusterGroup({
    spiderfyOnMaxZoom: false,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    removeOutsideVisibleBounds: true,
    chunkedLoading: true,
    chunkInterval: 1000,
    maxClusterRadius: 100,
    disableClusteringAtZoom: 10, 
    iconCreateFunction: function(cluster) {
      const children = cluster.getAllChildMarkers();
      const uniqueFmisIds = new Set();
      children.forEach(function(marker) {
        if (marker.fmisid) {
          uniqueFmisIds.add(marker.fmisid);
        }
      });
      const childCount = uniqueFmisIds.size > 0 ? uniqueFmisIds.size : cluster.getChildCount();

      if (childCount < 2) {
        // For single station, show the individual marker icon instead of cluster
        return children[0].options.icon;
      } else {
        // For 2 or more stations, show cluster icon with count
        return L.divIcon({
          html: `
            <div style="text-align:center; width:40px; font-size:13px;">
              <img src="${SYMBOL_PATH}weather-cluster-image.png" style="width:50px; height:50px; margin-bottom:-7px">
              <b>${childCount}</b>
            </div>
          `
        });
      }
    }
  });

  saa.Tuulikartta.showStationObservations = true
  saa.Tuulikartta.showRoadObservations = false
  var showOldObservations = false
  window.getLightningData = false
  window.getTrafficCamData = false
  saa.Tuulikartta.showCloudStrikes = localStorage.getItem('showCloudStrikes') ? localStorage.getItem('showCloudStrikes') : true
  saa.Tuulikartta.lightningInterval = 5

  saa.Tuulikartta.radarLayer = ''
  saa.Tuulikartta.flashLayer = ''

  var radarLayerOpacity = localStorage.getItem('radarLayerOpacity') ? localStorage.getItem('radarLayerOpacity') : 80

  // declare popup max width
  var maxWidth
  var maxheight = 320

  Tuulikartta.debug = function (par) {
    if (Tuulikartta.debugvalue === true) {
      console.log(par)
    }
  }

  Tuulikartta.handleUrlParams = function(lat, lon, zoom, initParam) {
    window.latitude = lat
    window.longitude = lon
    window.zoomlevel = zoom
    window.selectedParameter = initParam
    window.startPosition = window.resolveGraphStartposition(initParam)
  }

  // ---------------------------------------------------------
  // Convert epoch time to properly formatted time string
  // ---------------------------------------------------------

  Tuulikartta.timeTotime = function (epochtime) {
    // convert epoc time to time stamp
    var d = new Date(epochtime * 1000)
    var hours = d.getHours()
    var minutes = d.getMinutes()
    // add leading zeros
    if (parseInt(hours) < 10) {
      hours = '0' + hours
    }
    if (parseInt(minutes) < 10) {
      minutes = '0' + minutes
    }
    return d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + hours + ':' + minutes
  }

  Tuulikartta.dataLoader = function (param) {
    var dataLoader = document.getElementById('data-loader')
    dataLoader.innerHTML = translations[window.selectedLanguage]['loadObservations']
    if(param) {
      dataLoader.style.display = 'block'
      document.body.style.cursor = 'wait'
    } else {
      dataLoader.style.display = 'none'
      document.body.style.cursor = 'default'
    }
  }

  // ---------------------------------------------------------
  // initialize Leaflet map and set geolocation
  // ---------------------------------------------------------

  Tuulikartta.initMap = function () {

    var lat = parseFloat(latitude)
    var lon = parseFloat(longitude)
    var zoom = parseInt(zoomlevel)

    var map = L.map('map', {
      zoom: zoom,
      minZoom: 5,
      maxZoom: 16,
      scrollWheelZoom: true,
      center: [lat, lon],
      attribution: 'Tuulikartta.info'
    })

    // add OpenStreetMap tile layer from OSM data server

    //console.log(`---------------------------------`);
    //console.log("Using OSM tile server URL: " + OSM_TILE_SERVER_URL);
    //console.log(`---------------------------------`);

    saa.Tuulikartta.baselayer = L.tileLayer(OSM_TILE_SERVER_URL, {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map)


    saa.Tuulikartta.map = map
    Tuulikartta.initWMS()
    

     // remove default zoomcontrol and add a new one with custom titles
    map.zoomControl.remove()
    L.control.zoom({zoomInTitle: translations[window.selectedLanguage]['zoomIn'], zoomOutTitle: translations[window.selectedLanguage]['zoomOut']}).addTo(map)

    L.control.locate({
      drawCircle: false,
      showCompass: false,
      locateOptions: {
        maxZoom: 9,
        enableHighAccuracy: true
      },
      icon: 'fas fa-map-marker-alt',
      showPopup: false,
      strings: {
        title: translations[window.selectedLanguage]['geolocation']
      }
    }).addTo(map);

    saa.Tuulikartta.map.on('overlayadd', function(e) {
      if (saa.Tuulikartta.namelayer) saa.Tuulikartta.namelayer.bringToFront()
    })

    /* settings sidebar */
    var sidebar = L.control.sidebar('settings-sidebar', {
      position: 'left',
      autoPan: false
    })
    map.addControl(sidebar);
    sidebar.setContent(Tuulikartta.populateSidebar(radarLayerOpacity)) //tämä on omassa tiedostossa

    /* settings control */
    var customControl = L.Control.extend({
      options: {
        position: 'topright'
      },
      onAdd: function (map) {
        var container = L.DomUtil.create(
          'div', 'leaflet-bar leaflet-control leaflet-control-custom leaflet-control-select-source'
        )

        // moved eventhandler setting to event-handlers.js
        Tuulikartta.settingsHandler(container, sidebar);
        
        container.title = translations[window.selectedLanguage]['settings']
        return container
      }
    })
    map.addControl(new customControl());

    /* radar control */
    var radarControl = L.Control.extend({
      options: {
        position: 'topright'
      },
      onAdd: function (map) {
        var container = L.DomUtil.create(
          'div', 'leaflet-bar leaflet-control leaflet-control-custom leaflet-control-select-radar'
        )
        // eventhandler is set in event-handlers.js
        Tuulikartta.radarHandler(container);

        container.title = translations[window.selectedLanguage]['radarTitle']
        return container
      }
    })
    map.addControl(new radarControl());

    /* lightning control */
    var lightningControl = L.Control.extend({
      options: {
        position: 'topright'
      },
      onAdd: function (map) {
        var container = L.DomUtil.create(
          'div', 'leaflet-bar leaflet-control leaflet-control-custom leaflet-control-select-flash'
        )
        // eventhandler is set in event-handlers.js
        Tuulikartta.lightningHandler(container);
        
        container.title = translations[window.selectedLanguage]['lightningTitle']
        return container
      }
    })
    map.addControl(new lightningControl());

    /* table control */ // tässä aiempi kommentti oli radar control ?
    var tableDataControl = L.Control.extend({
      options: {
        position: 'topright'
      },
      onAdd: function (map) {
        var container = L.DomUtil.create(
          'div', 'leaflet-bar leaflet-control leaflet-control-custom leaflet-control-select-table'
        )
        
        // eventhandler is set in event-handlers.js
        Tuulikartta.tableHandler(container);

        container.title = translations[window.selectedLanguage]['tableTitle']
        return container
      }
    })
    map.addControl(new tableDataControl());

    /* traffic cam control */
     var trafficCamControl = L.Control.extend({
       options: {
         position: 'topright'
       },
       onAdd: function (map) {
         var container = L.DomUtil.create(
           'div', 'leaflet-bar leaflet-control leaflet-control-custom leaflet-control-select-cam'
         )
        
         container.onclick = function(){
           if(saa.Tuulikartta.timeValue === 'now') {
             if(saa.Tuulikartta.map.hasLayer(saa.camera.markers)) {
               saa.Tuulikartta.map.removeLayer(saa.camera.markers)
               $(this).removeClass('active')
         getTrafficCamData = false
               saa.camera.markers.clearLayers()
             } else {
               saa.camera.init()
               $(this).addClass('active')
               getTrafficCamData = true
             }
           }
         }

         container.title = translations[window.selectedLanguage]['camTitle']
         return container
       }
     })
     map.addControl(new trafficCamControl());

    /* favourites control */
    var favouritesControl = L.Control.extend({
      options: {
        position: 'topright'
      },
      onAdd: function (map) {
        var container = L.DomUtil.create(
          'div', 'leaflet-bar leaflet-control leaflet-control-custom leaflet-control-select-favourites'
        )
        container.title = 'Suosikit'
        container.onclick = function () {
          window.favouritesMode = !window.favouritesMode
          $(this).toggleClass('active')
          saa.Tuulikartta.requestData()
        }
        return container
      }
    })
    map.addControl(new favouritesControl());
//TÄHÄN ASTI KOMMENTOINTIA
    var infoControl = L.Control.extend({
      options: {
        position: 'topleft'
      },
      onAdd: function (map) {
        var container = L.DomUtil.create(
          'div', 'leaflet-bar leaflet-control leaflet-control-custom leaflet-control-toggle-info'
        )
        // eventhandler is set in event-handlers.js
        Tuulikartta.infoHandler(container);

        container.title = translations[window.selectedLanguage]['info']
        return container
      }
    })
    map.addControl(new infoControl());
  }

  // tässä oli populate sidebar

  Tuulikartta.initWMS = function () {
    var dataWMS = 'https://data.fmi.fi/fmi-apikey/f01a92b7-c23a-47b0-95d7-cbcb4a60898b/wms'
    var geosrvWMS = 'http://openwms.fmi.fi/geoserver/Radar/wms'

    saa.Tuulikartta.radarLayer = L.tileLayer.wms(geosrvWMS, {
      layers: 'suomi_dbz_eureffin',
      format: 'image/png',
      tileSize: 2048,
      transparent: true,
      opacity: radarLayerOpacity/100,
      time: saa.Tuulikartta.timeStamp,
      version: '1.3.0',
      crs: L.CRS.EPSG3857,
      attribution: '<a href="https://www.tuulikartta.info">Tuulikartta.info</a>'
    })

    // L.control.layers(false, overlayMaps).addTo(saa.Tuulikartta.map)
  }

  // ---------------------------------------------------------
  // Marker and icon utilities
  // ---------------------------------------------------------

  Tuulikartta.createLabelIcon = function (labelClass, labelText) {
    return L.divIcon({
      iconSize: null,
      className: labelClass,
      iconAnchor: [10, 7],
      html: labelText
    })
  }

  Tuulikartta.formatNuclide = function (v) {
    var f = parseFloat(v)
    if (f >= 100) return f.toFixed(0)
    if (f >= 1)   return f.toFixed(1)
    return f.toFixed(3)
  }

  Tuulikartta.clearMarkers = function () {
    // remove all old markers
    saa.Tuulikartta.markerGroupSynop.clearLayers()
    saa.Tuulikartta.markerGroupRoad.clearLayers()
  }

  // ---------------------------------------------------------
  // Draw station observations
  // ---------------------------------------------------------

  Tuulikartta.isDataStale = function (epochtime) {
    if (saa.Tuulikartta.timeValue !== 'now') return false
    var currentBlockStart = Math.floor(Date.now() / 1000 / 600) * 600
    return epochtime < currentBlockStart
  }

  Tuulikartta.drawData = function (param) {

    if (!param) param = window.selectedParameter || 'ws_10min'
    if(!saa.Tuulikartta.showStationObservations && !saa.Tuulikartta.showRoadObservations) return false
    Tuulikartta.clearMarkers()

    var sizeofdata = parseInt(Object.keys(saa.Tuulikartta.data).length)
    if (saa.Tuulikartta.showStationObservations) { 
      saa.Tuulikartta.markerGroupSynop.addTo(saa.Tuulikartta.map)
    }
    if (saa.Tuulikartta.showRoadObservations) {
      saa.Tuulikartta.markerGroupRoad.addTo(saa.Tuulikartta.map)
    }

    // Choose correct max width
    if (L.Browser.mobile) {
      maxWidth = 250
    } else {
      maxWidth = 650
    }

    var renderedStationIndices = new Set()

    var warningIcon = L.icon({
      iconUrl: '../css/images/exclamation_mark.png',
      iconSize: [18, 18],
      iconAnchor: [-4, 22],
      interactive: false
    })

    console.log("One random data set: ", saa.Tuulikartta.data[30]) // for debugging
    
    for (var i = 0; i < sizeofdata; i++) {
      if (!saa.Tuulikartta.data[i]) continue

      var location = { lat: parseFloat(saa.Tuulikartta.data[i]['lat']), lng: parseFloat(saa.Tuulikartta.data[i]['lon']) }
      var time = Tuulikartta.timeTotime(saa.Tuulikartta.data[i]['epochtime'])
      var latlon = saa.Tuulikartta.data[i]['lat'] + ',' + saa.Tuulikartta.data[i]['lon']

      if (saa.Tuulikartta.data[i]['type'] === 'air_radio' && param !== 'air_activity') continue
      if (saa.Tuulikartta.data[i]['type'] === 'radiation' && param !== 'dose_rate') continue
      if (saa.Tuulikartta.data[i]['type'] === 'magnetometer' && param !== 'magnetism') continue
      if (saa.Tuulikartta.data[i]['type'] === 'R' && param !== 'rVal') continue

      if (param == 'ws_10min' || param === 'wg_10min') {
        // Only show wind data for synop and road stations that have wind data
        if (saa.Tuulikartta.data[i]['type'] !== 'radiation' &&
            saa.Tuulikartta.data[i]['ws_10min'] !== null && saa.Tuulikartta.data[i]['wd_10min'] !== null &&
                        saa.Tuulikartta.data[i]['wg_10min'] !== null) {

          if (saa.Tuulikartta.data[i][param] < 10) { var iconAnchor = [30, 28] }
          if (saa.Tuulikartta.data[i][param] >= 10) { var iconAnchor = [25, 28] }

          var icon = L.icon({
            iconUrl: '../symbols/wind/' + (saa.Tuulikartta.resolveWindSpeed(saa.Tuulikartta.data[i][param])).code + '.svg',
            iconSize: [60, 60], // size of the icon
            iconAnchor: iconAnchor, // point of the icon which will correspond to marker's location
            popupAnchor: [0, 0] // point from which the popup should open relative to the iconAnchor
          })

          var marker = L.marker([saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']],
            {
              icon: icon,
              rotationAngle: Tuulikartta.resolveWindDirection(saa.Tuulikartta.data[i]['wd_10min']),
              rotationOrigin: 'center center'
            })

          if (saa.Tuulikartta.data[i]['type'] === 'road') {
            marker.addTo(saa.Tuulikartta.markerGroupRoad)
          } else {saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i])
            marker.addTo(saa.Tuulikartta.markerGroupSynop)
          }

          //marker.bindPopup(saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i]))
          marker.bindPopup(saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i],
                    saa.Tuulikartta.data[i]['fmisid']),{
            maxWidth: maxWidth
          })
          marker.fmisid = saa.Tuulikartta.data[i]['fmisid']
          marker.type = saa.Tuulikartta.data[i]['type']

          var marker = L.marker(new L.LatLng(saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']),
            {
              interactive: false,
              keyboard: false,
              icon: Tuulikartta.createLabelIcon('textLabelclass', parseFloat(saa.Tuulikartta.data[i][param]).toFixed(1))
            })

          if (saa.Tuulikartta.data[i]['type'] === 'road') {
            marker.addTo(saa.Tuulikartta.markerGroupRoad)
          } else {
            marker.addTo(saa.Tuulikartta.markerGroupSynop)
          }
          renderedStationIndices.add(i)
        }
      }

      if (param === 'ws_1d' || param === 'wg_1d') {
        // Only show daily wind data for synop and road stations that have wind data
        if (saa.Tuulikartta.data[i]['type'] !== 'radiation' &&
            saa.Tuulikartta.data[i]['ws_1d'] != null && saa.Tuulikartta.data[i]['ws_max_dir'] != null && saa.Tuulikartta.data[i]['wg_max_dir'] != null &&  saa.Tuulikartta.data[i]['wg_1d'] != null) {

          if (saa.Tuulikartta.data[i][param] < 10) { var iconAnchor = [30, 28] }
          if (saa.Tuulikartta.data[i][param] >= 10) { var iconAnchor = [25, 28] }

          var icon = L.icon({
            iconUrl: '../symbols/wind/' + (saa.Tuulikartta.resolveWindSpeed(saa.Tuulikartta.data[i][param])).code + '.svg',
            iconSize: [60, 60], // size of the icon
            iconAnchor: iconAnchor, // point of the icon which will correspond to marker's location
            popupAnchor: [0, 0] // point from which the popup should open relative to the iconAnchor
          })

          if (param == 'ws_1d') {
            var marker = L.marker([saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']],
              {
                icon: icon,
                rotationAngle: Tuulikartta.resolveWindDirection(saa.Tuulikartta.data[i]['ws_max_dir']),
                rotationOrigin: 'center center'
              })
          } else {
            var marker = L.marker([saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']],
              {
                icon: icon,
                rotationAngle: Tuulikartta.resolveWindDirection(saa.Tuulikartta.data[i]['wg_max_dir']),
                rotationOrigin: 'center center'
              })
          }

          if (saa.Tuulikartta.data[i]['type'] === 'road') {
            marker.addTo(saa.Tuulikartta.markerGroupRoad)
          } else {saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i])
            marker.addTo(saa.Tuulikartta.markerGroupSynop)
          }

          //marker.bindPopup(saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i]))
          marker.bindPopup(saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i],
                    saa.Tuulikartta.data[i]['fmisid']),{
            maxWidth: maxWidth
          })
          marker.fmisid = saa.Tuulikartta.data[i]['fmisid']
          marker.type = saa.Tuulikartta.data[i]['type']

          var marker = L.marker(new L.LatLng(saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']),
            {
              interactive: false,
              keyboard: false,
              icon: Tuulikartta.createLabelIcon('textLabelclass', parseFloat(saa.Tuulikartta.data[i][param]).toFixed(1))
            })

          if (saa.Tuulikartta.data[i]['type'] === 'road') {
            marker.addTo(saa.Tuulikartta.markerGroupRoad)
          } else {
            marker.addTo(saa.Tuulikartta.markerGroupSynop)
          }
          renderedStationIndices.add(i)
        }
      }

      if (param === 'rr_1h' || param === 'ri_10min' || param === 'rr_1d' ) {
        if(parseFloat(saa.Tuulikartta.data[i][param]) > 0) {
          var fillColor = Tuulikartta.resolvePrecipitationAmount(saa.Tuulikartta.data[i][param])
          if (!fillColor) continue
          var hex = fillColor.substr(1)
          hex = 'hex' + hex
          if (saa.Tuulikartta.data[i][param] !== null && parseFloat(saa.Tuulikartta.data[i][param]) > 0) {
            var marker = L.marker(new L.LatLng(saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']),
              {
                interactive: true,
                keyboard: false,
                icon: Tuulikartta.createLabelIcon(hex, parseFloat(saa.Tuulikartta.data[i][param]).toFixed(1))
              })

            if (saa.Tuulikartta.data[i]['type'] === 'road') {
              marker.addTo(saa.Tuulikartta.markerGroupRoad)
            } else {
              marker.addTo(saa.Tuulikartta.markerGroupSynop)
            }
            marker.bindPopup(saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i],
            saa.Tuulikartta.data[i]['fmisid']),{
              maxWidth: maxWidth
            })
            marker.fmisid = saa.Tuulikartta.data[i]['fmisid']
            marker.type = saa.Tuulikartta.data[i]['type']
            renderedStationIndices.add(i)
          }
        }
        // draw '–' if theres no precipitation
        if(parseFloat(saa.Tuulikartta.data[i][param]) == 0 && saa.Tuulikartta.data[i][param] !== 'NaN' ) {
          var marker = L.marker(new L.LatLng(saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']),
            {
              interactive: true,
              keyboard: false,
              icon: Tuulikartta.createLabelIcon('textLabelclass', '–')
            })

          if (saa.Tuulikartta.data[i]['type'] === 'road') {
            marker.addTo(saa.Tuulikartta.markerGroupRoad)
          } else {
            marker.addTo(saa.Tuulikartta.markerGroupSynop)
          }
          marker.bindPopup(saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i],
          saa.Tuulikartta.data[i]['fmisid']),{
            maxWidth: maxWidth
          })
          marker.fmisid = saa.Tuulikartta.data[i]['fmisid']
          marker.type = saa.Tuulikartta.data[i]['type']
          renderedStationIndices.add(i)
        }
      }

      if (param === 'dose_rate') {
        // Handle external radiation dose rate - only for radiation stations
        if (saa.Tuulikartta.data[i]['type'] === 'radiation') {
          var paramValue = saa.Tuulikartta.data[i]['DR_PT10M_avg']
          if (paramValue !== null && paramValue !== undefined) {
            var fillColor = Tuulikartta.resolveDoseRate(paramValue)
            var hex = fillColor.substr(1)
            hex = 'hex' + hex

            var marker = L.marker(new L.LatLng(saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']),
              {
                interactive: true,
                keyboard: false,
                icon: Tuulikartta.createLabelIcon(hex, parseFloat(paramValue).toFixed(2))
              })

            marker.addTo(saa.Tuulikartta.markerGroupSynop)
            marker.bindPopup(saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i],
            saa.Tuulikartta.data[i]['fmisid']),{
              maxWidth: maxWidth
            })
            marker.fmisid = saa.Tuulikartta.data[i]['fmisid']
            marker.type = saa.Tuulikartta.data[i]['type']
          }
        }
      }

      if (param === 'air_activity') {
        if (saa.Tuulikartta.data[i]['type'] === 'air_radio') {
          var stationData = saa.Tuulikartta.data[i]
          var labelHtml = ''

          if (stationData['Pb-210'] !== null && stationData['Pb-210'] !== undefined) {
            labelHtml += '<div>Pb-210: ' + Tuulikartta.formatNuclide(stationData['Pb-210']) + '</div>'
          }
          if (stationData['Be-7'] !== null && stationData['Be-7'] !== undefined) {
            labelHtml += '<div>Be-7: ' + Tuulikartta.formatNuclide(stationData['Be-7']) + '</div>'
          }
          if (stationData['Cs-137'] !== null && stationData['Cs-137'] !== undefined) {
            labelHtml += '<div>Cs-137: ' + Tuulikartta.formatNuclide(stationData['Cs-137']) + '</div>'
          }

          if (labelHtml === '') continue

          var icon = L.divIcon({
            iconSize: null,
            className: 'air-radio-label',
            iconAnchor: [10, 22],
            html: labelHtml
          })

          var marker = L.marker(
            [stationData['lat'], stationData['lon']],
            { icon: icon, interactive: true, keyboard: true }
          )

          marker.addTo(saa.Tuulikartta.markerGroupSynop)
          marker.bindPopup(
            saa.Tuulikartta.populateInfoWindow(stationData, stationData['fmisid']),
            { maxWidth: maxWidth }
          )
          marker.fmisid = stationData['fmisid']
          marker.type = 'air_radio'
        }
      }

      if (param === 'rVal') {
        // Handle R-values - only for R stations
        if (saa.Tuulikartta.data[i]['type'] === 'R') {
          var paramValue = saa.Tuulikartta.data[i]['rVal']
          if (paramValue !== null && paramValue !== undefined) {
            var fillColor = Tuulikartta.resolveRProbability(saa.Tuulikartta.data[i]['rProb'])
            var hex = fillColor.substr(1)
            hex = 'hex' + hex

            var marker = L.marker(new L.LatLng(saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']),
              {
                interactive: true,
                keyboard: false,
                icon: Tuulikartta.createLabelIcon(hex, parseFloat(paramValue).toFixed(2))
              })

            marker.addTo(saa.Tuulikartta.markerGroupSynop)
            marker.bindPopup(saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i],
            saa.Tuulikartta.data[i]['fmisid']),{
              maxWidth: maxWidth
            })
            marker.type = saa.Tuulikartta.data[i]['type']
            // missing fmisid required for graph call
          }
        }
      }

      if(param === 'magnetism') {
        // Handle magnetic field - only for magnetometer stations
        if (saa.Tuulikartta.data[i]['type'] === 'magnetometer') {
          var paramValues = saa.Tuulikartta.data[i]
          var X = paramValues['X']
          var Y = paramValues['Y']
          var Z = paramValues['Z']

          var labelHtml = ''
          if (X!== null && X !== undefined) {
            labelHtml += '<div>X: ' + parseFloat(X) + '</div>'
          }
          if (Y !== null && Y !== undefined) {
            labelHtml += '<div>Y: ' + parseFloat(Y) + '</div>'
          }
          if (Z !== null && Z !== undefined) {
            labelHtml += '<div>Z: ' + parseFloat(Z) + '</div>'
          }
          if (labelHtml === '') continue

          var icon = L.divIcon({
            iconSize: null,
            className: 'air-radio-label',
            iconAnchor: [10, 22],
            html: labelHtml
          })

          var marker = L.marker(
            [saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']],
            { icon: icon, interactive: true, keyboard: true }
          )

            marker.addTo(saa.Tuulikartta.markerGroupSynop)
            marker.bindPopup(saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i],
            saa.Tuulikartta.data[i]['fmisid']),{
              maxWidth: maxWidth
            })
            marker.type = 'magnetometer'
            marker.fmisid = saa.Tuulikartta.data[i]['fmisid']
          }
        }

      if (param === 'dewpoint'|| param === 't2m'|| param === 'tmin' || param === 'tmax') {

        var fillColor = Tuulikartta.resolveTemperature(saa.Tuulikartta.data[i][param])
        var hex = fillColor.substr(1)
        hex = 'hex' + hex

        var svgicon = ''
        svgicon = svgicon + '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" viewBox="0 0 50 50" enable-background="new 0 0 50 50" xml:space="preserve">'
        svgicon = svgicon + '<g><path d="M20.4,48.8c6.7,1.3,12.5-3.8,12.5-10.3c0-3.4-1.7-6.5-4.3-8.4V7.2c0-3.4-2.7-6.2-6.2-6.2c-3.4,0-6.2,2.8-6.2,6.2v22.9   c-3.1,2.3-4.9,6.2-4,10.6C13,44.7,16.3,48,20.4,48.8z M17.5,32l0.9-0.7v-24c0-2.2,1.8-3.9,3.9-3.9c2.2,0,4,1.8,4,3.9v24l0.9,0.7   c2.1,1.5,3.3,4,3.3,6.6c0,2.2-0.9,4.3-2.4,5.8c-1.6,1.5-3.6,2.4-5.8,2.4c-4.1,0-7.3-2.9-8-6.5C13.8,37,15,33.8,17.5,32z"></path>'
        svgicon = svgicon + '<path d="M22.4,44.4c1.6,0,3.1-0.6,4.2-1.7c1.1-1.1,1.7-2.6,1.7-4.2c0-4-3.4-5.3-4.3-6.1V15.5h-3.3v16.9c-0.7,0.8-5.1,2.4-4.1,7.3   C17.1,42.3,19.4,44.4,22.4,44.4z" stroke="black" fill="' + fillColor + '"></path>'
        svgicon = svgicon + '<path d="M36.9,7.8h-5.7v2.3h5.7c0.6,0,1.1-0.5,1.1-1.1C38.1,8.3,37.6,7.8,36.9,7.8z"></path>'
        svgicon = svgicon + '<path d="M35.8,15c0-0.6-0.5-1.1-1.1-1.1h-3.4v2.3h3.4C35.3,16.1,35.8,15.6,35.8,15z"></path>'
        svgicon = svgicon + '<path d="M38.1,21c0-0.6-0.5-1.1-1.1-1.1h-5.7v2.3h5.7C37.6,22.2,38.1,21.6,38.1,21z"></path>'
        svgicon = svgicon + '</g>'
        svgicon = svgicon + '</svg>'

        var svgicon = encodeURI('data:image/svg+xml,' + svgicon).replace('#', '%23')

        if (saa.Tuulikartta.data[i][param] !== null && Math.abs(saa.Tuulikartta.data[i][param])<100 ) {
          // add trash symbol to enable bigger popup activation area
          // trashSymbol(saa.Tuulikartta.data[i])

          // symbol
          var icon = L.icon({
            iconUrl: svgicon,
            iconSize: [30, 30],
            iconAnchor: [40, 10],
            popupAnchor: [0, 0]
          })

          marker = L.marker([saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']],
            {
              icon: icon,
              interactive: false,
              keyboard: false
            })

          if (saa.Tuulikartta.data[i]['type'] === 'road') {
            marker.addTo(saa.Tuulikartta.markerGroupRoad)
          } else {
            marker.addTo(saa.Tuulikartta.markerGroupSynop)
          }

          // text field
          marker = L.marker([saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']],
            {
              interactive: true,
              keyboard: true,
              icon: Tuulikartta.createLabelIcon(hex, parseFloat(saa.Tuulikartta.data[i][param]).toFixed(1))
            })

          if (saa.Tuulikartta.data[i]['type'] === 'road') {
            marker.addTo(saa.Tuulikartta.markerGroupRoad)
          } else {
            marker.addTo(saa.Tuulikartta.markerGroupSynop)
          }
          marker.bindPopup(saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i],
          saa.Tuulikartta.data[i]['fmisid']),{
            maxWidth: maxWidth
          })
          marker.fmisid = saa.Tuulikartta.data[i]['fmisid']
          marker.type = saa.Tuulikartta.data[i]['type']
          renderedStationIndices.add(i)
        }
      }

      if (param === 'n_man') {

        if (saa.Tuulikartta.data[i]['n_man'] !== null) {
          var icon = L.icon({
            iconUrl: '../symbols/nn/' + saa.Tuulikartta.data[i][param] + '.svg',
            iconSize: [30, 30], // size of the icon
            iconAnchor: [15,15], // point of the icon which will correspond to marker's location
            popupAnchor: [0, 0] // point from which the popup should open relative to the iconAnchor
          })

          var marker = L.marker([saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']],
            {
              icon: icon
            })

          if (saa.Tuulikartta.data[i]['type'] === 'road') {
            continue
          } else {
            marker.addTo(saa.Tuulikartta.markerGroupSynop)
          }

          marker.bindPopup(saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i],
          saa.Tuulikartta.data[i]['fmisid']),{
            maxWidth: maxWidth
          })
          marker.fmisid = saa.Tuulikartta.data[i]['fmisid']
          marker.type = saa.Tuulikartta.data[i]['type']
          renderedStationIndices.add(i)
        }
      }

      if (param === 't2mdewpoint') {
        if (saa.Tuulikartta.data[i]['t2mdewpoint'] !== null) {
          var fillColor = Tuulikartta.resolveDewpointDiff(saa.Tuulikartta.data[i][param])
          var hex = fillColor.substr(1)
          hex = 'hex' + hex

          var marker = L.marker(new L.LatLng(saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']),
            {
              interactive: true,
              keyboard: false,
              icon: Tuulikartta.createLabelIcon(hex, saa.Tuulikartta.data[i][param].toFixed(1))
            })

          if (saa.Tuulikartta.data[i]['type'] === 'road') {
            marker.addTo(saa.Tuulikartta.markerGroupRoad)
          } else {
            marker.addTo(saa.Tuulikartta.markerGroupSynop)
          }

          marker.bindPopup(saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i]))
          marker.bindPopup(saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i],
          saa.Tuulikartta.data[i]['fmisid']),{
            maxWidth: maxWidth
          })
          marker.fmisid = saa.Tuulikartta.data[i]['fmisid']
          marker.type = saa.Tuulikartta.data[i]['type']
          renderedStationIndices.add(i)
        }
      }

      if (param === 'vis') {
        if (saa.Tuulikartta.data[i]['vis'] !== null) {
          var labelClass = 'textLabelclassGrey'

          // 1000 <= visibility < 2000
          if (parseFloat(saa.Tuulikartta.data[i][param]) < 2000 && parseFloat(saa.Tuulikartta.data[i][param]) >= 1000) {
            labelClass = 'textLabelclassBlack'
            var icon = L.icon({
              iconUrl: '../symbols/mist.svg',
              iconSize: [60, 60],
              iconAnchor: [66, 25],
              popupAnchor: [0, 0]
            })
            var marker = L.marker([saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']],
              {
                icon: icon
              })

            if (saa.Tuulikartta.data[i]['type'] === 'road') {
              marker.addTo(saa.Tuulikartta.markerGroupRoad)
            } else {
              marker.addTo(saa.Tuulikartta.markerGroupSynop)
            }
          }

          // visibility < 1000
          if (parseFloat(saa.Tuulikartta.data[i][param]) < 1000) {
            labelClass = 'textLabelclassRed'
            var icon = L.icon({
              iconUrl: '../symbols/fog.svg',
              iconSize: [60, 60],
              iconAnchor: [66, 25],
              popupAnchor: [0, 0]
            })
            var marker = L.marker([saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']],
              {
                icon: icon
              })

            if (saa.Tuulikartta.data[i]['type'] === 'road') {
              marker.addTo(saa.Tuulikartta.markerGroupRoad)
            } else {
              marker.addTo(saa.Tuulikartta.markerGroupSynop)
            }
          }

          // visibility > 2000
          var marker = L.marker(new L.LatLng(saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']),
            {
              interactive: true,
              keyboard: false,
              icon: Tuulikartta.createLabelIcon(labelClass, parseFloat(saa.Tuulikartta.data[i][param]).toFixed(1))
            })

          if (saa.Tuulikartta.data[i]['type'] === 'road') {
            marker.addTo(saa.Tuulikartta.markerGroupRoad)
          } else {
            marker.addTo(saa.Tuulikartta.markerGroupSynop)
          }

          marker.bindPopup(saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i]))
          marker.bindPopup(saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i],
          saa.Tuulikartta.data[i]['fmisid']),{
            maxWidth: maxWidth
          })
          marker.fmisid = saa.Tuulikartta.data[i]['fmisid']
          marker.type = saa.Tuulikartta.data[i]['type']
          renderedStationIndices.add(i)
        }
      }

      if (param === 'pressure') {
        if (saa.Tuulikartta.data[i]['pressure'] !== null) {
          var fillColor = Tuulikartta.resolvePressure(saa.Tuulikartta.data[i][param])
          var hex = fillColor.substr(1)
          hex = 'hex' + hex

          var marker = L.marker(new L.LatLng(saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']),
            {
              interactive: true,
              keyboard: false,
              icon: Tuulikartta.createLabelIcon(hex, parseFloat(saa.Tuulikartta.data[i][param]).toFixed(1))
            })

          if (saa.Tuulikartta.data[i]['type'] === 'road') {
            marker.addTo(saa.Tuulikartta.markerGroupRoad)
          } else {
            marker.addTo(saa.Tuulikartta.markerGroupSynop)
          }

          marker.bindPopup(saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i]))
          marker.bindPopup(saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i],
          saa.Tuulikartta.data[i]['fmisid']),{
            maxWidth: maxWidth
          })
          marker.fmisid = saa.Tuulikartta.data[i]['fmisid']
          marker.type = saa.Tuulikartta.data[i]['type']
          renderedStationIndices.add(i)
        }
      }

      if (param === 'wawa') {
        if (saa.Tuulikartta.data[i]['wawa'] !== null && Tuulikartta.resolveWawaCode(saa.Tuulikartta.data[i]['wawa']) !== null) {
          var code = Tuulikartta.resolveWawaCode(saa.Tuulikartta.data[i]['wawa'])

          var svgicon = ''
          if(code.short === 'Poutaa' || code.short === 'FairWeather') {
            svgicon = svgicon + '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" enable-background="new 0 0 50 50" xml:space="preserve">'
            svgicon = svgicon + `<circle r="5" cx="10" cy="10" stroke="black" stroke-width="2" fill="#ffffff"></circle>`
            svgicon = svgicon + `</svg>`
          } else {
            svgicon = svgicon + '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" enable-background="new 0 0 50 50" xml:space="preserve">'
            svgicon = svgicon + `<circle r="5" cx="10" cy="10" stroke="black" stroke-width="2" fill="${code.hex}"></circle>`
            svgicon = svgicon + `</svg>`
          }

          var icon = encodeURI('data:image/svg+xml,' + svgicon).replace('#', '%23')

          var icon = L.icon({
            iconUrl: icon,
            iconSize: [50, 50],
            iconAnchor: [0, 0],
            popupAnchor: [0, 0]
          })

          // dot
          var marker = L.marker([saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']],
            {
              icon: icon
            })

          if (saa.Tuulikartta.data[i]['type'] === 'road') {
            marker.addTo(saa.Tuulikartta.markerGroupRoad)
          } else {
            marker.addTo(saa.Tuulikartta.markerGroupSynop)
          }

          var markerHtmlStyles = `
              font-weight: bold;
              color: ${code.hex};
              margin: 10px 0 30px 0;
              font-size: 12px;
              background-color: black;
              border: 1px solid black;
              padding: 1px 1px 1px 1px;`

          if(code.short === 'Poutaa' || code.short === 'FairWeather') {
            markerHtmlStyles = `
              ffont-weight: bold;
              color: rgb(130, 129, 129);
              font-size: 11px;
              background-color: rgba(255,255,255,0.2);
              border: 1px solid black;
              padding: 1px 1px 1px 1px;`
          }

          var marker = L.marker(new L.LatLng(saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']),
            {
              icon: L.divIcon({
                iconAnchor: [-17, 10],
                labelAnchor: [0, 0],
                popupAnchor: [0, 0],
                html: `<span style="${markerHtmlStyles}" >${code.short}</span>`,
                className: null
              })
            })

          if (saa.Tuulikartta.data[i]['type'] === 'road') {
            marker.addTo(saa.Tuulikartta.markerGroupRoad)
          } else {
            marker.addTo(saa.Tuulikartta.markerGroupSynop)
          }
          marker.bindPopup(saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i],
          saa.Tuulikartta.data[i]['fmisid']),{
            maxWidth: maxWidth
          })
          marker.fmisid = saa.Tuulikartta.data[i]['fmisid']
          marker.type = saa.Tuulikartta.data[i]['type']
          renderedStationIndices.add(i)
        }
      }

      if (param === 'snow_aws') {
        if(parseFloat(saa.Tuulikartta.data[i][param]) > 0) {
          var fillColor = Tuulikartta.resolveSnowDepth(saa.Tuulikartta.data[i][param])
          var hex = fillColor.substr(1)
          hex = 'hex' + hex
          if (saa.Tuulikartta.data[i][param] !== null && parseFloat(saa.Tuulikartta.data[i][param]) > 0) {
            var marker = L.marker(new L.LatLng(saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']),
              {
                interactive: true,
                keyboard: false,
                icon: Tuulikartta.createLabelIcon(hex, parseFloat(saa.Tuulikartta.data[i][param]).toFixed(1))
              })
            if (saa.Tuulikartta.data[i]['type'] === 'synop') {
              marker.addTo(saa.Tuulikartta.markerGroupSynop)
            } else {
              marker.addTo(saa.Tuulikartta.markerGroupRoad)
            }
            marker.bindPopup(saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i],
            saa.Tuulikartta.data[i]['fmisid']),{
              maxWidth: maxWidth
            })
            marker.fmisid = saa.Tuulikartta.data[i]['fmisid']
            marker.type = saa.Tuulikartta.data[i]['type']
            renderedStationIndices.add(i)
          }
        }
        if(parseFloat(saa.Tuulikartta.data[i][param]) == 0 && saa.Tuulikartta.data[i][param] !== 'NaN' ) {
          var marker = L.marker(new L.LatLng(saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']),
            {
              interactive: true,
              keyboard: false,
              icon: Tuulikartta.createLabelIcon('textLabelclass', '–')
            })
          if (saa.Tuulikartta.data[i]['type'] === 'synop') {
              marker.addTo(saa.Tuulikartta.markerGroupSynop)
          } else {
              marker.addTo(saa.Tuulikartta.markerGroupRoad)
          }
          marker.bindPopup(saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i],
          saa.Tuulikartta.data[i]['fmisid']),{
            maxWidth: maxWidth
          })
          marker.fmisid = saa.Tuulikartta.data[i]['fmisid']
          marker.type = saa.Tuulikartta.data[i]['type']
          renderedStationIndices.add(i)
        }
      }

      if (param === 'rh') {
        if(saa.Tuulikartta.data[i][param] !== 'NaN' ) {
          var fillColor = Tuulikartta.resolveRelativeHumidity(saa.Tuulikartta.data[i][param])
          var hex = fillColor.substr(1)
          hex = 'hex' + hex
          if (saa.Tuulikartta.data[i][param] !== null && parseFloat(saa.Tuulikartta.data[i][param]) > 0) {
            var marker = L.marker(new L.LatLng(saa.Tuulikartta.data[i]['lat'], saa.Tuulikartta.data[i]['lon']),
              {
                interactive: true,
                keyboard: false,
                icon: Tuulikartta.createLabelIcon(hex, parseFloat(saa.Tuulikartta.data[i][param]).toFixed(1))
              })

            if (saa.Tuulikartta.data[i]['type'] === 'road') {
              marker.addTo(saa.Tuulikartta.markerGroupRoad)
            } else {
              marker.addTo(saa.Tuulikartta.markerGroupSynop)
            }

            marker.bindPopup(saa.Tuulikartta.populateInfoWindow(saa.Tuulikartta.data[i],
            saa.Tuulikartta.data[i]['fmisid']),{
              maxWidth: maxWidth
            })
            marker.fmisid = saa.Tuulikartta.data[i]['fmisid']
            marker.type = saa.Tuulikartta.data[i]['type']
            renderedStationIndices.add(i)
          }
        }

      }
    }

    renderedStationIndices.forEach(function(idx) {
      var data = saa.Tuulikartta.data[idx]
      if (Tuulikartta.isDataStale(data['epochtime'])) {
        var warnMarker = L.marker(
          [parseFloat(data['lat']), parseFloat(data['lon'])],
          { icon: warningIcon, interactive: false, keyboard: false, zIndexOffset: 1000 }
        )
        warnMarker.fmisid = data['fmisid'] || null
        warnMarker.type = data['type'] || null
        if (data['type'] === 'road') {
          warnMarker.addTo(saa.Tuulikartta.markerGroupRoad)
        } else {
          warnMarker.addTo(saa.Tuulikartta.markerGroupSynop)
        }
      }
    })

    if (saa.Tuulikartta.timeValue === 'now') {
      for (var i = 0; i < saa.Tuulikartta.data.length && i < 100; i++) {
        if (saa.Tuulikartta.data[i]['type'] === 'synop') {
	        var time = moment(saa.Tuulikartta.data[i]['time'], ['YYYY-MM-DDTHH:mm:ssZ'])
	        var timestring = time.format('DD.MM.YYYY HH:mm')
          document.getElementById('datepicker-button').value = timestring.split(' ')[0]
	        document.getElementById('clockpicker-button').value = timestring.split(' ')[1]
          break
        }
      }
    }
  }

  // tässä oli ennen populateInfoWindow

  window.resolveGraphStartposition = function(value) {
    if(value === 'ws_10min' || value === 'wg_10min' || value === 'ws_1d' || value === 'wg_1d')
    return 1
    else if(value === 'ri_10min' || value === 'ri_10min' || value === 'rr_1h' || value === 'rr_1d' || value === 't2m' || value === 'dewpoint' || value === 'tmax' || value === 'tmin' || value === 'wawa')
    return 2
    else if(value === 'vis' || value === 'n_man')
    return 3
    else if(value === 'dose_rate')
    return 4
    else if(value === 'air_activity')
    return 5
    else if(value === 'magnetism')
    return 6
    else if(value === 'snow_aws')
    return 7
    else
    return 1
  }

  // ---------------------------------------------------------
  // Update map icons and data with set interval
  // ---------------------------------------------------------

  setInterval(function () {
    if (saa.Tuulikartta.timeValue === 'now') {
      Tuulikartta.updateRadarData()
      saa.Tuulikartta.map.eachLayer(function (layer) {
        if (layer instanceof L.TileLayer && 'wmsParams' in layer) {
          layer.setParams({})
          if (saa.Tuulikartta.namelayer) saa.Tuulikartta.namelayer.bringToFront()
        }
      })
    }
  }, interval)
}(saa.Tuulikartta = saa.Tuulikartta || {}))
