/*
* Tuulikartta.info
* Copyright (C) 2017 Ville Ilkka
*/

var saa = saa || {};

(function(camera, undefined) {


  var now = moment(new Date()),
      stations = '',
      imageWidth = 600, // pixels
      maxWidth = 750,
      maxCameraAgeMinutes = 24 * 60

  camera.stationCache = {}

  camera.normalizeStation = function(raw, fallback) {
    if (raw && raw.properties) {
      return raw
    }
    var source = raw || {}
    var fallbackProps = (fallback && fallback.properties) ? fallback.properties : {}
    return {
      properties: {
        id: source.id || fallbackProps.id,
        name: source.name || fallbackProps.name,
        dataUpdatedTime: source.dataUpdatedTime || fallbackProps.dataUpdatedTime,
        presets: source.presets || fallbackProps.presets || []
      },
      latestUpdate: source.latestUpdate || (fallback && fallback.latestUpdate)
    }
  }

  camera.resolveLatestTime = function(station) {
    if (!station) return null
    if (station.latestUpdate) return moment(station.latestUpdate)
    var presets = (station.properties && station.properties.presets) ? station.properties.presets : []
    var latest = null
    for (var i = 0; i < presets.length; i++) {
      var candidate = presets[i].measuredTime || presets[i].imageTime || presets[i].time
      if (!candidate) continue
      var candidateMoment = moment(candidate)
      if (!latest || candidateMoment.isAfter(latest)) {
        latest = candidateMoment
      }
    }
    if (latest) return latest
    if (station.properties && station.properties.dataUpdatedTime) {
      return moment(station.properties.dataUpdatedTime)
    }
    return latest
  }

  camera.resolvePresetImageUrl = function(preset) {
    if (!preset) return null
    return preset.imageUrl || preset.imageURL || preset.url || preset.image || preset.thumbnailUrl || null
  }

  camera.resolvePresetTitle = function(preset) {
    return preset.presentationName || preset.name || preset.id || ''
  }

  camera.initPopupCarousel = function(popup) {
    if (!popup || !popup._contentNode) return
    var $carousels = $(popup._contentNode).find('.owl-carousel')
    if (!$carousels.length) return
    $carousels.each(function() {
      var $el = $(this)
      if ($el.hasClass('owl-loaded')) return
      $el.owlCarousel({
        navigation: true,
        slideSpeed: 300,
        paginationSpeed: 400,
        items: 1,
        pagination: false,
        startPosition: 0
      })
    })
  }

  camera.loadStationDetails = function(stationId, done) {
    if (!stationId) {
      done(null)
      return
    }
    if (camera.stationCache[stationId]) {
      done(camera.stationCache[stationId])
      return
    }
    
    var metadataUrl = 'https://tie.digitraffic.fi/api/weathercam/v1/stations/' + encodeURIComponent(stationId);
    var dataUrl = 'https://tie.digitraffic.fi/api/weathercam/v1/stations/' + encodeURIComponent(stationId) + '/data';
    
    $.when(
      $.get({ dataType: 'json', url: metadataUrl }),
      $.get({ dataType: 'json', url: dataUrl })
    ).done(function(metadataResponse, dataResponse) {
      var metadata = metadataResponse[0];
      var freshData = dataResponse[0];
      
      if (metadata && metadata.properties && metadata.properties.presets && freshData && freshData.presets) {
        for (var i = 0; i < metadata.properties.presets.length; i++) {
          var metaPreset = metadata.properties.presets[i];
          for (var j = 0; j < freshData.presets.length; j++) {
            if (freshData.presets[j].id === metaPreset.id) {
              metaPreset.measuredTime = freshData.presets[j].measuredTime;
              break;
            }
          }
        }
        if (freshData.dataUpdatedTime) {
          metadata.properties.dataUpdatedTime = freshData.dataUpdatedTime;
        }
      }
      
      camera.stationCache[stationId] = metadata;
      done(metadata);
    }).fail(function(xhr, status, error) {
      console.error('Virhe haettaessa aseman tietoja:', status, error);
      done(null);
    });
  }

  saa.camera.markers = L.markerClusterGroup({
        spiderfyOnMaxZoom: false,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        removeOutsideVisibleBounds: true,
        chunkedLoading: true,
        chunkInterval: 1000,
        maxClusterRadius: 100,
        disableClusteringAtZoom: 10,
        iconCreateFunction: function(cluster) {
          return L.divIcon({ html:
            '<div style="text-align:center; width:40px;font-size:13px;">'+
               '<img src="../symbols/cameragry.svg" style="width:50px;height:50px;margin-bottom:-7px">' +
               '<b>' + cluster.getChildCount() + '</b>' +
            '</div>'
          });
        }
      });

  camera.init = function() {
    
    saa.Tuulikartta.map.spin(true, {
      lines: 14,
      length: 25,
      width: 27,
      radius: 80,
      scale: 0.35,
      corners: 1,
      speed: 1.4,
      animation: 'spinner-line-fade-quick',
      color: '#b1b1b1'
    })
    
    var metadataUrl = 'https://tie.digitraffic.fi/api/weathercam/v1/stations';
    var dataUrl = 'https://tie.digitraffic.fi/api/weathercam/v1/stations/data';
    
    $.when(
      $.get({ dataType: 'json', url: metadataUrl }),
      $.get({ dataType: 'json', url: dataUrl })
    ).done(function(metadataResponse, dataResponse) {
      var metadata = metadataResponse[0];
      var cameraData = dataResponse[0];
      var mergedData = camera.mergeMetadataAndData(metadata, cameraData);
      
      saa.Tuulikartta.map.spin(false);
      camera.draw(mergedData);
    }).fail(function(xhr, status, error) {
      console.error('Camera API error:', status, error);
      saa.Tuulikartta.map.spin(false);
    });
  }
  
  camera.mergeMetadataAndData = function(metadata, cameraData) {
    if (!metadata || !metadata.features) return metadata;
    if (!cameraData || !cameraData.stations) return metadata;
    
    var dataLookup = {};
    for (var i = 0; i < cameraData.stations.length; i++) {
      var station = cameraData.stations[i];
      dataLookup[station.id] = station;
    }
    
    for (var i = 0; i < metadata.features.length; i++) {
      var feature = metadata.features[i];
      var stationId = feature.properties.id;
      var freshData = dataLookup[stationId];
      
      if (freshData && freshData.presets) {
        feature.properties.dataUpdatedTime = freshData.dataUpdatedTime;
        
        if (feature.properties.presets) {
          for (var j = 0; j < feature.properties.presets.length; j++) {
            var preset = feature.properties.presets[j];
            for (var k = 0; k < freshData.presets.length; k++) {
              if (freshData.presets[k].id === preset.id) {
                preset.measuredTime = freshData.presets[k].measuredTime;
                break;
              }
            }
          }
        }
      }
    }
    
    return metadata;
  }

  camera.draw = function(data) {

    now = moment()

    if (L.Browser.mobile) {
      maxWidth = 280
      imageWidth = 280
    }

    $('#graph-box-loader').html("");
    saa.camera.markers.clearLayers()

    // Check if data has features
    if(!data || !data.features) {
      console.error('No features in camera data');
      return;
    }

    var cameraCount = 0;
    
    for (var i = 0; i < data.features.length; i++) {
      
      var feature = data.features[i]
      
      // Skip if no presets available
      if(!feature.properties || !feature.properties.presets || feature.properties.presets.length === 0) {
        continue;
      }
      
      var latestTime = camera.resolveLatestTime(feature)
      var diff = null
      if (latestTime) {
        diff = (moment.duration(now.diff(latestTime))).asMinutes()
        if (diff < 0) continue
      }

      var symbol = '';
      if (diff === null) {
        symbol = 'cameragry.svg';
      } else if (diff >= 0 && diff <= 15) {
        symbol = 'cameragre.svg';
      } else if (diff > 15 && diff <= 60) {
        symbol = 'camerayel.svg';
      } else if (diff > 60 && diff <= 360) { // 6 hours
        symbol = 'cameragry.svg';
      } else if (diff > maxCameraAgeMinutes) {
        continue;
      } else {
        symbol = 'cameragry.svg';
      }

      var icon = L.icon({
        iconUrl: "../symbols/"+symbol,
        iconSize: [30, 30],
        iconAnchor: [5, 5],
        popupAnchor: [0, 0]
      });

      var coords = feature.geometry.coordinates;
      var marker = L.marker([coords[1], coords[0]], {
        icon: icon
      });
      
      // Store latest time in feature for popup
      feature.latestUpdate = latestTime ? latestTime.toISOString() : null;
      
      marker.bindPopup(saa.camera.populateInfoWindow(feature),{
        maxWidth: maxWidth
      });

      marker.on('popupopen', (function(stationFeature) {
        return function(e) {
          camera.initPopupCarousel(e.popup)
          var stationId = stationFeature.properties && stationFeature.properties.id
          if (!stationId || stationFeature._detailsLoaded) return
          camera.loadStationDetails(stationId, function(details) {
            if (!details) return
            stationFeature._detailsLoaded = true
            var normalized = camera.normalizeStation(details, stationFeature)
            if (!normalized.latestUpdate && stationFeature.latestUpdate) {
              normalized.latestUpdate = stationFeature.latestUpdate
            }
            e.popup.setContent(camera.populateInfoWindow(normalized))
            camera.initPopupCarousel(e.popup)
          })
        }
      })(feature))
      
      saa.camera.markers.addLayer(marker);
      cameraCount++;
    }
    
    saa.Tuulikartta.map.addLayer(saa.camera.markers);
  }

  camera.populateInfoWindow = function(data) {

    var station = camera.normalizeStation(data)
    var localNow = moment()
    var latestTime = camera.resolveLatestTime(station)
    var diff = latestTime ? Math.round((moment.duration(localNow.diff(latestTime))).asMinutes()) : null
    
    // Use name instead of names.fi in new API
    var stationName = station.properties.name || station.properties.id;

    var output = '<div style="text-align:center;width:'+imageWidth+'px;">';
    output += '<div>';
    output += '<span id="station-update-cam-name"><b>'+translations[window.selectedLanguage]['cameraStationName']+':</b> '+stationName+'</span><br/>';
    if (diff !== null) {
      output += '<span id="station-update-cam-update"><b>'+translations[window.selectedLanguage]['latestUpdate']+'</b>: '+diff+' '+translations[window.selectedLanguage]['minutesAgo']+'</span>';
    } else {
      output += '<span id="station-update-cam-update"><b>'+translations[window.selectedLanguage]['latestUpdate']+'</b>: -</span>';
    }
    output += '</div>';

    var presets = station.properties.presets || []
    var imagePresets = []
    for (var i = 0; i < presets.length; i++) {
      var presetUrl = camera.resolvePresetImageUrl(presets[i])
      if (presetUrl) {
        imagePresets.push({ preset: presets[i], url: presetUrl })
      }
    }

    if (imagePresets.length === 0) {
      output += '<div>Loading images...</div>'
      return output + '</div>'
    }

    output += '<div class="owl-carousel owl-theme">';
    for (var i = 0; i < imagePresets.length; i++) {
      var preset = imagePresets[i].preset
      output += '<div>';
      output += '<span><b>'+translations[window.selectedLanguage]['cameraName']+': </b>'+camera.resolvePresetTitle(preset)+'</span><br/>';
      output += '<img src="'+imagePresets[i].url+'" style="width:'+imageWidth+'px;">';
      output += '</div>';
    }
    output += '</div>';

    return output;
  }

}(saa.camera = saa.camera || {}));