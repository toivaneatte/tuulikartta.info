/*
* Tuulikartta.info - Modernized Camera Module
* Copyright (C) 2017 Ville Ilkka
* Modernized: 2025
*/

var saa = saa || {};

(function(camera, undefined) {
  'use strict';

  // Constants
  const API_BASE = '/api/road/cameras'; // points to backend endpoint
  const WEATHER_API_BASE = '/api/road/obs'; // points to backend endpoint
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
  
  // Time Slider - store selected time value
  let selectedTime = null; // Stores time in HH:mm format (e.g., "14:30")
  let selectedTimeMinutes = 0; // Stores time as minutes since midnight (0-1440)
  let historyByPreset = {}; // { presetId: [{time: UnixMs, url: string}] }
  let currentPresetId = null; // currently active preset in mainPic
  let currentSliderTime = null; // currently selected slider time (Unix ms), null = live

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

  // Normalize camera station data from various API formats
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

 // Normalize weather station data from various API formats
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
    
    const backendSingleCameraUrl = `${API_BASE}/${stationId}`;
    $.when(
      fetchWithTimeout(backendSingleCameraUrl)
    ).done(function(backendResponse) {
      stationCache.set(stationId, backendResponse);
      callback(backendResponse, null);
      
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

    const backendUrl = `${WEATHER_API_BASE}/${encodeURIComponent(stationId)}`;

    // fetch data from backend handle it fowrard
     $.when(
      fetchWithTimeout(backendUrl),
      ).done(function(obsResponse) {
      // after successful fetch, store in cache and return
      weatherCache.set(stationId, obsResponse);
      callback(obsResponse, null);
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
    
    const backendCameraUrl = `${API_BASE}`;
    $.when(
      fetchWithTimeout(backendCameraUrl)
    ).done(function(backendResponse) {
      camera.draw(backendResponse);
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
        // Open new tab showing pictures, put station name to URL
        let w = window.open('/html/camera.html?station=' + stationName, '_blank'); 
        // Call API function
        camera.apiCall(w, feature);
      });
      
      saa.camera.markers.addLayer(marker);
      cameraCount++;
    }
    
    console.log(`Loaded ${cameraCount} camera stations`);
    saa.Tuulikartta.map.addLayer(saa.camera.markers);
  };

  // API call for popup window
  camera.apiCall = function(w, feature) {
      w.onload = function () {
        // Clean station name for display and put it in the header
        let cleanName = feature.properties.name.substring(feature.properties.name.indexOf("_") + 1).replaceAll("_", " ");
        w.document.getElementById("stationName").textContent =
        `Asema - ${cleanName}`;
        w.document.title = cleanName;

        // Collect station data
        const stationId = feature.properties && feature.properties.id;
        camera.loadStationDetails(stationId, function(details, error) {
          const station = camera.normalizeStation(details, feature);
          
          if (!station.latestUpdate && feature.latestUpdate) {
            station.latestUpdate = feature.latestUpdate;
          }
          
          // Format time and correct timezone, display in popup
          const latestTime = camera.resolveLatestTime(station);
          const local = moment.utc(latestTime).local();
          const formatted = local.format("DD.MM.YYYY HH:mm");
          w.document.getElementById("updateTime").textContent = formatted;

          // Reset history state for this popup
          historyByPreset = {};
          currentPresetId = null;
          currentSliderTime = null;

          // Collect presets with images
          const presets = station.properties.presets || [];
          const imagePresets = [];

          for (let i = 0; i < presets.length; i++) {
            // Don't show presets not in collection
            if (presets[i].inCollection === false) continue;
            // Skip if over a month old
            if (moment().diff(presets[i].measuredTime, 'months') > 1) {
              continue;
            }

            const presetUrl = camera.resolvePresetImageUrl(presets[i]);
            if (presetUrl) {
              imagePresets.push({ preset: presets[i], url: presetUrl });
            }
          }

          // Go trough image presets
          for (let i = 0; i < imagePresets.length; i++) {
            const preset = imagePresets[i].preset;
            const presetTitle = camera.resolvePresetTitle(preset);
            const cleanPresetTitle = presetTitle.replaceAll("_", " ");
            // Make the HTML image output and insert it into the popup window
            if (i == 0) {
              // Track the first (main) preset as current and show it in main view
              currentPresetId = preset.id;
              let mainOutput = `<img src="${imagePresets[i].url}"
                                style="width:97%;
                                margin: 10px auto;"
                                alt="${cleanPresetTitle}">
                                <p style="text-align:center; color: black;
                                font-size: 1.5em; margin: 1px;">${cleanPresetTitle}</p>`;
              w.document.getElementById("mainPic").innerHTML = mainOutput;
            }
            // Build thumbnail for every preset (including first) so all can be selected
            let output = `<button type="button"
                          data-preset-id="${preset.id}"
                          onclick="(function(mini){
                            var doc=(mini&&mini.ownerDocument)?mini.ownerDocument:document;
                            var main=doc.getElementById('mainPic');
                            if(!main) return;
                            var mainImg=main.querySelector('img');
                            var miniImg=mini.querySelector('img');
                            if(!mainImg||!miniImg) return;
                            mainImg.src=miniImg.src;
                            mainImg.alt=miniImg.alt||'';
                            var mainTxt=main.querySelector('p');
                            var miniTxt=mini.querySelector('span');
                            if(mainTxt&&miniTxt) mainTxt.textContent=miniTxt.textContent;
                            var opener=doc.defaultView&&doc.defaultView.opener;
                            if(opener&&opener.saa&&opener.saa.camera)opener.saa.camera.setCurrentPreset(mini.dataset.presetId,doc.defaultView||window);})(this)"
                          style="background-color: #ccefff;
                          border-radius: 5px;
                          border: none;
                          padding: 0;
                          display: flex;
                          flex-direction: column;
                          align-items: center;
                          justify-content: center;
                          cursor: pointer;">
                          <img src="${imagePresets[i].url}"
                          style="width:200px;
                          padding: 3px;
                          margin-bottom: 3px;"
                          alt="${cleanPresetTitle}">
                          <span style="text-align:center; color: black;
                          padding: 2px;">${cleanPresetTitle}</span>
                          </button>`;
            w.document.getElementById("miniPics").innerHTML += output;
          }

          // Fetch history and initialize slider
          camera.loadStationHistory(stationId, function(history) {
            historyByPreset = history;
            camera.initTimeSlider(w, latestTime, history);
          });
          // Collect weather data from nearest station, if available
          let nearest = station.properties.nearestWeatherStationId;
          if (nearest != null) { 
            w.document.getElementById("noNearestStation").style.display = "none";
            camera.fetchWeatherData(nearest, function(details, error) {
              const station = camera.normalizeWeatherStation(details);
              
              // Format time and correct timezone, display in popup
              const local = moment.utc(station.dataUpdatedTime).local();
              const formatted = local.format("DD.MM.YYYY HH:mm");
              w.document.getElementById("date").textContent = formatted;

              const weatherElementIds = ["temp", "wind", "visibKm", "humid", "water", "snow", "ice", "roadTemp", "groundTemp", "windDir", "visibM", "rain"];
              const sensorNames = ["ILMA", "KESKITUULI", "NÄKYVYYS_KM", "ILMAN_KOSTEUS", "VEDEN_MÄÄRÄ1", "LUMEN_MÄÄRÄ1", "JÄÄN_MÄÄRÄ1",
                "TIE_1", "MAA_1", "TUULENSUUNTA", "NÄKYVYYS_M", "SADE_INTENSITEETTI"];

              // Collect weather values and insert into the info view
              for (let i = 0; i < station.sensorValues.length; i++) {
                let sensor = station.sensorValues[i];
                for (let j = 0; j < sensorNames.length; j++) {
                  if (sensor.name === sensorNames[j]) {
                    const el = w.document.getElementById(weatherElementIds[j]);
                    if (el) {
                      el.textContent = `${sensor.value} ${sensor.unit}`;
                    }
                    break;
                  }
                }
              }

              // Hide rows with empty values
              for (let i = 0; i < weatherElementIds.length; i++) {
                const el = w.document.getElementById(weatherElementIds[i]);
                if (el && el.textContent.trim() === "") { 
                  const row = el.closest(".dataRow"); 
                  if (row) row.style.display = "none"; 
                }
              }

              // Hide road data if not available
              for (const group of w.document.querySelectorAll(".dataGroup")) {
                let roadDataAvailable = false;
                for (const el of group.querySelectorAll(".dataRow")) {
                  if (el.style.display !== "none") {
                    roadDataAvailable = true;
                    break;
                  }
                }
                if (!roadDataAvailable) {
                  group.style.display = "none";
                }
              }
            });
          }
          // If no nearest station, show message and hide info view
          else {
            w.document.getElementById("noNearestStation").textContent = "Lähintä sääasemaa ei löytynyt";
            w.document.getElementById("stationInfoView").style.display = "none";
          }
        });
      }
    };

  // Expose cache clear for manual maintenance
  camera.clearCache = function() {
    stationCache.clear();
    weatherCache.clear();
    console.log('Camera cache cleared');
  };

  // Fetch station camera history from backend
  camera.loadStationHistory = function(stationId, callback) {
    if (!stationId) { callback({}); return; }
    const url = `${API_BASE}/${stationId}/history`;
    $.when(fetchWithTimeout(url))
      .done(function(data) {
        const result = {};
        if (data && data.presets) {
          for (let i = 0; i < data.presets.length; i++) {
            const preset = data.presets[i];
            if (!preset.history || preset.history.length === 0) continue;
            result[preset.id] = preset.history
              .map(function(e) { return { time: new Date(e.lastModified).getTime(), url: e.imageUrl }; })
              .sort(function(a, b) { return a.time - b.time; });
          }
        }
        callback(result);
      })
      .fail(function() {
        console.warn('Failed to load camera history for station:', stationId);
        callback({});
      });
  };

  // Update mainPic and all thumbnails to the image closest to the given Unix ms timestamp
  camera.updateImagesForTime = function(w, timestamp) {
    // Update main image
    if (currentPresetId && historyByPreset[currentPresetId]) {
      const entries = historyByPreset[currentPresetId];
      if (entries.length > 0) {
        const closest = entries.reduce(function(best, e) {
          return Math.abs(e.time - timestamp) < Math.abs(best.time - timestamp) ? e : best;
        });
        const mainPic = w.document.getElementById('mainPic');
        if (mainPic) {
          const img = mainPic.querySelector('img');
          if (img) img.src = closest.url;
        }
      }
    }

    // Update each thumbnail to match the selected time
    const miniButtons = w.document.querySelectorAll('#miniPics button[data-preset-id]');
    for (let i = 0; i < miniButtons.length; i++) {
      const btn = miniButtons[i];
      const pid = btn.dataset.presetId;
      if (!historyByPreset[pid] || historyByPreset[pid].length === 0) continue;
      const entries = historyByPreset[pid];
      const closest = entries.reduce(function(best, e) {
        return Math.abs(e.time - timestamp) < Math.abs(best.time - timestamp) ? e : best;
      });
      const miniImg = btn.querySelector('img');
      if (miniImg) miniImg.src = closest.url;
    }
  };

  // Update active preset and refresh mainPic for current slider time (called from thumbnail onclick)
  camera.setCurrentPreset = function(presetId, w) {
    currentPresetId = presetId;
    if (currentSliderTime !== null) {
      camera.updateImagesForTime(w, currentSliderTime);
    }
  };

  // Time Slider Handler
  camera.initTimeSlider = function(w, latestTime, history) {
    const timeSlider = w.document.getElementById('timeInput');
    const timeDisplay = w.document.getElementById('timeDisplay');

    if (!timeSlider || !timeDisplay) {
      w.console.warn('Time slider elements not found in DOM');
      return;
    }

    // Collect all timestamps from history across all presets
    const allTimes = [];
    const presetIds = Object.keys(history || {});
    for (let i = 0; i < presetIds.length; i++) {
      const entries = history[presetIds[i]];
      for (let j = 0; j < entries.length; j++) {
        allTimes.push(entries[j].time);
      }
    }

    if (allTimes.length === 0) {
      // No history available, hide the slider
      const sliderContainer = w.document.getElementById('timeSlider');
      if (sliderContainer) sliderContainer.style.display = 'none';
      return;
    }

    const minTime = Math.min.apply(null, allTimes);
    const maxTime = Math.max.apply(null, allTimes);

    timeSlider.min = minTime;
    timeSlider.max = maxTime;
    timeSlider.value = maxTime;
    timeSlider.step = 60 * 1000; // 1 minute in ms

    // Show current time in display
    timeDisplay.textContent = moment(maxTime).local().format('HH:mm');
    currentSliderTime = null; // at max = live view
    // Debounce slider input to prevent excessive API calls when dragging (400ms delay, adjust at line 725)
    var updateDebounceTimer = null;
    timeSlider.addEventListener('input', function() {
      const selected = parseInt(this.value);
      timeDisplay.textContent = moment(selected).local().format('HH:mm');
      currentSliderTime = (selected === maxTime) ? null : selected;
      clearTimeout(updateDebounceTimer);
      updateDebounceTimer = setTimeout(function() {
        camera.updateImagesForTime(w, selected);
      }, 400);
    });
  };
  
  // Public method to get selected time
  camera.getSelectedTime = function() {
    return selectedTime;
  };

  // Public method to get selected time in minutes
  camera.getSelectedTimeMinutes = function() {
    return selectedTimeMinutes;
  };

}(saa.camera = saa.camera || {}));