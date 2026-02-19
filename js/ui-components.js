/*
* Tuulikartta.info - UI Components
* Builds observation menu, info content, and data table
*/

var saa = saa || {};

(function (Tuulikartta, undefined) {
  'use strict'

  // ---------------------------------------------------------
  // Build observation menu
  // ---------------------------------------------------------

  Tuulikartta.buildObservationMenu = function() {
    $('#main-navbar-param').html("")
    var html = '<select id="select-wind-parameter" class="select-style" style="height:26px;">'
    html = html + '<optgroup label="'+translations[window.selectedLanguage]["currentObs"]+'">'
    html = html + '<option value="ws_10min">'+translations[window.selectedLanguage]["ws_10min"]+'</option>'
    html = html + '<option value="wg_10min">'+translations[window.selectedLanguage]["wg_10min"]+'</option>'
    html = html + '<option value="ri_10min">'+translations[window.selectedLanguage]["ri_10min"]+'</option>'
    html = html + '<option value="rr_1h">'+translations[window.selectedLanguage]["rr_1h"]+'</option>'
    html = html + '<option value="t2m">'+translations[window.selectedLanguage]["t2m"]+'</option>'
    html = html + '<option value="dose_rate">'+translations[window.selectedLanguage]["dose_rate"]+'</option>'
    html = html + '<option value="air_activity">'+translations[window.selectedLanguage]["air_activity"]+'</option>'
    html = html + '<option value="t2mdewpoint">'+translations[window.selectedLanguage]["t2mdewpoint"]+'</option>'
    html = html + '<option value="dewpoint">'+translations[window.selectedLanguage]["dewpoint"]+'</option>'
    html = html + '<option value="vis">'+translations[window.selectedLanguage]["vis"]+'</option>'
    html = html + '<option value="wawa">'+translations[window.selectedLanguage]["wawa"]+'</option>'
    html = html + '<option value="n_man">'+translations[window.selectedLanguage]["n_man"]+'</option>'
    html = html + '<option value="snow_aws">'+translations[window.selectedLanguage]["snow_aws"]+'</option>'
    html = html + '<option value="pressure">'+translations[window.selectedLanguage]["pressure"]+'</option>'
    html = html + '<option value="rh">'+translations[window.selectedLanguage]["rh"]+'</option>'
    html = html + '<optgroup label="'+translations[window.selectedLanguage]["dailyObs"]+'">'
    html = html + '<option value="ws_1d">'+translations[window.selectedLanguage]["ws_1d"]+'</option>'
    html = html + '<option value="wg_1d">'+translations[window.selectedLanguage]["wg_1d"]+'</option>'
    html = html + '<option value="rr_1d">'+translations[window.selectedLanguage]["rr_1d"]+'</option>'
    html = html + '<option value="tmax">'+translations[window.selectedLanguage]["tmax"]+'</option>'
    html = html + '<option value="tmin">'+translations[window.selectedLanguage]["tmin"]+'</option>'
    html = html + '</select>'
    $('#main-navbar-param').html(html)
  }

  // ---------------------------------------------------------
  // Populate info content
  // ---------------------------------------------------------

  Tuulikartta.populateInfoContent = function() {
    $('#site-info-body').html('')
    var html    = '<p style="line-height: 150%"><a href="tietoa-sivustosta/">'+translations[window.selectedLanguage]["dataInfo"]+'</a></p>'
    html = html + '<p style="line-height: 150%">'
    html = html + '    <span style="color:#343434; font-weight:bold;">Tuulikartta.info</span>'+translations[window.selectedLanguage]["dataInfoBody1"]+'</br>'
    html = html + '    '+translations[window.selectedLanguage]["dataInfoBody2"]+'</br>'
    html = html + '    '+translations[window.selectedLanguage]["dataInfoBody3"]+'</a>'
    html = html + '</p>'
    html = html + '<p>'+translations[window.selectedLanguage]["feedback"]+' <a href="mailto:contact@tuulikartta.info">contact@tuulikartta.info</a></p>'
    html = html + '<p>'+translations[window.selectedLanguage]["dataInfoBody4"]+'</p>'
    $('#site-info-body').html(html)
  }

  // ---------------------------------------------------------
  // Populate observation table
  // ---------------------------------------------------------

  Tuulikartta.populateObservationTable = function() {
    if(selectedLanguage === 'en')
    document.getElementById('observation-table-header').innerHTML = 'Weather observations'

    var table = new Tabulator("#observation-table", {
      layout:"fitDataStretch",
      columns:  [
        {title: translations[window.selectedLanguage]['observationStation'], field: 'station', width:200, widthShrink:1},
        {title: translations[window.selectedLanguage]['observationTime'], field: 'time', hozAlign:"center", formatter:function(cell, formatterParams, onRendered){
          var code = cell.getValue()
          if(code !== null) {
            var date = moment(code);
            return date.format('DD.MM.YYYY HH:mm')
          } else {
            return null
          }
        }},
        {title: translations[window.selectedLanguage]['ws_10min'], field: 'ws_10min', hozAlign:"center", formatter:function(cell, formatterParams, onRendered){
          var code = Tuulikartta.resolveWindSpeed(cell.getValue())
          if(code !== null) {
            cell.getElement().style.backgroundColor = Tuulikartta.hexToRgbA(code.hex,0.7);
            return cell.getValue()
          } else {
            return null
          }
        }},
        {title: translations[window.selectedLanguage]['wg_10min'], field: 'wg_10min', hozAlign:"center", formatter:function(cell, formatterParams, onRendered){
          var code = Tuulikartta.resolveWindSpeed(cell.getValue())
          if(code !== null) {
            cell.getElement().style.backgroundColor = Tuulikartta.hexToRgbA(code.hex,0.7);
            return cell.getValue()
          } else {
            return null
          }
        }},
        {title: translations[window.selectedLanguage]['wd_10min'], field: 'wd_10min', hozAlign:"center", formatter:function(cell, formatterParams){
          var value = cell.getValue();
           if(value !== null){
              return `<img src="symbols/wind.svg" width="15" heigh="15" style="transform:rotate(${value}deg)"/> ${value}°`;
           } else {
              return value;
           }
        }},
        {title: translations[window.selectedLanguage]['ws_1d'], field: 'ws_1d', hozAlign:"center", formatter:function(cell, formatterParams, onRendered){
          var code = Tuulikartta.resolveWindSpeed(cell.getValue())
          if(code !== null) {
            cell.getElement().style.backgroundColor = Tuulikartta.hexToRgbA(code.hex,0.7);
            return cell.getValue()
          } else {
            return null
          }
        }},
        {title: translations[window.selectedLanguage]['wg_1d'], field: 'wg_1d', hozAlign:"center", formatter:function(cell, formatterParams, onRendered){
          var code = Tuulikartta.resolveWindSpeed(cell.getValue())
          if(code !== null) {
            cell.getElement().style.backgroundColor = Tuulikartta.hexToRgbA(code.hex,0.7);
            return cell.getValue()
          } else {
            return null
          }
        }},
        {title: translations[window.selectedLanguage]['vis'], field: 'vis', hozAlign:"center", formatter:function(cell, formatterParams, onRendered){
          var code = cell.getValue()
          if(code !== null) {
            if(code > 1000 && code <= 2000) {
              cell.getElement().style.backgroundColor = 'rgba(1,1,1,0.15)';
            } else if(code < 1000) {
              cell.getElement().style.backgroundColor = 'rgba(224,7,0,0.4)';
            }
            return cell.getValue()
          } else {
            return null
          }
        }},
        {title: translations[window.selectedLanguage]['wawa'], field: 'wawa', hozAlign:"center", formatter:function(cell, formatterParams, onRendered){
          var code = Tuulikartta.resolveWawaCode(cell.getValue())
          if(code !== null) {
            if(code.short === 'Utu' || code.short === 'Sumu' || code.short === 'Haze' || code.short === 'Fog') {
              cell.getElement().style.backgroundColor = 'rgba(1,1,1,0.15)';
              return code.short
            } else {
              cell.getElement().style.backgroundColor = Tuulikartta.hexToRgbA(code.hex,0.4);
              return code.short
            }
          } else {
            return null
          }
        }},
        {title: translations[window.selectedLanguage]['t2m'], field: 't2m', hozAlign:"center", formatter:function(cell, formatterParams, onRendered){
          if(cell.getValue() !== null) {
            cell.getElement().style.backgroundColor = Tuulikartta.hexToRgbA(Tuulikartta.resolveTemperature(cell.getValue()),0.4);
            return cell.getValue()
          } else {
            cell.getElement().style.backgroundColor = 'rgba(1,1,1,0)'
            return null
          }
        }},
        {title: translations[window.selectedLanguage]['tmax'], field: 'tmax', hozAlign:"center", formatter:function(cell, formatterParams, onRendered){
          if(cell.getValue() !== null && Math.abs(cell.getValue()) < 100) {
            cell.getElement().style.backgroundColor = Tuulikartta.hexToRgbA(Tuulikartta.resolveTemperature(cell.getValue()),0.4);
            return cell.getValue()
          } else {
            cell.getElement().style.backgroundColor = 'rgba(1,1,1,0)'
            return null
          }
        }},
        {title: translations[window.selectedLanguage]['tmin'], field: 'tmin', hozAlign:"center", formatter:function(cell, formatterParams, onRendered){
          if(cell.getValue() !== null && Math.abs(cell.getValue()) < 100) {
            cell.getElement().style.backgroundColor = Tuulikartta.hexToRgbA(Tuulikartta.resolveTemperature(cell.getValue()),0.4);
            return cell.getValue()
          } else {
            cell.getElement().style.backgroundColor = 'rgba(1,1,1,0)'
            return null
          }
        }},
        {title: translations[window.selectedLanguage]['dewpoint'], field: 'dewpoint', hozAlign:"center", formatter:function(cell, formatterParams, onRendered){
          if(cell.getValue() !== null) {
            cell.getElement().style.backgroundColor = Tuulikartta.hexToRgbA(Tuulikartta.resolveTemperature(cell.getValue()),0.4);
            return cell.getValue()
          } else {
            cell.getElement().style.backgroundColor = 'rgba(1,1,1,0)'
            return null
          }
        }},
        {title: translations[window.selectedLanguage]['t2mdewpoint'], field: 't2mdewpoint', hozAlign:"center", formatter:function(cell, formatterParams, onRendered){
          var value = cell.getValue();
          if(value !== null && value !== undefined) {
            cell.getElement().style.backgroundColor = Tuulikartta.hexToRgbA(Tuulikartta.resolveDewpointDiff(value),0.4);
            return value.toFixed(1)
          } else {
            cell.getElement().style.backgroundColor = 'rgba(1,1,1,0)'
            return null
          }
        }},
        {title: translations[window.selectedLanguage]['rh'], field: 'rh', hozAlign:"center", formatter:function(cell, formatterParams, onRendered){
          if(cell.getValue() !== null) {
            cell.getElement().style.backgroundColor = Tuulikartta.hexToRgbA(Tuulikartta.resolveRelativeHumidity(cell.getValue()),0.4);
            return (cell.getValue()).toFixed(1)
          } else {
            cell.getElement().style.backgroundColor = 'rgba(1,1,1,0)'
            return null
          }
        }},
        {title: translations[window.selectedLanguage]['n_man'], field: 'n_man', hozAlign:"center", formatter:function(cell, formatterParams){
          var value = cell.getValue();
           if(value !== null){
              return `<img src="symbols/nn/${value}.svg" width="15" heigh="15";/>`;
           } else {
              return value;
           }
        }},
        {title: translations[window.selectedLanguage]['ri_10min'], field: 'ri_10min', hozAlign:"center", formatter:function(cell, formatterParams, onRendered){
          if(cell.getValue() !== null) {
            cell.getElement().style.backgroundColor = Tuulikartta.hexToRgbA(Tuulikartta.resolvePrecipitationAmount(cell.getValue()),0.4);
            return cell.getValue()
          } else {
            cell.getElement().style.backgroundColor = 'rgba(1,1,1,0)'
            return null
          }
        }},
        {title: translations[window.selectedLanguage]['rr_1h'], field: 'rr_1h', hozAlign:"center", formatter:function(cell, formatterParams, onRendered){
          if(cell.getValue() !== null) {
            cell.getElement().style.backgroundColor = Tuulikartta.hexToRgbA(Tuulikartta.resolvePrecipitationAmount(cell.getValue()),0.4);
            return cell.getValue()
          } else {
            cell.getElement().style.backgroundColor = 'rgba(1,1,1,0)'
            return null
          }
        }},
        {title: translations[window.selectedLanguage]['rr_1d'], field: 'rr_1d', hozAlign:"center", formatter:function(cell, formatterParams, onRendered){
          if(cell.getValue() !== null) {
            cell.getElement().style.backgroundColor = Tuulikartta.hexToRgbA(Tuulikartta.resolvePrecipitationAmount(cell.getValue()),0.4);
            return cell.getValue()
          } else {
            cell.getElement().style.backgroundColor = 'rgba(1,1,1,0)'
            return null
          }
        }},
        {title: translations[window.selectedLanguage]['snow_aws'], field: 'snow_aws', hozAlign:"center", formatter:function(cell, formatterParams, onRendered){
          if(cell.getValue() !== null && cell.getValue() > -1) {
            cell.getElement().style.backgroundColor = Tuulikartta.hexToRgbA(Tuulikartta.resolveSnowDepth(cell.getValue()),0.4);
            return cell.getValue()
          } else {
            cell.getElement().style.backgroundColor = 'rgba(1,1,1,0)'
            return null
          }
        }},
        {title: translations[window.selectedLanguage]['pressure'], field: 'pressure', hozAlign:"center", formatter:function(cell, formatterParams, onRendered){
          if(cell.getValue() !== null) {
            cell.getElement().style.backgroundColor = Tuulikartta.hexToRgbA(Tuulikartta.resolvePressure(cell.getValue()),0.4);
            return (cell.getValue()).toFixed(1)
          } else {
            cell.getElement().style.backgroundColor = 'rgba(1,1,1,0)'
            return null
          }
        }},
      ],
    });
    // Filter to show only synop stations
    var synopData = saa.Tuulikartta.data.filter(function(station) {
      return station.type === 'synop';
    });
    table.setData(synopData)
  }

}(saa.Tuulikartta = saa.Tuulikartta || {}))
