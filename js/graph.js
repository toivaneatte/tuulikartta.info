/*
* Tuulikartta.info weatherGraph class
* Copyright (C) 2017 Ville Ilkka
*/

var saa = saa || {};

(function(weatherGraph, undefined)
{


    // ---------------------------------------------------------
    // Expand div that contains graphs
    // ---------------------------------------------------------

    weatherGraph.opengraphbox = function() {
        // check the div class and reverse it
        if (document.getElementById("graph-container").className === "collapsed") {
            document.getElementById("graph-container").className = "expanded";
        } else {
            document.getElementById("graph-container").className = "collapsed";
            // ajax loader animation
            document.getElementById("weather-chart").innerHTML = '';
            document.getElementById("weather-chart").innerHTML = '<div class="ajax-loader"></div>';
        }
    }



    
    // ---------------------------------------------------------
    // Get timezone dirrerence in minutes to UTC0
    // ---------------------------------------------------------

    weatherGraph.getTimeZoneDirrerence = function() {
        var x = new Date();
        return x.getTimezoneOffset();
    }




    // ---------------------------------------------------------
    // Expand div that contains graphs
    // ---------------------------------------------------------

    weatherGraph.expandGraph = function(fmisid, lat, lon, type) {
        //document.getElementById("weather-chart").innerHTML = '';
        document.getElementById("graph-container").className = "expanded";
        weatherGraph.constructWeatherGraph("graph-container", fmisid);
        var latlon = lat + ',' + lon;
        weatherGraph.getObservationGraph(fmisid, type, null);
    }




    // ---------------------------------------------------------
    // Get data for wind graph
    // ---------------------------------------------------------

    weatherGraph.getObservationGraph = function(fmisid,type,timestamp) {
        if(fmisid !== undefined) {
          saa.Tuulikartta.debug('Getting data for graph... ');
          $('#graph-box-loader').html("<span align=center>"+translations[window.selectedLanguage]['loadObservations']+"... <img src='symbols/default.gif' style='width:20px;'></img></span>");

          $.ajax({
              dataType: "json",
              url: 'php/weather-graph-ts.php',
              data: {
                  fmisid: fmisid,
                  type: type,
                  timestamp: timestamp
              },
              error: function () {
                  saa.Tuulikartta.debug('An error has occurred');
                  $('#graph-box-loader').html('<span style="color:red;">Error loading graph data</span>');
              },
              success: function (data) {
                  saa.Tuulikartta.debug('Draw graph')
                  $('#graph-box-loader').html('');
                  weatherGraph.drawGraph(data,fmisid);
              }
          });
        }
    }




    // ---------------------------------------------------------
    // Construct weather graph frame
    // ---------------------------------------------------------

    weatherGraph.constructWeatherGraph = function(container, fmisid) {

        // remove old content
        document.getElementById("graph-box").innerHTML = "";

        var html = "";
        html += '<div id="graph-box">';
        html += '<div id="weather-chart-' + fmisid + '_windrose" style="width:100%; height:400px;"></div>';
        html += '<div id="weather-chart-' + fmisid + '" style="width:100%; height:400px;"></div>';
        html += '<div id="weather-chart-' + fmisid + '_alt" style="width:100%; height:400px;"></div>';
        html += '<div id="weather-chart-' + fmisid + '_alt2" style="width:100%; height:400px;"></div>';
        html += '<div id="weather-chart-' + fmisid + '_radiation" style="width:100%; height:400px;"></div>';
        html += '<div id="weather-chart-' + fmisid + '_air_radio" style="width:100%; height:400px;"></div>';
        html += '</div>';

        $('#graph-box').html(html);

    }

    
    weatherGraph.formatTimeLabel = function(value) {

        // add leading zero if needed
        if(value < 10) {
            value = "0"+value;
        }
        return value;
    }

    weatherGraph.resolveWeekDay = function(value) {
        if(selectedLanguage === 'en') {
            var weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thorsday", "Friday", "Saturday"];
        } else {
            var weekday = ["Sunnuntai", "Maanantai", "Tiistai", "Keskiviikko", "Torstai", "Perjantai", "Lauantai"];
        }

        var n = weekday[value];
        return n;
    }
    

    // ---------------------------------------------------------
    // Draw graph
    // ---------------------------------------------------------

    weatherGraph.drawGraph = function(data,fmisid) {

        if(fmisid !== undefined) {

          var categories = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
          var colors = ["#ffffff","#e6f7ff","#ccffcc","#ffff99","#ffcc00","#ff3300","#ff0066","#cc0099","#6600cc"]
          var chart01 = Highcharts.chart(`weather-chart-${fmisid}_windrose`, {
            chart: {
              polar: true,
              type: 'column',
              height: '300px'
            },
            colors: colors,
            title: {
                text: null
            },
            pane: {
                size: '85%'
            },
            legend: {
                // align: 'right',
                // verticalAlign: 'top',
                // y: 70,
                // layout: 'vertical'
                enabled: false
            },
            xAxis: {
                tickmarkPlacement: 'on',
                categories: ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
            },
            yAxis: {
                min: 0,
                endOnTick: false,
                showLastLabel: true,
                title: {
                    text: translations[window.selectedLanguage]['frequency']+' (%)'
                },
                labels: {
                    formatter: function () {
                        return this.value + ' %';
                    }
                },
                reversedStacks: false
            },
            tooltip: {
                valueSuffix: ' %'
            },
            credits: {
              enabled: false
            },
            subtitle: {
              text: translations[window.selectedLanguage]['windroseTitle'],
              style: {
                  color: 'black',
                  font: '12px Roboto, sans-serif'
              }
            },
            plotOptions: {
                series: {
                    stacking: 'normal',
                    shadow: false,
                    groupPadding: 0,
                    pointPlacement: 'on',
                    borderColor: 'grey',
                    borderWidth: 1
                }
            },
            series: data.obs.windrose
          });

          var chart1 = Highcharts.chart(`weather-chart-${fmisid}`, {

              chart: {
                  spacingTop: 0,
                  spacingRight: 0,
                  spacingBottom: 0,
                  spacingLeft: 0,
                  plotBorderWidth: 0,
                  marginLeft: 40,
                  marginRight: 10,
                  marginBottom: 65,
                  height: '300px'
              },
              title: {
                  text: null
              },
              time: {
                  timezoneOffset: weatherGraph.getTimeZoneDirrerence()
              },
              rangeSelector: {
                  selected: 1
              },
              subtitle: {
                  text: translations[window.selectedLanguage]['windTitle'],
                  style: {
                      color: 'black',
                      font: '12px Roboto, sans-serif'
                  }
              },
              xAxis: [{
                  type: 'datetime',
                  labels: {
                      formatter: function () {
                          var date    = new Date(this.value),
                              hours   = weatherGraph.formatTimeLabel(date.getHours()),
                              minutes = weatherGraph.formatTimeLabel(date.getMinutes()),
                              day     = weatherGraph.resolveWeekDay(date.getDay());

                          if( hours !== "00" ) {
                              return hours + ":" + minutes;
                          }
                          else {
                              // if 12 AM return day name
                              //return day + ", " + hours + ":" + minutes;
                              return day;
                          }
                      }
                  },
                  style: {
                      color: 'black',
                      font: '12px Roboto, sans-serif'
                  },
                  offset: 35,
                  minorTickInterval: 'auto',
                  minorTickColor: '#f2f2f2'
              }],
              yAxis: {
                  title: {
                      align: 'high',
                      offset: 0,
                      text: 'm/s',
                      rotation: 0,
                      y: -14,
                      x: -10
                  },
                  min: 0,
                  // startOnTick: false,
                  // endOnTick: false,
                  labels: {
                      style: {
                          color: 'black',
                          font: '12px Roboto, sans-serif'
                      }
                  },
                  tickInterval: 2,
                  labels: {
                      style: {
                          color: 'black',
                          font: '12px Roboto, sans-serif'
                      }
                  },
                  minorTickInterval: 2,
                  minorTickColor: '#f2f2f2'
              },
              tooltip: {
                  crosshairs: true,
                  shared: true,
                  labels: {
                      style: {
                          color: 'black',
                          font: '12px Roboto, sans-serif'
                      }
                  }
              },
              exporting: {
                  enabled: false
              },
              legend: {
                  enabled: false
              },
              credits: {
                  enabled: false
              },
              series: [{
                  type: 'columnrange',
                  name: translations[window.selectedLanguage]['ws_10min']+' - '+translations[window.selectedLanguage]['wg_10min'],
                  data: data.obs.wind,
                  xAxis: 0,
                  tooltip: {
                      valueSuffix: ' m/s'
                  }
              },
              {
                  type: 'windbarb',
                  data: data.obs.dir,
                  name: translations[window.selectedLanguage]['wd_10min'],
                  // enableMouseTracking: false,
                  tooltip: {
                      valueSuffix: ' °'
                  }
              }],
              responsive: {
                  rules: [{
                      condition: {
                          maxHeight: 150
                      },
                      chartOptions: {
                          legend: {
                              enabled: true
                          }
                      }
                  }]
              }

          });

          var chart2 = Highcharts.chart(`weather-chart-${fmisid}_alt`, {

              chart: {
                  spacingTop: 0,
                  // spacingRight: 0,
                  spacingBottom: 0,
                  spacingLeft: 0,
                  // plotBorderWidth: 0,
                  marginLeft: 40,
                  // marginRight: 10,
                  marginBottom: 30,
                  height: '300px'
              },
              title: {
                  text: null
              },
              time: {
                  timezoneOffset: weatherGraph.getTimeZoneDirrerence()
              },
              rangeSelector: {
                  selected: 1
              },
              subtitle: {
                  text: translations[window.selectedLanguage]['weatherTitle'],
                  style: {
                      color: 'black',
                      font: '12px Roboto, sans-serif'
                  }
              },
              xAxis: {
                  type: 'datetime',
                  labels: {
                      formatter: function () {
                          var date    = new Date(this.value),
                              hours   = weatherGraph.formatTimeLabel(date.getHours()),
                              minutes = weatherGraph.formatTimeLabel(date.getMinutes()),
                              day     = weatherGraph.resolveWeekDay(date.getDay());

                          if( hours !== "00" ) {
                              return hours + ":" + minutes;
                          }
                          else {
                              // if 12 AM return day name
                              //return day + ", " + hours + ":" + minutes;
                              return day;
                          }
                      }
                  },
                  style: {
                      color: 'black',
                      font: '12px Roboto, sans-serif'
                  },
                  minorTickInterval: 'auto',
                  minorTickColor: '#f2f2f2'
              },
              yAxis: [
                  {
                      title: {
                          align: 'high',
                          offset: 0,
                          text: '°C',
                          rotation: 0,
                          y: -14,
                          x: -10
                      },
                      tickInterval: 2,
                      labels: {
                          style: {
                              color: 'black',
                              font: '12px Roboto, sans-serif'
                          }
                      },
                      minorTickInterval: 'auto',
                      minorTickColor: '#f2f2f2',
                      plotLines: [{
                          color: '#7f7e7e',
                          value: 0,
                          width: 2    
                      }]
                  },
                  {
                      title: {
                          align: 'high',
                          offset: 0,
                          text: 'mm',
                          rotation: 0,
                          y: -14,
                          x: -10
                      },
                      opposite: true,
                      tickInterval: 2,
                      labels: {
                          style: {
                              color: 'black',
                              font: '12px Roboto, sans-serif'
                          }
                      },
                      min: 0
                  }
              ],
              tooltip: {
                  crosshairs: true,
                  shared: true,
                  labels: {
                      style: {
                          color: 'black',
                          font: '12px Roboto, sans-serif'
                      }
                  }
              },
              exporting: {
                  enabled: false
              },
              legend: {
                  enabled: false
              },
              credits: {
                  enabled: false
              },
              series: [
              {
                  type: 'spline',
                  name: translations[window.selectedLanguage]['t2m'],
                  color: '#FF0000',
                  negativeColor: '#0088FF',
                  data: data.obs.temp,
                  zIndex: 10,
                  tooltip: {
                      valueSuffix: ' °C'
                  },
                  yAxis: 0
              },
              {
                  type: 'column',
                  name: translations[window.selectedLanguage]['rr_1h'],
                  zIndex: 9,
                  data: data.obs.rr1h,
                  tooltip: {
                      valueSuffix: ' mm'
                  },
                  yAxis: 1,
                  pointWidth: 20,
                  dataLabels: {
                      enabled: true
                  }
              },
              {
                  type: 'column',
                  name: translations[window.selectedLanguage]['rr_1h_calc'],
                  zIndex: 2,
                  color: '#89CFF0',
                  data: data.obs.rr1h_calc,
                  tooltip: {
                      valueSuffix: ' mm'
                  },
                  yAxis: 1,
                  pointWidth: 1,
                  dataLabels: {
                      enabled: false
                  }
              }],
              responsive: {
                  rules: [{
                      condition: {
                          maxHeight: 150
                      },
                      chartOptions: {
                          legend: {
                              enabled: true
                          }
                      }
                  }]
              }

          });

          var chart3 = Highcharts.chart(`weather-chart-${fmisid}_alt2`, {

            chart: {
                spacingTop: 0,
                // spacingRight: 0,
                spacingBottom: 0,
                spacingLeft: 0,
                // plotBorderWidth: 0,
                marginLeft: 40,
                // marginRight: 10,
                marginBottom: 60,
                height: '300px'
            },
            title: {
                text: null
            },
            time: {
                timezoneOffset: weatherGraph.getTimeZoneDirrerence()
            },
            rangeSelector: {
                selected: 1
            },
            subtitle: {
                text: translations[window.selectedLanguage]['cloudVisTitle'],
                style: {
                    color: 'black',
                    font: '12px Roboto, sans-serif'
                }
            },
            xAxis: {
                type: 'datetime',
                labels: {
                    formatter: function () {
                        var date    = new Date(this.value),
                            hours   = weatherGraph.formatTimeLabel(date.getHours()),
                            minutes = weatherGraph.formatTimeLabel(date.getMinutes()),
                            day     = weatherGraph.resolveWeekDay(date.getDay());

                        if( hours !== "00" ) {
                            return hours + ":" + minutes;
                        }
                        else {
                            // if 12 AM return day name
                            //return day + ", " + hours + ":" + minutes;
                            return day;
                        }
                    }
                },
                style: {
                    color: 'black',
                    font: '12px Roboto, sans-serif'
                },
                minorTickInterval: 'auto',
                minorTickColor: '#f2f2f2'
            },
            yAxis: [
                {
                    title: {
                        align: 'high',
                        offset: 0,
                        text: 'km',
                        rotation: 0,
                        y: -14,
                        x: -10
                    },
                    labels: {
                        style: {
                            color: 'black',
                            font: '12px Roboto, sans-serif'
                        }
                    },
                    minorTickInterval: 'auto',
                    minorTickColor: '#f2f2f2'
                },
                {
                    title: {
                        align: 'high',
                        offset: 0,
                        text: '/8',
                        rotation: 0,
                        y: -14,
                        x: -10
                    },
                    max: 8,
                    min: 0,
                    tickAmount: 9,
                    opposite: true,
                    labels: {
                        style: {
                            color: 'black',
                            font: '12px Roboto, sans-serif'
                        }
                    },
                }
            ],
            tooltip: {
                crosshairs: true,
                shared: true,
                labels: {
                    style: {
                        color: 'black',
                        font: '12px Roboto, sans-serif'
                    }
                }
            },
            exporting: {
                enabled: false
            },
            legend: {
                enabled: true
            },
            credits: {
                enabled: false
            },
            series: [
            {
                type: 'column',
                name: translations[window.selectedLanguage]['n_man'],
                color: '#828282',//'#A8A8A8',
                data: data.obs.n_man,
                zIndex: 10,
                tooltip: {
                    valueSuffix: '/8'
                },
                yAxis: 1
            },
            {
                type: 'areaspline',
                name: translations[window.selectedLanguage]['vis'],
                zIndex: 11,
                data: data.obs.vis,
                tooltip: {
                    valueSuffix: ' km'
                },
                yAxis: 0
            }],
            responsive: {
                rules: [{
                    condition: {
                        maxHeight: 150
                    },
                    chartOptions: {
                        legend: {
                            enabled: true
                        }
                    }
                }]
            },
            plotOptions: {
              areaspline: {
                  fillOpacity: 0.4
              }
          },

          });
          // saa.Tuulikartta.graphIds = {chart1,chart2}



          // External radiation dose rate chart
var chart4 = Highcharts.chart(`weather-chart-${fmisid}_radiation`, {
    chart: {
        spacingTop: 0,
        spacingBottom: 0,
        spacingLeft: 0,
        marginLeft: 40,
        marginBottom: 30,
        height: '300px'
    },
    title: {
        text: null
    },
    time: {
        timezoneOffset: weatherGraph.getTimeZoneDirrerence()
    },
    rangeSelector: {
        selected: 1
    },
    subtitle: {
        text: translations[window.selectedLanguage]['radiationDoseTitle'],
        style: {
            color: 'black',
            font: '12px Roboto, sans-serif'
        }
    },
    xAxis: {
        type: 'datetime',
        labels: {
            formatter: function () {
                var date    = new Date(this.value),
                    hours   = weatherGraph.formatTimeLabel(date.getHours()),
                    minutes = weatherGraph.formatTimeLabel(date.getMinutes()),
                    day     = weatherGraph.resolveWeekDay(date.getDay());

                if( hours !== "00" ) {
                    return hours + ":" + minutes;
                }
                else {
                    return day; 
                }
            }
        },
        style: {
            color: 'black',
            font: '12px Roboto, sans-serif'
        },
        minorTickInterval: 'auto',
        minorTickColor: '#f2f2f2'
    },
    yAxis: {
        title: {
            align: 'high',
            offset: 0,
            text: 'nSv/h',
            rotation: 0,
            y: -14,
            x: -10
        },
        startOnTick: true,
        endOnTick: true,
        labels: {
            style: {
                color: 'black',
                font: '12px Roboto, sans-serif'
            }
        },
        minorTickInterval: 'auto',
        minorTickColor: '#f2f2f2'
    },
    tooltip: {
        crosshairs: true,
        shared: true,
        labels: {
            style: {
                color: 'black',
                font: '12px Roboto, sans-serif'
            }
        }
    },
    exporting: {
        enabled: false
    },

    legend: {
        enabled: false
    },
    credits: {
        enabled: false
    },
    series: [{
        type: 'areaspline',
        name: translations[window.selectedLanguage]['dose_rate'],
        color: '#FFD700',
        data: data.obs.radiation,
        tooltip: {
            valueSuffix: ' nSv/h'
        },
    }],
    responsive: {
        rules: [{
            condition: {
                maxHeight: 150
            },
            chartOptions: {
                legend: {
                    enabled: true
                }   
            }
        }]
    },
    plotOptions: {
        areaspline: {
            fillOpacity: 0.4
        }
    }
});

          // Air radionuclide activity chart
var chart5 = Highcharts.chart(`weather-chart-${fmisid}_air_radio`, {
    chart: {
        spacingTop: 0,
        spacingBottom: 0,
        spacingLeft: 0,
        marginLeft: 40,
        marginBottom: 30,
        height: '300px'
    },
    title: {
        text: null
    },
    time: {
        timezoneOffset: weatherGraph.getTimeZoneDirrerence()
    },
    rangeSelector: {
        selected: 1
    },
    subtitle: {
        text: translations[window.selectedLanguage]['radiationAirTitle'],
        style: {
            color: 'black',
            font: '12px Roboto, sans-serif'
        }
    },
    xAxis: {
        type: 'datetime',
        labels: {
            formatter: function () {
                var date = new Date(this.value);
                var day = date.getDate();
                var month = date.getMonth();
                var year = date.getFullYear();
                var months_fi = ['Tam', 'Hel', 'Maa', 'Huh', 'Tou', 'Kes', 'Hei', 'Elo', 'Syy', 'Lok', 'Marr', 'Jou'];
                var months_en = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                var months = window.selectedLanguage === 'en' ? months_en : months_fi;
                if (day === 1) {
                    return months[month] + ' ' + year;
                }
                return day + '. ' + months[month];
            }
        },
        style: {
            color: 'black',
            font: '12px Roboto, sans-serif'
        },
        minorTickInterval: 'auto',
        minorTickColor: '#f2f2f2'
    },
    yAxis: {
        title: {
            align: 'high',
            offset: 0,
            text: 'µBq/m³',
            rotation: 0,
            y: -14,
            x: -10
        },
        min: 0,
        labels: {
            style: {
                color: 'black',
                font: '12px Roboto, sans-serif'
            }
        },
        minorTickInterval: 'auto',
        minorTickColor: '#f2f2f2'
    },
    tooltip: {
        crosshairs: true,
        shared: true,
        labels: {
            style: {
                color: 'black',
                font: '12px Roboto, sans-serif'
            }
        }
    },
    exporting: {
        enabled: false
    },

    legend: {
        enabled: true
    },
    credits: {
        enabled: false
    },
    series: [{
        type: 'line',
        name: translations[window.selectedLanguage]['pb210'],
        color: '#FF6B6B',
        data: data.obs.pb210,
        connectNulls: true,
        tooltip: {
            valueSuffix: ' µBq/m³'
        },
    },
    {
        type: 'line',
        name: translations[window.selectedLanguage]['be7'],
        color: '#4ECDC4',
        data: data.obs.be7,
        connectNulls: true,
        tooltip: {
            valueSuffix: ' µBq/m³'
        },
    },
    {
        type: 'line',
        name: translations[window.selectedLanguage]['cs137'],
        color: '#95E1D3',
        data: data.obs.cs137,
        connectNulls: true,
        tooltip: {
            valueSuffix: ' µBq/m³'
        },
    }],
    responsive: {
        rules: [{
            condition: {
                maxHeight: 150
            },
            chartOptions: {
                legend: {
                    enabled: true
                }
            }
        }]
    },
    plotOptions: {
        line: {
            marker: {
                enabled: true,
                radius: 2
            }
        }
    }
});

        }
    }

})(saa.weatherGraph = saa.weatherGraph || {});
