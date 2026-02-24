/*
* Tuulikartta.info - Modernized Camera Module
* Copyright (C) 2017 Ville Ilkka
* Modernized: 2025
*/

var saa = saa || {};

(function(camera, undefined) {
  'use strict';

  // Constants
  const API_BASE = 'https://tie.digitraffic.fi/api/weathercam/v1';
  const WEATHER_API_BASE = 'https://tie.digitraffic.fi/api/weather/v1';
  const SYMBOL_PATH = '../symbols/';
  const MAX_CAMERA_AGE_MINUTES = 24 * 60;
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
  const API_TIMEOUT_MS = 10000;
  
  const IMAGE_CONFIG = {
    mobile: { width: 280, maxWidth: 280 },
    desktop: { width: 600, maxWidth: 750 }
  };

  const CAMERA_STATUS = {
    FRESH: { maxAge: 15, icon: 'cameragre.svg' },    // 0-15 min: green
    RECENT: { maxAge: 60, icon: 'camerayel.svg' },   // 15-60 min: yellow
    OLD: { maxAge: 360, icon: 'cameragry.svg' },     // 60-360 min: gray
    STALE: { maxAge: MAX_CAMERA_AGE_MINUTES, icon: 'cameragry.svg' }
  };

  // State management
  let imageWidth = IMAGE_CONFIG.desktop.width;
  let maxWidth = IMAGE_CONFIG.desktop.maxWidth;
  let isLoading = false;

  // Cache with TTL
  const stationCache = {
    data: {},
    timestamps: {},
    
    get(stationId) {
      const cached = this.data[stationId];
      const timestamp = this.timestamps[stationId];
      
      if (cached && timestamp && (Date.now() - timestamp < CACHE_TTL_MS)) {
        return cached;
      }
      return null;
    },
    
    set(stationId, data) {
      this.data[stationId] = data;
      this.timestamps[stationId] = Date.now();
    },
    
    clear() {
      this.data = {};
      this.timestamps = {};
    }
  };

  const weatherCache = {
    data: {},
    timestamps: {},
    
    get(stationId) {
      const cached = this.data[stationId];
      const timestamp = this.timestamps[stationId];
      
      if (cached && timestamp && (Date.now() - timestamp < CACHE_TTL_MS)) {
        return cached;
      }
      return null;
    },
    
    set(stationId, data) {
      this.data[stationId] = data;
      this.timestamps[stationId] = Date.now();
    },
    
    clear() {
      this.data = {};
      this.timestamps = {};
    }
  };

  // Utility: API request with timeout
  function fetchWithTimeout(url, timeout = API_TIMEOUT_MS) {
    return $.ajax({
      url: url,
      dataType: 'json',
      timeout: timeout
    });
  }

  // Utility: Get translation safely
  function getTranslation(key) {
    const lang = window.selectedLanguage || 'fi';
    const translations = window.translations || {};
    const langTranslations = translations[lang] || translations['fi'] || {};
    return langTranslations[key] || key;
  }

  // Normalize station data from various API formats
  camera.normalizeStation = function(raw, fallback) {
    if (raw && raw.properties) {
      return raw;
    }
    
    const source = raw || {};
    const fallbackProps = (fallback && fallback.properties) ? fallback.properties : {};
    
    const id = source.id || fallbackProps.id;
    if (!id) {
      console.warn('Station missing ID', { raw, fallback });
      return null;
    }
    
    return {
      properties: {
        id: id,
        name: source.name || fallbackProps.name || id,
        dataUpdatedTime: source.dataUpdatedTime || fallbackProps.dataUpdatedTime,
        presets: source.presets || fallbackProps.presets || [],
        nearestWeatherStationId: source.nearestWeatherStationId || fallbackProps.nearestWeatherStationId || null
      },
      latestUpdate: source.latestUpdate || (fallback && fallback.latestUpdate)
    };
  };

 // Normalize station data from various API formats
camera.normalizeWeatherStation = function(raw) {
    if (!raw || !raw.properties) return null;

    const props = raw.properties;

    return {
        id: props.id,
        name: props.name || props.id,
        dataUpdatedTime: props.dataUpdatedTime || null,
        sensors: props.sensors || [],
        sensorValues: props.sensorValues || []
    };
};

  // Find the most recent timestamp from station presets
  camera.resolveLatestTime = function(station) {
    if (!station) return null;
    if (station.latestUpdate) return moment(station.latestUpdate);
    
    const presets = (station.properties && station.properties.presets) ? station.properties.presets : [];
    let latest = null;
    
    for (let i = 0; i < presets.length; i++) {
      const candidate = presets[i].measuredTime || presets[i].imageTime || presets[i].time;
      if (!candidate) continue;
      
      const candidateMoment = moment(candidate);
      if (!latest || candidateMoment.isAfter(latest)) {
        latest = candidateMoment;
      }
    }
    
    if (latest) return latest;
    
    if (station.properties && station.properties.dataUpdatedTime) {
      return moment(station.properties.dataUpdatedTime);
    }
    
    return null;
  };

  // Extract image URL from preset (handles multiple field names)
  camera.resolvePresetImageUrl = function(preset) {
    if (!preset) return null;
    return preset.imageUrl || preset.imageURL || preset.url || 
           preset.image || preset.thumbnailUrl || null;
  };

  // Get preset display title
  camera.resolvePresetTitle = function(preset) {
    return preset.presentationName || preset.name || preset.id || '';
  };

  // Determine camera icon based on age
  camera.getCameraIcon = function(ageMinutes) {
    if (ageMinutes === null) return CAMERA_STATUS.OLD.icon;
    
    for (const status of Object.values(CAMERA_STATUS)) {
      if (ageMinutes <= status.maxAge) {
        return status.icon;
      }
    }
    
    return CAMERA_STATUS.OLD.icon;
  };


  // Load detailed station data from API
  camera.loadStationDetails = function(stationId, callback) {
    if (!stationId) {
      callback(null, 'Missing station ID');
      return;
    }
    
    // Check cache first
    const cached = stationCache.get(stationId);
    if (cached) {
      callback(cached, null);
      return;
    }
    
    const metadataUrl = `${API_BASE}/stations/${encodeURIComponent(stationId)}`;
    const dataUrl = `${API_BASE}/stations/${encodeURIComponent(stationId)}/data`;
    
    $.when(
      fetchWithTimeout(metadataUrl),
      fetchWithTimeout(dataUrl)
    ).done(function(metadataResponse, dataResponse) {
      const metadata = metadataResponse[0];
      const freshData = dataResponse[0];
      
      // Merge metadata with fresh data
      if (metadata && metadata.properties && metadata.properties.presets && 
          freshData && freshData.presets) {
        
        for (let i = 0; i < metadata.properties.presets.length; i++) {
          const metaPreset = metadata.properties.presets[i];
          
          for (let j = 0; j < freshData.presets.length; j++) {
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
      
      stationCache.set(stationId, metadata);
      callback(metadata, null);
      
    }).fail(function(xhr, status, error) {
      const errorMsg = `API error: ${status} - ${error}`;
      console.error('Failed to load station details:', errorMsg);
      callback(null, errorMsg);
    });
  };

  // Merge metadata and real-time data
  camera.mergeMetadataAndData = function(metadata, cameraData) {
    if (!metadata || !metadata.features) return metadata;
    if (!cameraData || !cameraData.stations) return metadata;
    
    // Create lookup table for O(1) access
    const dataLookup = {};
    for (let i = 0; i < cameraData.stations.length; i++) {
      const station = cameraData.stations[i];
      dataLookup[station.id] = station;
    }
    
    // Merge data into features
    for (let i = 0; i < metadata.features.length; i++) {
      const feature = metadata.features[i];
      const stationId = feature.properties.id;
      const freshData = dataLookup[stationId];
      
      if (freshData && freshData.presets) {
        feature.properties.dataUpdatedTime = freshData.dataUpdatedTime;
        
        if (feature.properties.presets) {
          for (let j = 0; j < feature.properties.presets.length; j++) {
            const preset = feature.properties.presets[j];
            
            for (let k = 0; k < freshData.presets.length; k++) {
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
  };

  camera.fetchWeatherData = function(stationId, callback) {

    if (!stationId) {
      callback(null, 'Missing station ID');
      return;
    }
    
    // Check cache first
    const cached = weatherCache.get(stationId);
    if (cached) {
      callback(cached, null);
      return;
    }

    const metadataUrl = `${WEATHER_API_BASE}/stations/${encodeURIComponent(stationId)}`;
    const dataUrl = `${WEATHER_API_BASE}/stations/${encodeURIComponent(stationId)}/data`;

     $.when(
      fetchWithTimeout(metadataUrl),
      fetchWithTimeout(dataUrl)
    ).done(function(metadataResponse, dataResponse) {
      const metadata = metadataResponse[0];
      const freshData = dataResponse[0];
      
      // Merge metadata with fresh data
      if (metadata && metadata.properties && metadata.properties.sensors && 
          freshData && freshData.sensorValues) {
        
        for (let i = 0; i < metadata.properties.sensors.length; i++) {
          const metaSensor = metadata.properties.sensors[i];
          
          for (let j = 0; j < freshData.sensorValues.length; j++) {
            if (freshData.sensorValues[j].id === metaSensor.id) {
              metaSensor.measuredTime = freshData.sensorValues[j].measuredTime;
              break;
            }
          }
        }
        
        if (freshData.dataUpdatedTime) {
          metadata.properties.dataUpdatedTime = freshData.dataUpdatedTime;
        }

        metadata.properties.sensorValues = freshData.sensorValues;
      }
      
      weatherCache.set(stationId, metadata);
      callback(metadata, null);
      
    }).fail(function(xhr, status, error) {
      const errorMsg = `API error: ${status} - ${error}`;
      console.error('Failed to load station details:', errorMsg);
      callback(null, errorMsg);
    });
  };

  // Initialize marker cluster
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
      return L.divIcon({ 
        html: `
          <div style="text-align:center; width:40px; font-size:13px;">
            <img src="${SYMBOL_PATH}cameragry.svg" style="width:50px; height:50px; margin-bottom:-7px">
            <b>${cluster.getChildCount()}</b>
          </div>
        `
      });
    }
  });

  // Initialize camera layer
  camera.init = function() {
    // Prevent duplicate loading
    if (isLoading) {
      console.warn('Camera init already in progress');
      return;
    }
    
    isLoading = true;
    
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
    });
    
    const metadataUrl = `${API_BASE}/stations`;
    const dataUrl = `${API_BASE}/stations/data`;
    
    $.when(
      fetchWithTimeout(metadataUrl),
      fetchWithTimeout(dataUrl)
    ).done(function(metadataResponse, dataResponse) {
      const metadata = metadataResponse[0];
      const cameraData = dataResponse[0];
      const mergedData = camera.mergeMetadataAndData(metadata, cameraData);
      
      camera.draw(mergedData);
      
    }).fail(function(xhr, status, error) {
      console.error('Camera API initialization failed:', status, error);
      alert(`Kamerakerroksen lataus epäonnistui: ${status}. Yritä päivittää sivu.`);
      
    }).always(function() {
      saa.Tuulikartta.map.spin(false);
      isLoading = false;
    });
  };

  // Draw camera markers on map
  camera.draw = function(data) {
    // Set responsive image sizes
    if (L.Browser.mobile) {
      imageWidth = IMAGE_CONFIG.mobile.width;
      maxWidth = IMAGE_CONFIG.mobile.maxWidth;
    } else {
      imageWidth = IMAGE_CONFIG.desktop.width;
      maxWidth = IMAGE_CONFIG.desktop.maxWidth;
    }

    $('#graph-box-loader').html('');
    saa.camera.markers.clearLayers();

    if (!data || !data.features) {
      console.error('No features in camera data');
      return;
    }

    const now = moment();
    let cameraCount = 0;
    
    for (let i = 0; i < data.features.length; i++) {
      const feature = data.features[i];
      
      // Skip stations without presets
      if (!feature.properties || !feature.properties.presets || 
          feature.properties.presets.length === 0) {
        continue;
      }
      
      const latestTime = camera.resolveLatestTime(feature);
      let ageMinutes = null;
      
      if (latestTime) {
        ageMinutes = moment.duration(now.diff(latestTime)).asMinutes();
        
        // Skip future timestamps
        if (ageMinutes < 0) continue;
        
        // Skip cameras older than max age
        if (ageMinutes > MAX_CAMERA_AGE_MINUTES) continue;
      }

      // Create marker icon based on camera age
      const iconFile = camera.getCameraIcon(ageMinutes);
      const icon = L.icon({
        iconUrl: SYMBOL_PATH + iconFile,
        iconSize: [30, 30],
        iconAnchor: [5, 5],
        popupAnchor: [0, 0]
      });

      // Create marker
      const coords = feature.geometry.coordinates;
      const marker = L.marker([coords[1], coords[0]], { icon: icon });
      
      // Store latest time for popup
      feature.latestUpdate = latestTime ? latestTime.toISOString() : null;
      
      marker.on('click', function() {
        let stationName = feature.properties.name;
        // Open new tab showing pictures
        let w = window.open('/html/camera.html?station=' + stationName, '_blank'); 
        // kutsu api funktioo
        camera.apiCall(w, feature);
      });

      camera.apiCall = function(w, feature) {
        // api funktio muuokkaa asemanimiä ja laittaa selaimeen
        w.onload = function () {
          let cleanName = feature.properties.name.substring(feature.properties.name.indexOf("_") + 1).replaceAll("_", " ");
          w.document.getElementById("stationName").textContent =
          `Asema - ${cleanName}`;

          // hakee kuvat
          const stationId = feature.properties && feature.properties.id;
          camera.loadStationDetails(stationId, function(details, error) {
            const station = camera.normalizeStation(details, feature);
            
            if (!station.latestUpdate && feature.latestUpdate) {
              station.latestUpdate = feature.latestUpdate;
            }
            
            const now = moment();
            const latestTime = camera.resolveLatestTime(station);
            const ageMinutes = latestTime ? Math.round(moment.duration(now.diff(latestTime)).asMinutes()) : null;
            
            /*if (ageMinutes !== null) {
              output += `<span id="station-update-cam-update"><b>${getTranslation('latestUpdate')}</b>: ${ageMinutes} ${getTranslation('minutesAgo')}</span>`;
            } else {
              output += `<span id="station-update-cam-update"><b>${getTranslation('latestUpdate')}</b>: -</span>`;
            }
            output += '</div>';*/

            // Collect presets with images
            const presets = station.properties.presets || [];
            const imagePresets = [];
            
            for (let i = 0; i < presets.length; i++) {
              const presetUrl = camera.resolvePresetImageUrl(presets[i]);
              if (presetUrl) {
                imagePresets.push({ preset: presets[i], url: presetUrl });

              }
            } 

            for (let i = 0; i < imagePresets.length; i++) {
              const preset = imagePresets[i].preset;
              const presetTitle = camera.resolvePresetTitle(preset);
              // Insert it into the popup window 
              if (i == 0) {
                // Build the HTML for the image and insert it into the main picture container
                let mainOutput = `<img src="${imagePresets[i].url}"
                            style="width:${imageWidth}px;"
                            alt="${presetTitle}"> `;
                w.document.getElementById("mainPic").innerHTML = mainOutput;
              }
              else {
                // Build the HTML for the image and insert it into the thumbnail container
                let output = `<img src="${imagePresets[i].url}"
                            style="width:${imageWidth}px;"
                            alt="${presetTitle}"> `;
                w.document.getElementById("miniPics").innerHTML += output;
              }
            }
            // hakee asematiedot
            let nearest = station.properties.nearestWeatherStationId;
            if (nearest != null) { 
              camera.fetchWeatherData(nearest, function(details, error) {
                const station = camera.normalizeWeatherStation(details);
                
                for (let i = 0; i < station.sensorValues.length; i++) {
                  let sensor = station.sensorValues[i];
                  if (sensor.name === "ILMA") {
                    w.document.getElementById("temp").textContent =`${sensor.value} ${sensor.unit}`;
                  }
                  else if (sensor.name === "KESKITUULI") {
                    w.document.getElementById("wind").textContent =`${sensor.value} ${sensor.unit}`;  
                  }
                  else if (sensor.name === "NÄKYVYYS_KM") {
                    w.document.getElementById("visibKm").textContent =`${sensor.value} ${sensor.unit}`;  
                  }       
                  else if (sensor.name === "ILMAN_KOSTEUS") {
                    w.document.getElementById("humid").textContent =`${sensor.value} ${sensor.unit}`;  
                  }             
                  else if (sensor.name === "LUMEN_MÄÄRÄ1") {
                    w.document.getElementById("snow").textContent =`${sensor.value} ${sensor.unit}`;  
                  }   
                  else if (sensor.name === "TIE_1") {
                    w.document.getElementById("roadTemp").textContent =`${sensor.value} ${sensor.unit}`;  
                  }   
                  else if (sensor.name === "MAA_1") {
                    w.document.getElementById("groundTemp").textContent =`${sensor.value} ${sensor.unit}`;  
                  }   
                  else if (sensor.name === "TUULENSUUNTA") {
                    w.document.getElementById("windDir").textContent =`${sensor.value} ${sensor.unit}`;  
                  }
                  else if (sensor.name === "NÄKYVYYS_M") {
                    w.document.getElementById("visibM").textContent =`${sensor.value} ${sensor.unit}`;  
                  }   
                  else if (sensor.name === "SADE_INTENSITEETTI") {
                    w.document.getElementById("rain").textContent =`${sensor.value} ${sensor.unit}`;  
                  }      
                }
              });
            }
            else {
               w.document.getElementById("noNearestStation").textContent = "Lähintä sääasemaa ei löytynyt";
               w.document.getElementById("stationInfoView").style.display = "none";
            }
          });
        }
      };

/*
      // Handle popup open: load detailed data and init carousel
      marker.on('popupopen', (function(stationFeature) {
        return function(e) {
          const popup = e.popup;
          const requestId = Date.now();
          popup._requestId = requestId;
          
          
          // Load fresh station details if not already loaded
          const stationId = stationFeature.properties && stationFeature.properties.id;
          if (!stationId || stationFeature._detailsLoaded) return;
          
          camera.loadStationDetails(stationId, function(details, error) {
            // Check if popup is still open and request is current
            if (popup._requestId !== requestId || !popup._map) return;
            
            if (error) {
              popup.setContent(`
                <div style="padding: 20px; text-align: center;">
                  <p>Virhe ladattaessa kameran tietoja</p>
                  <p style="font-size: 12px; color: #666;">${error}</p>
                </div>
              `);
              return;
            }
            
            if (!details) {
              popup.setContent(`
                <div style="padding: 20px; text-align: center;">
                  <p>Aseman tietoja ei löytynyt</p>
                </div>
              `);
              return;
            }
            
            // Mark as loaded and update popup
            stationFeature._detailsLoaded = true;
            const normalized = camera.normalizeStation(details, stationFeature);
            
            if (!normalized.latestUpdate && stationFeature.latestUpdate) {
              normalized.latestUpdate = stationFeature.latestUpdate;
            }
            
            popup.setContent(camera.populateInfoWindow(normalized));
            camera.initPopupCarousel(popup);
          });
        };
      })(feature));
      */
      
      saa.camera.markers.addLayer(marker);
      cameraCount++;
    }
    
    console.log(`Loaded ${cameraCount} camera stations`);
    saa.Tuulikartta.map.addLayer(saa.camera.markers);
  };

  /*
  // Generate popup content HTML
  camera.populateInfoWindow = function(data) {
    const station = camera.normalizeStation(data);
    if (!station) {
      return '<div style="padding: 20px;">Invalid station data</div>';
    }
    
    const now = moment();
    const latestTime = camera.resolveLatestTime(station);
    const ageMinutes = latestTime ? Math.round(moment.duration(now.diff(latestTime)).asMinutes()) : null;
    
    const stationName = station.properties.name || station.properties.id;

    let output = `<div style="text-align:center; width:${imageWidth}px;">`;
    output += '<div>';
    output += `<span id="station-update-cam-name"><b>${getTranslation('cameraStationName')}:</b> ${stationName}</span><br/>`;
    
    if (ageMinutes !== null) {
      output += `<span id="station-update-cam-update"><b>${getTranslation('latestUpdate')}</b>: ${ageMinutes} ${getTranslation('minutesAgo')}</span>`;
    } else {
      output += `<span id="station-update-cam-update"><b>${getTranslation('latestUpdate')}</b>: -</span>`;
    }
    output += '</div>';

    // Collect presets with images
    const presets = station.properties.presets || [];
    const imagePresets = [];
    
    for (let i = 0; i < presets.length; i++) {
      const presetUrl = camera.resolvePresetImageUrl(presets[i]);
      if (presetUrl) {
        imagePresets.push({ preset: presets[i], url: presetUrl });
      }
    }

    if (imagePresets.length === 0) {
      output += '<div style="padding: 20px;">Ladataan kuvia...</div>';
      return output + '</div>';
    }

    // Create carousel with all camera images
    output += '<div class="owl-carousel owl-theme">';
    for (let i = 0; i < imagePresets.length; i++) {
      const preset = imagePresets[i].preset;
      const presetTitle = camera.resolvePresetTitle(preset);
      
      output += '<div>';
      output += `<span><b>${getTranslation('cameraName')}: </b>${presetTitle}</span><br/>`;
      output += `<img src="${imagePresets[i].url}" style="width:${imageWidth}px;" alt="${presetTitle}">`;
      output += '</div>';
    }
    output += '</div>';

    return output;
  };
*/

  // Expose cache clear for manual maintenance
  camera.clearCache = function() {
    stationCache.clear();
    weatherCache.clear();
    console.log('Camera cache cleared');
  };

}(saa.camera = saa.camera || {}));