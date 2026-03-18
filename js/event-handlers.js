/*
* Tuulikartta.info - Event Handlers
* Manages all UI event bindings and interactions
*/

var saa = saa || {};

(function (Tuulikartta, undefined) {
  'use strict'

  // ---------------------------------------------------------
  // Initialize all event handlers
  // ---------------------------------------------------------

  Tuulikartta.initEventHandlers = function() {
    // nämä ilmeisesti jQuerylla kirjoitettu

    // Select weather parameter
    $('#select-wind-parameter').change(function () {
      Tuulikartta.clearMarkers()
      Tuulikartta.drawData($(this).val())

      window.selectedParameter = $(this).val()
      window.startPosition = window.resolveGraphStartposition(window.selectedParameter)

      var lat = saa.Tuulikartta.map.getCenter().lat
      var lon = saa.Tuulikartta.map.getCenter().lng
      var zoom = saa.Tuulikartta.map.getZoom()
      window.location.replace('#lang='+window.selectedLanguage+'#latlon='+Math.round(lat*100)/100+','+Math.round(lon*100)/100+'#zoom='+zoom+'#parameter='+$(this).val())
    })

    // Popup open handler
    saa.Tuulikartta.map.on('popupopen', function(e) {
      var fmisid = e.popup._source.fmisid
      var type = e.popup._source.type
      if(type === 'Synop-asema') type = 'synop'
      if(type === 'Tiesääasema') type = 'road'
      saa.weatherGraph.getObservationGraph(fmisid,type,saa.Tuulikartta.timeValue)
      $(".owl-carousel").owlCarousel({
        navigation: true,
        slideSpeed: 300,
        paginationSpeed: 400,
        items: 1,
        pagination: false,
        startPosition: startPosition
      });
    })

    // Get and save user location to localStorage
    saa.Tuulikartta.map.on('move', function () {
      var lat = saa.Tuulikartta.map.getCenter().lat
      var lon = saa.Tuulikartta.map.getCenter().lng
      var zoom = saa.Tuulikartta.map.getZoom()
      localStorage.setItem('latitude', lat)
      localStorage.setItem('longitude', lon)
      localStorage.setItem('zoomlevel', zoom)

      // debounce only the location.replace call
      if (saa.Tuulikartta._replaceTimeout) clearTimeout(saa.Tuulikartta._replaceTimeout)
      saa.Tuulikartta._replaceTimeout = setTimeout(function() {
        window.location.replace(
          '#lang='+window.selectedLanguage+
          '#latlon='+Math.round(lat*100)/100+','+Math.round(lon*100)/100+','+zoom+
          '#parameter='+window.selectedParameter
        )
      }, 300) // run once every 300ms at most
    })

    // Get observations with timestamp
    $('#select-content-datasearch').click(function () {
      $(this).removeClass('inactive')
      $('#select-content-now').addClass('inactive')

      var date = document.getElementById('datepicker-button').value
      var time = document.getElementById('clockpicker-button').value

      var timestring = moment(date + ' ' + time, ['DD-MM-YYYY HH:mm'])
      timestring = timestring.utc().format('YYYY-MM-DDTHH:mm:ss')
      timestring = timestring + 'Z'

      // Don't fetch or spin if the selected time is in the future
      if (moment.utc(timestring).isAfter(moment.utc())) {
        Tuulikartta.clearMarkers()
        return
      }

      saa.Tuulikartta.timeValue = timestring
      saa.Tuulikartta.timeStamp = timestring

      Tuulikartta.clearMarkers()
      saa.Tuulikartta.radarLayer.setParams({time: saa.Tuulikartta.timeStamp})
      if (saa.Tuulikartta.namelayer) saa.Tuulikartta.namelayer.bringToFront()
      Tuulikartta.updateRadarData()
      getTrafficCamData = false
      $($("#map").find(".leaflet-control-select-cam")).removeClass('active');
    })

    // "Now" button handler
    $('#select-content-now').click(function () {
      saa.Tuulikartta.timeValue = 'now'
      $(this).removeClass('inactive')
      $('#select-content-datasearch').addClass('inactive')

      Tuulikartta.clearMarkers()
      Tuulikartta.updateRadarData()

      saa.Tuulikartta.radarLayer.setParams({time: saa.Tuulikartta.timeStamp})
      if (saa.Tuulikartta.namelayer) saa.Tuulikartta.namelayer.bringToFront()
    })

    // Progress time (+1 hour)
    $('#timepicker-progress-time').click(function () {
      $('#select-content-datasearch').removeClass('inactive')
      $('#select-content-now').addClass('inactive')

      Tuulikartta.clearMarkers()

      var date = document.getElementById('datepicker-button').value
      var time = document.getElementById('clockpicker-button').value

      var time = moment(date + ' ' + time, ['DD-MM-YYYY HH:mm'])
      var newTime = moment(time).add(1, 'hours')

      var timestring = newTime.utc().format('YYYY-MM-DDTHH:mm:ss')
      timestring = timestring + 'Z'
      saa.Tuulikartta.timeStamp = timestring

      var utcOffSet = moment(timestring).utcOffset()
      if (utcOffSet < 0) { newTime.subtrack(Math.abs(utcOffSet), 'minutes') }
      if (utcOffSet > 0) { newTime.add(Math.abs(utcOffSet), 'minutes') }

      document.getElementById('datepicker-button').value = newTime.format('DD.MM.YYYY')
      document.getElementById('clockpicker-button').value = newTime.format('HH:mm')

      saa.Tuulikartta.timeValue = timestring
      saa.Tuulikartta.timeStamp = timestring
      Tuulikartta.updateRadarData()

      saa.Tuulikartta.radarLayer.setParams({time: saa.Tuulikartta.timeStamp})
      if (saa.Tuulikartta.namelayer) saa.Tuulikartta.namelayer.bringToFront()
    })

    // Regress time (-1 hour)
    $('#timepicker-regress-time').click(function () {
      $('#select-content-datasearch').removeClass('inactive')
      $('#select-content-now').addClass('inactive')

      Tuulikartta.clearMarkers()

      var date = document.getElementById('datepicker-button').value
      var time = document.getElementById('clockpicker-button').value

      var time = moment(date + ' ' + time, ['DD-MM-YYYY HH:mm'])
      var newTime = moment(time).subtract(1, 'hours')

      var timestring = newTime.utc().format('YYYY-MM-DDTHH:mm:ss')
      timestring = timestring + 'Z'
      saa.Tuulikartta.timeStamp = timestring

      var utcOffSet = moment(timestring).utcOffset()
      if (utcOffSet < 0) { newTime.subtrack(Math.abs(utcOffSet), 'minutes') }
      if (utcOffSet > 0) { newTime.add(Math.abs(utcOffSet), 'minutes') }

      document.getElementById('datepicker-button').value = newTime.format('DD.MM.YYYY')
      document.getElementById('clockpicker-button').value = newTime.format('HH:mm')

      saa.Tuulikartta.timeValue = timestring
      Tuulikartta.updateRadarData()

      saa.Tuulikartta.radarLayer.setParams({time: saa.Tuulikartta.timeStamp})
      if (saa.Tuulikartta.namelayer) saa.Tuulikartta.namelayer.bringToFront()
    })

    // Language selector
    $('#language-selector-value').click(function () {
      if(window.selectedLanguage === 'fi') {
        $(this).html('FI')
        selectedLanguage = 'en'
        localStorage.setItem('language', 'en')
      } else {
        $(this).html('EN')
        window.selectedLanguage = 'fi'
        localStorage.setItem('language', 'fi')
      }
      window.location.replace('#lang='+window.selectedLanguage+'#latlon='+window.latitude+','+window.longitude+'#zoom='+window.zoomlevel+'#parameter='+window.selectedParameter)
      window.location.reload()
    })

    // Show/hide observation layers
    $('#show-observations').change(function() {
      if (this.checked == true) {
        saa.Tuulikartta.showStationObservations = true
        saa.Tuulikartta.map.addLayer(saa.Tuulikartta.markerGroupSynop)
        if (saa.Tuulikartta.showRoadObservations) {
          saa.Tuulikartta.map.addLayer(saa.Tuulikartta.markerGroupRoad)
        }
      } else {
        saa.Tuulikartta.showStationObservations = false
        saa.Tuulikartta.map.removeLayer(saa.Tuulikartta.markerGroupSynop)
        if (saa.Tuulikartta.showRoadObservations) {
          saa.Tuulikartta.map.removeLayer(saa.Tuulikartta.markerGroupRoad)
        }
      }
    })

    $('#road-observations').change(function() {
      if (this.checked == true) {
        saa.Tuulikartta.showRoadObservations = true
        if (saa.Tuulikartta.showStationObservations) {
          Tuulikartta.drawData(window.selectedParameter)
        }
      } else {
        saa.Tuulikartta.showRoadObservations = false
        saa.Tuulikartta.map.removeLayer(saa.Tuulikartta.markerGroupRoad)
      }
    })

    // Radar opacity slider
    var slider = document.getElementById("radar-opacity");
    slider.oninput = function() {
      var layer = saa.Tuulikartta.radarLayer
        if(layer){
            var opacity = this.value;
            layer.setOpacity(this.value/100);
            window.radarLayerOpacity = this.value
            localStorage.setItem('radarLayerOpacity', this.value)
        }
    }

    // Lightning options
    $('#lightning-source').change(function() {
      if(this.value == 1) {
        saa.Tuulikartta.showCloudStrikes = true
        localStorage.setItem('showCloudStrikes', 'true')
        saa.lightning.init(saa.Tuulikartta.timeStamp)
      } else {
        saa.Tuulikartta.showCloudStrikes = false
        localStorage.setItem('showCloudStrikes', 'false')
        saa.lightning.init(saa.Tuulikartta.timeStamp)
      }
    })

    $('#lightning-interval').change(function() {
      saa.Tuulikartta.lightningInterval = this.value
      saa.lightning.init(saa.Tuulikartta.timeStamp)
    })
  }
  // ja nämä on perus javascriptiä

  // eventhandler for settings button
  Tuulikartta.settingsHandler = function(container, sidebar) {
    container.onclick = function(){
      sidebar.toggle()
    }
  };

  // eventhandler for radar button
  Tuulikartta.radarHandler = function(container) {
    container.onclick = function(){
          saa.Tuulikartta.radarLayer.setParams({time: saa.Tuulikartta.timeStamp})
          if(saa.Tuulikartta.map.hasLayer(saa.Tuulikartta.radarLayer)) {
            saa.Tuulikartta.map.removeLayer(saa.Tuulikartta.radarLayer)
            $(this).removeClass('active')
          } else {
            saa.Tuulikartta.updateRadarData()
            saa.Tuulikartta.map.addLayer(saa.Tuulikartta.radarLayer)
            $(this).addClass('active')
          }
        }
      };

  // eventhandler for lightning button
  Tuulikartta.lightningHandler = function(container) {
    container.onclick = function(){
          if(saa.Tuulikartta.map.hasLayer(saa.lightning.geoLayer)) {
            saa.Tuulikartta.map.removeLayer(saa.lightning.geoLayer)
            $(this).removeClass('active')
            window.getLightningData = false
            saa.lightning.geoLayer.clearLayers()
          } else {
            saa.lightning.init(saa.Tuulikartta.timeStamp)
            saa.Tuulikartta.map.addLayer(saa.lightning.geoLayer)
            $(this).addClass('active')
            window.getLightningData = true
          }
          saa.Tuulikartta.updateRadarData()
        }
      };

  // eventhandler for table button
  Tuulikartta.tableHandler = function(container) {
    container.onclick = function(){
          modal.style.display = "block";
        }
      };

  // eventhandler for info button
  Tuulikartta.infoHandler = function(container) {
    container.onclick = function(){
          var x = document.getElementById("site-info");
          if (x.style.display === "none") {
            x.style.display = "block";
          } else {
            x.style.display = "none";
          }
        }
      };

}(saa.Tuulikartta = saa.Tuulikartta || {}))
