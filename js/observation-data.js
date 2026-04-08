/*
* Tuulikartta.info - Observation Data Management
* Handles fetching and validating observation data from local cache and backend
*/

var saa = saa || {};

(function (Tuulikartta, undefined) {
  'use strict'

  // ---------------------------------------------------------
  // Show a temporary error toast notification
  // ---------------------------------------------------------

  Tuulikartta.showError = function (message) {
    var toast = document.getElementById('tuulikartta-toast')
    if (!toast) {
      toast = document.createElement('div')
      toast.id = 'tuulikartta-toast'
      document.body.appendChild(toast)
    }
    toast.textContent = message
    toast.classList.add('show')
    clearTimeout(toast._hideTimer)
    toast._hideTimer = setTimeout(function () { toast.classList.remove('show') }, 5000)
  }

  // ---------------------------------------------------------
  // Check data validity (< 18 minutes old)
  // ---------------------------------------------------------

  Tuulikartta.checkValidity = function (timestamp) {
    var time = moment.utc(timestamp, 'YYYYMMDDHHmmss', true);
    var difference = moment().diff(time, 'minutes');
    Tuulikartta.debug(`Difference: ${difference}`)
    if(difference < 18) {
      return true
    } else {
      return false
    }
  }

  // ---------------------------------------------------------
  // Get observation data from list.php or backend
  // ---------------------------------------------------------

  Tuulikartta.callData = function () {
    saa.Tuulikartta.dataLoader(true)
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

    var observationFiles = $.get('list.php');

    $.when(observationFiles).done(function(a){
      if (saa.Tuulikartta.timeValue === 'now') {
        // pick the last file from list.php if timetamp is valid
        Tuulikartta.debug('Get data as "now"')
        if (a.length > 0) {
          Tuulikartta.debug(`Found ${a.length} data files`)
          var time = (a[a.length-1]).split('/')
          time = time[1]
          time = (time.split('.'))[0]
          if(Tuulikartta.checkValidity(time)) {
            Tuulikartta.debug(`Found data with a valid timestamp: ${time}`)
            $.ajax({
              dataType: 'json',
              url: a[a.length-1],
              data: {},
              error: function () {
                document.body.style.cursor = 'default'
                saa.Tuulikartta.dataLoader(false)
                saa.Tuulikartta.map.spin(false)
              },
              success: function (data) {
                saa.Tuulikartta.dataLoader(false)
                saa.Tuulikartta.map.spin(false)
                // store the Map-instance in map variable
                saa.Tuulikartta.data = data
                Tuulikartta.drawData(window.selectedParameter)
                window.selectedParameter = $('#select-wind-parameter').val()
                window.startPosition = window.resolveGraphStartposition(window.selectedParameter)
                Tuulikartta.populateObservationTable()
              }
            })
          } else {
            Tuulikartta.debug(`Did not found data with a valid timestamp`)
            Tuulikartta.requestData()
          } 

        } else {
          Tuulikartta.debug(`No data files found`)
          console.log("Data not found, asking from getdata.php")
          Tuulikartta.requestData()
        }

      } else if (a.includes(`data/${moment.utc(saa.Tuulikartta.timeValue, 'YYYY-MM-DDTHH:mm:ssZ', true).format('YYYYMMDDHHmmss')}.json`)) {
        // check whether timestamp can be found from list.php files
        Tuulikartta.debug(`Get data with timestamp: ${saa.Tuulikartta.timeValue}`)
        var requestedTime = `data/${moment.utc(saa.Tuulikartta.timeValue, 'YYYY-MM-DDTHH:mm:ssZ', true).format('YYYYMMDDHHmmss')}.json`
        Tuulikartta.debug(`requestTime: ${requestedTime}`)
        $.ajax({
          dataType: 'json',
          url: requestedTime,
          data: {},
          error: function () {
            document.body.style.cursor = 'default'
            saa.Tuulikartta.dataLoader(false)
            saa.Tuulikartta.map.spin(false)
          },
          success: function (data) {
            saa.Tuulikartta.dataLoader(false)
            saa.Tuulikartta.map.spin(false)
            // store the Map-instance in map variable
            saa.Tuulikartta.data = data
            Tuulikartta.populateObservationTable()
            Tuulikartta.drawData(window.selectedParameter)
            window.selectedParameter = $('#select-wind-parameter').val()
            window.startPosition = window.resolveGraphStartposition(window.selectedParameter)
          }
        })
      
      } else {
        // get data from backend
        Tuulikartta.debug('No data files found with a given timestamp')
        Tuulikartta.requestData()
      } 
    })
  }

  // ---------------------------------------------------------
  // Request observation data from getdata.php
  // ---------------------------------------------------------

  Tuulikartta.requestData = function () {
    $.ajax({
      dataType: 'json',
      url: 'php/getdata.php',
      data: {
        time: saa.Tuulikartta.timeValue,
        favourites: window.favouritesMode ? "1" : "0"
      },
      error: function (xhr) {
        document.body.style.cursor = 'default'
        saa.Tuulikartta.dataLoader(false)
        saa.Tuulikartta.map.spin(false)
        var msg = (xhr.responseJSON && xhr.responseJSON.error) ? xhr.responseJSON.error : 'Tietojen haku epäonnistui'
        Tuulikartta.showError(msg)
        console.log("Tuulikartta data error!!", xhr)
      },
      success: function (response) {
        saa.Tuulikartta.dataLoader(false)
        saa.Tuulikartta.map.spin(false)
        var data = Array.isArray(response) ? response : response.data
        var warnings = response.warnings || []
        warnings.forEach(function (w) { Tuulikartta.showError(w) })
        saa.Tuulikartta.data = data
        Tuulikartta.drawData(window.selectedParameter)
        window.selectedParameter = $('#select-wind-parameter').val()
        window.startPosition = window.resolveGraphStartposition(window.selectedParameter)
        Tuulikartta.populateObservationTable()
      }
    })
  }

  // ---------------------------------------------------------
  // Update radar data timestamps
  // ---------------------------------------------------------

  Tuulikartta.updateRadarData = function () {
    if(saa.Tuulikartta.timeValue === 'now') {
      $.ajax({
        dataType: 'json',
        url: 'php/dataparser.php',
        data: {
          name: 'suomi_dbz_eureffin',
          server: '//openwms.fmi.fi/geoserver/Radar/wms'
        },
        error: function (request, status, error) {
          console.log(request.responseText);
        },
        success: function (data) {
          var timeString = data['dimension']
          if (!timeString) { Tuulikartta.callData(); return; }
          var timeArray = timeString.split('/')
          var endTime = moment.utc(timeArray[1]).toISOString()
          saa.Tuulikartta.timeStamp = endTime
          saa.Tuulikartta.radarLayer.setParams({time: saa.Tuulikartta.timeStamp})
          Tuulikartta.callData()

          if(window.getLightningData) {
            saa.lightning.geoLayer.clearLayers()
            saa.lightning.init(endTime)
          }
        }
      })
    } else {
      Tuulikartta.callData()
      saa.Tuulikartta.radarLayer.setParams({time: saa.Tuulikartta.timeStamp})
      if(window.getLightningData) {
        saa.lightning.geoLayer.clearLayers()
        saa.lightning.init(saa.Tuulikartta.timeStamp)
      }
    }
  }

}(saa.Tuulikartta = saa.Tuulikartta || {}))
