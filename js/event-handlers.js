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

    // Select wind parameter
    $('#select-wind-parameter').change(function () {
      Tuulikartta.clearMarkers()
      Tuulikartta.drawData($(this).val())

      selectedParameter = $(this).val()
      startPosition = resolveGraphStartposition(selectedParameter)

      var lat = saa.Tuulikartta.map.getCenter().lat
      var lon = saa.Tuulikartta.map.getCenter().lng
      var zoom = saa.Tuulikartta.map.getZoom()
      window.location.replace('#lang='+selectedLanguage+'#latlon='+Math.round(lat*100)/100+','+Math.round(lon*100)/100+'#zoom='+zoom+'#parameter='+$(this).val())
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

      window.location.replace('#lang='+selectedLanguage+'#latlon='+Math.round(lat*100)/100+','+Math.round(lon*100)/100+','+zoom+'#parameter='+selectedParameter)
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
      saa.Tuulikartta.timeValue = timestring
      saa.Tuulikartta.timeStamp = timestring

      Tuulikartta.clearMarkers()
      saa.Tuulikartta.radarLayer.setParams({time: saa.Tuulikartta.timeStamp})
      saa.Tuulikartta.namelayer.bringToFront()
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
      saa.Tuulikartta.namelayer.bringToFront()
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
      saa.Tuulikartta.namelayer.bringToFront()
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
      saa.Tuulikartta.namelayer.bringToFront()
    })

    // Language selector
    $('#language-selector-value').click(function () {
      if(selectedLanguage === 'fi') {
        $(this).html('FI')
        selectedLanguage = 'en'
        localStorage.setItem('language', 'en')
      } else {
        $(this).html('EN')
        selectedLanguage = 'fi'
        localStorage.setItem('language', 'fi')
      }
      window.location.replace('#lang='+selectedLanguage+'#latlon='+latitude+','+longtitude+'#zoom='+zoomlevel+'#parameter='+selectedParameter)
      window.location.reload()
    })

    // Show/hide observation layers
    $('#show-observations').change(function() {
      if (this.checked == true) {
        showStationObservations = true
        saa.Tuulikartta.map.addLayer(saa.Tuulikartta.markerGroupSynop)
        if(showRoadObservations)
        saa.Tuulikartta.map.addLayer(saa.Tuulikartta.markerGroupRoad)
      } else {
        showStationObservations = false
        saa.Tuulikartta.map.removeLayer(saa.Tuulikartta.markerGroupSynop)
        if(showRoadObservations)
        saa.Tuulikartta.map.removeLayer(saa.Tuulikartta.markerGroupRoad)
      }
    })

    $('#road-observations').change(function() {
      if (this.checked == true) {
        if(showStationObservations == true) saa.Tuulikartta.markerGroupRoad.addTo(saa.Tuulikartta.map)
        showRoadObservations = true
      } else {
        saa.Tuulikartta.map.removeLayer(saa.Tuulikartta.markerGroupRoad)
        showRoadObservations = false
      }
    })

    // Radar opacity slider
    var slider = document.getElementById("radar-opacity");
    slider.oninput = function() {
      var layer = saa.Tuulikartta.radarLayer
        if(layer){
            var opacity = this.value;
            layer.setOpacity(this.value/100);
            radarLayerOpacity = this.value
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

}(saa.Tuulikartta = saa.Tuulikartta || {}))
