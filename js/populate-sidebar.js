var saa = saa || {};

(function (Tuulikartta, undefined) {
    Tuulikartta.populateSidebar = function(radarLayerOpacity) {
    var html = ""
    html += '<div class="sidebar-container">'
    html += '<h1>'+translations[window.selectedLanguage]['settings']+'</h1>'
    html += '<input id="show-observations" type="checkbox" checked> '+translations[window.selectedLanguage]['showObservations'] 
    html += '<br/>'
    html += '<input id="road-observations" type="checkbox" disabled> '+translations[window.selectedLanguage]['roadObs']
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

}(saa.Tuulikartta = saa.Tuulikartta || {}))