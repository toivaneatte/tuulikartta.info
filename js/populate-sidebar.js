var saa = saa || {};

(function (Tuulikartta, undefined) {
    Tuulikartta.populateSidebar = function(radarLayerOpacity) {
    var html = ""
    html += '<div class="sidebar-container">'
    html += '<h1>'+translations[window.selectedLanguage]['settings']+'</h1>'
    html += '<input id="show-observations" type="checkbox" checked> '+translations[window.selectedLanguage]['showObservations'] 
    html += '<br/>'
    html += '<input id="road-observations" type="checkbox" checked> '+translations[window.selectedLanguage]['roadObs']
    html += '<br/>'
    html += '<br/>'
    html += '<span><b>'+translations[window.selectedLanguage]['layerOpacity']+'</b></span>'
    html += '<table>'
    html +=   '<tr>'
    html +=     '<td>'+translations[window.selectedLanguage]['radarLayer']+':</td><td><input type="range" id="radar-opacity" name="opacity" min="0" max="100" value="'+radarLayerOpacity+'"></td>'
    html +=   '</tr>'
    html += '</table>'
    html += '<br/>'
    html += '<span><b>'+translations[window.selectedLanguage]['lightningObs']+'</b></span>'
    html += '<table>'
    html +=   '<tr>'
    html +=     '<td>'+translations[window.selectedLanguage]['lightningShow']+':</td>'
    html +=     '<td>'
    html +=       '<select id="lightning-source">'
    if(saa.Tuulikartta.showCloudStrikes == true || saa.Tuulikartta.showCloudStrikes == 'true') {
      html +=         '<option value="1" selected>'+translations[window.selectedLanguage]['allObs']+'</option>'
      html +=         '<option value="0">'+translations[window.selectedLanguage]['groundOnly']+'</option>'
    } else {
      html +=         '<option value="1">'+translations[window.selectedLanguage]['allObs']+'</option>'
      html +=         '<option value="0" selected>'+translations[window.selectedLanguage]['groundOnly']+'</option>'
    }
    html +=       '</select>'
    html +=     '</td>'
    html +=   '</tr>'
    html +=   '<tr>'
    html +=     '<td>'+translations[window.selectedLanguage]['timeWindow']+':</td>'
    html +=     '<td>'
    html +=       '<select id="lightning-interval">'
    html +=         '<option value="5">5 '+translations[window.selectedLanguage]['minutes']+'</option>'
    html +=         '<option value="15">15 '+translations[window.selectedLanguage]['minutes']+'</option>'
    html +=         '<option value="30">30 '+translations[window.selectedLanguage]['minutes']+'</option>'
    html +=       '</select>'
    html +=     '</td>'
    html +=   '</tr>'
    html += '</table>'
    html += '<br/>'
    html += '<br/>'
    html += '</div>'

    return html
  }

  // ---------------------------------------------------------
  // populate infowindow with observations
  // ---------------------------------------------------------

  Tuulikartta.populateInfoWindow = function (data,fmisid) {
    var location = { lat: parseFloat(data['lat']), lng: parseFloat(data['lon']) }
    var time = Tuulikartta.timeTotime(data['epochtime'])
    var latlon = data['lat'] + ',' + data['lon']

    // Choose correct max width
    if (L.Browser.mobile) {
      maxWidth = 250
      // maxHeight = 320
    }  else {
      maxWidth = 650
    }

    if (data['type'] === 'synop') {
      var stationType = '<b>'+translations[window.selectedLanguage]['stationType']+':</b> <span id="station-type">'+translations[window.selectedLanguage]['synop']+'</span> <br>'
    } else {
      var stationType = '<b>'+translations[window.selectedLanguage]['stationType']+':</b> <span id="station-type">'+translations[window.selectedLanguage]['road']+'</span> <br>'
    }

    var output = '<div style="text-align:center;">'
    output += '<b>'+translations[window.selectedLanguage]['observationStation']+': </b>' + data['station'] + '<br>'
    output += stationType

    if (saa.Tuulikartta.timeValue === 'now') {
      output += '<b>'+translations[window.selectedLanguage]['latestObservation']+': </b>' + time + '<br>'
    } else {
      output += '<b>'+translations[window.selectedLanguage]['observationTime']+': </b>' + time + '<br>'
    }
    output += '</div>'

    output += `<div id="graph-box-loader" style="text-align: center;"></div>`;
    output += `<div id="graph-box" style="width:${maxWidth}px;">`
    output += `<div id="owl-carousel-chart-${fmisid}" class="owl-carousel owl-theme">`
    output += `<div id="weather-chart-${fmisid}_windrose"></div>`
    output += `<div id="weather-chart-${fmisid}"></div>`
    output += `<div id="weather-chart-${fmisid}_alt"></div>`
    output += `<div id="weather-chart-${fmisid}_alt2"></div>`
    output += '</div>'
    output += `</div>`

    return output
  }

}(saa.Tuulikartta = saa.Tuulikartta || {}))