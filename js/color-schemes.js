/*
* Tuulikartta.info - Color Scheme Resolvers
* Maps observation values (wind speed, temperature, etc.) to color codes
*/

var saa = saa || {};

(function (Tuulikartta, undefined) {
  'use strict'

  // ---------------------------------------------------------
  // Load color thresholds from external JSON config
  // ---------------------------------------------------------

  var colorConfig = null;

  fetch('config/color-thresholds.json')
    .then(function (response) { return response.json() })
    .then(function (data) { colorConfig = data })
    .catch(function (err) { console.warn('Could not load color-thresholds.json, using defaults:', err) })

  // ---------------------------------------------------------
  // Resolve wind speed to color code object
  // ---------------------------------------------------------

  Tuulikartta.resolveWindSpeed = function (windspeed) {
    windspeed = parseFloat(windspeed)
    if (windspeed < 1) { return {code: 'calm', hex: '#ffffff' } }
    else if (windspeed >= 1 && windspeed < 2) { return {code: 'light', hex: '#e6f7ff' } }
    else if (windspeed >= 2 && windspeed < 7) { return {code: 'moderate', hex: '#ccffcc' }  } 
    else if (windspeed >= 7 && windspeed < 14) { return {code: 'brisk', hex: '#ffff99' }  } 
    else if (windspeed >= 14 && windspeed < 21) { return {code: 'hard', hex: '#ffcc00' }  } 
    else if (windspeed >= 21 && windspeed < 25) { return {code: 'storm', hex: '#ff3300' }  } 
    else if (windspeed >= 25 && windspeed < 28) { return {code: 'severestorm', hex: '#ff0066' }  } 
    else if (windspeed >= 28 && windspeed < 32) { return {code: 'extremestorm', hex: '#cc0099' }  } 
    else if (windspeed >= 32) { return {code: 'hurricane', hex: '#6600cc' } } 
    else { return 'calm' }
  }

  // ---------------------------------------------------------
  // Resolve precipitation amount to color
  // ---------------------------------------------------------

  Tuulikartta.resolvePrecipitationAmount = function (rr_1h) {
    if (rr_1h > 0 && rr_1h <= 0.1) return "#fff7fb";
    if (rr_1h > 0.1 && rr_1h <= 0.2) return "#ece7f2";
    if (rr_1h > 0.2 && rr_1h <= 0.3) return "#d0d1e6";
    if (rr_1h > 0.3 && rr_1h <= 0.4) return "#a6bddb";
    if (rr_1h > 0.4 && rr_1h <= 0.5) return "#74a9cf";
    if (rr_1h > 0.5 && rr_1h <= 1.0) return "#3690c0";
    if (rr_1h > 1.0 && rr_1h <= 1.5) return "#0570b0";
    if (rr_1h > 1.5 && rr_1h <= 2.0) return "#045a8d";
    if (rr_1h > 2.0 && rr_1h <= 3.0) return "#4575b4";
    if (rr_1h > 3.0 && rr_1h <= 4.0) return "#91bfdb";
    if (rr_1h > 4.0 && rr_1h <= 5.0) return "#e0f3f8";
    if (rr_1h > 5.0 && rr_1h <= 10.0) return "#ffffbf";
    if (rr_1h > 10.0 && rr_1h <= 20.0) return "#fee090";
    if (rr_1h > 20.0 && rr_1h <= 30.0) return "#fc8d59";
    if (rr_1h > 30.0) return "#d73027";
  }

  // ---------------------------------------------------------
  // Resolve snow depth to color
  // ---------------------------------------------------------

  Tuulikartta.resolveSnowDepth = function (snow) {
    if (snow > 0 && snow <= 10) return "#bfe6ff";
    if (snow > 10 && snow <= 20) return "#8dcdff";
    if (snow > 20 && snow <= 40) return "#3c9dde";
    if (snow > 40 && snow <= 60) return "#3972bf";
    if (snow > 60 && snow <= 80) return "#6185c0";
    if (snow > 80 && snow <= 100) return "#8898c2";
    if (snow > 100 && snow <= 125) return "#8e6bb0";
    if (snow > 125 && snow <= 150) return "#863e97";
    if (snow > 150 && snow <= 175) return "#7e117e";
    if (snow > 175 && snow <= 200) return "#5b106f";
    if (snow > 200) return "#ebdaf0";
  }

  // ---------------------------------------------------------
  // Resolve relative humidity to color
  // ---------------------------------------------------------

  Tuulikartta.resolveRelativeHumidity = function (rh) {
    if (rh >= 0 && rh < 50) return "#f7fbff";
    if (rh >= 50 && rh < 60) return "#deebf7";
    if (rh >= 60 && rh < 65) return "#c6dbef";
    if (rh >= 65 && rh < 70) return "#9ecae1";
    if (rh >= 70 && rh < 75) return "#6baed6";
    if (rh >= 75 && rh < 80) return "#4292c6";
    if (rh >= 80 && rh < 85) return "#2171b5";
    if (rh >= 85 && rh < 90) return "#08519c";
    if (rh >= 90) return "#08306b";
  }

  // ---------------------------------------------------------
  // Resolve pressure to color
  // ---------------------------------------------------------

  Tuulikartta.resolvePressure = function (p) {
    if (p < 980) return "#9e0142";
    if (p >= 985 && p < 990) return "#d53e4f";
    if (p >= 990 && p < 995) return "#f46d43";
    if (p >= 995 && p < 1000) return "#fdae61";
    if (p >= 1000 && p < 1005) return "#fee08b";
    if (p >= 1005 && p < 1010) return "#ffffbf";
    if (p >= 1010 && p < 1015) return "#e6f598";
    if (p >= 1015 && p < 1020) return "#abdda4";
    if (p >= 1020 && p < 1025) return "#66c2a5";
    if (p >= 1025 && p < 1030) return "#3288bd";
    if (p > 1030) return "#5e4fa2";
  }

  // ---------------------------------------------------------
  // Resolve temperature to color
  // ---------------------------------------------------------

  Tuulikartta.resolveTemperature = function (temperature) {
    temperature = parseFloat(temperature)
    if (temperature < -30) return '#8a79f7'
    if (temperature >= -30 && temperature < -28) return '#8a79f7'
    if (temperature >= -28 && temperature < -26) return '#6e70e7'
    if (temperature >= -26 && temperature < -24) return '#5268d8'
    if (temperature >= -24 && temperature < -22) return '#3760c9'
    if (temperature >= -22 && temperature < -20) return '#1b58ba'
    if (temperature >= -20 && temperature < -18) return '#0050ab'
    if (temperature >= -18 && temperature < -16) return '#196bbe'
    if (temperature >= -16 && temperature < -14) return '#3286d1'
    if (temperature >= -14 && temperature < -12) return '#4ba1e4'
    if (temperature >= -12 && temperature < -10) return '#65dbf7'
    if (temperature >= -10 && temperature < -8) return '#77c8f8'
    if (temperature >= -8 && temperature < -6) return '#8ad3f9'
    if (temperature >= -6 && temperature < -4) return '#9cdefb'
    if (temperature >= -4 && temperature < -2) return '#afe9fc'
    if (temperature >= -2 && temperature < -1) return '#c1f4fd'
    if (temperature >= -1 && temperature < 0) return '#d4ffff'
    if (temperature >= 0 && temperature < 1) return '#05b38a'
    if (temperature >= 1 && temperature < 2) return '#02d495'
    if (temperature >= 2 && temperature < 4) return '#8aedbb'
    if (temperature >= 4 && temperature < 6) return '#ccffd0'
    if (temperature >= 6 && temperature < 8) return '#ebfccf'
    if (temperature >= 8 && temperature < 10) return '#ebff7a'
    if (temperature >= 10 && temperature < 12) return '#ffea80'
    if (temperature >= 12 && temperature < 14) return '#f7d423'
    if (temperature >= 14 && temperature < 16) return '#f5b400'
    if (temperature >= 16 && temperature < 18) return '#f29500'
    if (temperature >= 18 && temperature < 20) return '#f07400'
    if (temperature >= 20 && temperature < 22) return '#ff5324'
    if (temperature >= 22 && temperature < 24) return '#f71707'
    if (temperature >= 24 && temperature < 26) return '#db0a07'
    if (temperature >= 26 && temperature < 28) return '#bd0404'
    if (temperature >= 28 && temperature < 30) return '#9e0101'
    if (temperature >= 30) return '#eb0052'
    return '#8aedbb'
  }

  // ---------------------------------------------------------
  // Resolve dewpoint difference to color
  // ---------------------------------------------------------

  Tuulikartta.resolveDewpointDiff = function (dewpoint) {
    dewpoint = parseFloat(dewpoint)
    if (dewpoint < -4) return '#053061'
    if (dewpoint >= -4 && dewpoint < -2) return '#2166ac'
    if (dewpoint >= -2 && dewpoint < -1) return '#4393c3'
    if (dewpoint >= -1 && dewpoint < -0.5) return '#92c5de'
    if (dewpoint >= -0.5 && dewpoint < 0) return '#d1e5f0'
    if (dewpoint >= 0 && dewpoint < 1) return '#f7f7f7'
    if (dewpoint >= 1 && dewpoint < 2) return '#fddbc7'
    if (dewpoint >= 2 && dewpoint < 4) return '#f4a582'
    if (dewpoint >= 4 && dewpoint < 8) return '#d6604d'
    if (dewpoint >= 8) return '#b2182b'
    return '#f7f7f7'
  }

  // ---------------------------------------------------------
  // Resolve external radiation dose rate to color (STUK)
  // ---------------------------------------------------------

  Tuulikartta.resolveDoseRate = function (dose) {
    dose = parseFloat(dose)
    if (colorConfig && colorConfig.doseRate) {
      for (var i = 0; i < colorConfig.doseRate.length; i++) {
        var t = colorConfig.doseRate[i]
        var aboveMin = (t.min === null || dose >= t.min)
        var belowMax = (t.max === null || dose < t.max)
        if (aboveMin && belowMax) return t.hex
      }
      return colorConfig.doseRateDefault || '#ccffcc'
    }
    // Fallback if JSON not yet loaded
    if (dose < 0.10) return '#d4ffff'
    if (dose >= 0.10 && dose < 0.20) return '#ccffcc'
    if (dose >= 0.20 && dose < 0.30) return '#ffff99'
    if (dose >= 0.30 && dose < 0.40) return '#ffcc00'
    if (dose >= 0.40) return '#ff3300'
    return '#ccffcc'
  }

  // ---------------------------------------------------------
  // Resolve R-probability to color (RWC)
  // ---------------------------------------------------------

  Tuulikartta.resolveRProbability = function (rProb) {
    if (rProb === "low") return '#8aedbb'
    if (rProb === "medium") return '#ffcc00'
    if (rProb === "high") return '#ff5324'
    return '#ffffff'
  }


  // ---------------------------------------------------------
  // Resolve WaWa weather code to text and color
  // ---------------------------------------------------------

  Tuulikartta.resolveWawaCode = function (wawa) {
    wawa = parseInt(wawa)
    if(selectedLanguage === 'en') {
      if (wawa === 0) return {short:'FairWeather',long:'',class:'textLabelclassGrey', hex:'#ffffff'}
      if (wawa === 10) return {short:'Haze',long:'',class:'textLabelclassBlackBackgroundWhite', hex:'#ffffff'}
      if (wawa === 20) return {short:'Fog',long:'',class:'textLabelclassBlackBackgroundWhite', hex:'#ffffff'}
      if (wawa === 21) return {short:'Rain',long:'',class:'textLabelclassBlackBackgroundGreen', hex:'#00b430'}
      if (wawa === 22) return {short:'Drizzle',long:'',class:'textLabelclaenssBlackBackgroundYellow', hex:'#ffffb3'}
      if (wawa === 23) return {short:'Rain',long:'',class:'textLabelclassBlackBackgroundGreen', hex:'#00b430'}
      if (wawa === 24) return {short:'Snow',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#9cc3fc'}
      if (wawa === 25) return {short:'FreezingRain',long:'',class:'textLabelclassBlackBackgroundPurple', hex:'#ff80df'}
      if (wawa === 30) return {short:'Fog',long:'',class:'textLabelclassBlackBackgroundWhite', hex:'#ffffff'}
      if (wawa === 31) return {short:'Fog',long:'',class:'textLabelclassBlackBackgroundWhite', hex:'#ffffff'}
      if (wawa === 32) return {short:'Fog',long:'',class:'textLabelclassBlackBackgroundWhite', hex:'#ffffff'}
      if (wawa === 33) return {short:'Fog',long:'',class:'textLabelclassBlackBackgroundWhite', hex:'#ffffff'}
      if (wawa === 40) return {short:'Rain',long:'',class:'textLabelclassBlackBackgroundWhite', hex:'#00b430'}
      if (wawa === 41) return {short:'Rain',long:'',class:'textLabelclassBlackBackgroundWhite', hex:'#00b430'}
      if (wawa === 42) return {short:'Rain',long:'',class:'textLabelclassBlackBackgroundWhite', hex:'#00b430'}
      if (wawa === 50) return {short:'Drizzle',long:'',class:'textLabelclassBlackBackgroundYellow', hex:'#ffffb3'}
      if (wawa === 51) return {short:'Drizzle',long:'',class:'textLabelclassBlackBackgroundYellow', hex:'#ffffb3'}
      if (wawa === 52) return {short:'Drizzle',long:'',class:'textLabelclassBlackBackgroundYellow', hex:'#ffffb3'}
      if (wawa === 53) return {short:'Drizzle',long:'',class:'textLabelclassBlackBackgroundYellow', hex:'#ffffb3'}
      if (wawa === 54) return {short:'FreezingDrizzle',long:'',class:'textLabelclassBlackBackgroundPurple', hex:'#ff80df'}
      if (wawa === 55) return {short:'FreezingDrizzle',long:'',class:'textLabelclassBlackBackgroundPurple', hex:'#ff80df'}
      if (wawa === 56) return {short:'FreezingDrizzle',long:'',class:'textLabelclassBlackBackgroundPurple', hex:'#ff80df'}
      if (wawa === 60) return {short:'Rain',long:'',class:'textLabelclassBlackBackgroundGreen', hex:'#00b430'}
      if (wawa === 61) return {short:'Rain',long:'',class:'textLabelclassBlackBackgroundGreen', hex:'#00b430'}
      if (wawa === 62) return {short:'Rain',long:'',class:'textLabelclassBlackBackgroundGreen', hex:'#00b430'}
      if (wawa === 63) return {short:'Rain',long:'',class:'textLabelclassBlackBackgroundGreen', hex:'#00b430'}
      if (wawa === 64) return {short:'FreezingRain',long:'',class:'textLabelclassBlackBackgroundPurple', hex:'#ff80df'}
      if (wawa === 65) return {short:'FreezingRain',long:'',class:'textLabelclassBlackBackgroundPurple', hex:'#ff80df'}
      if (wawa === 66) return {short:'FreezingRain',long:'',class:'textLabelclassBlackBackgroundPurple', hex:'#ff80df'}
      if (wawa === 67) return {short:'FreezingRain',long:'',class:'textLabelclassBlackBackgroundPurple', hex:'#ff80df'}
      if (wawa === 68) return {short:'Sleet',long:'',class:'textLabelclassBlackBackgroundOrange', hex:'#ffbf80'}
      if (wawa === 70) return {short:'Snow',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#9cc3fc'}
      if (wawa === 71) return {short:'Snow',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#9cc3fc'}
      if (wawa === 72) return {short:'Snow',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#9cc3fc'}
      if (wawa === 73) return {short:'Snow',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#9cc3fc'}
      if (wawa === 74) return {short:'Snow',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#9cc3fc'}
      if (wawa === 75) return {short:'Snow',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#9cc3fc'}
      if (wawa === 76) return {short:'Snow',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#9cc3fc'}
      if (wawa === 77) return {short:'Snow',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#9cc3fc'}
      if (wawa === 78) return {short:'Snow',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#9cc3fc'}
      if (wawa === 80) return {short:'RainShovers',long:'',class:'textLabelclassBlackBackgroundGreen', hex:'#6dff94'}
      if (wawa === 81) return {short:'RainShovers',long:'',class:'textLabelclassBlackBackgroundGreen', hex:'#6dff94'}
      if (wawa === 82) return {short:'RainShovers',long:'',class:'textLabelclassBlackBackgroundGreen', hex:'#6dff94'}
      if (wawa === 83) return {short:'RainShovers',long:'',class:'textLabelclassBlackBackgroundGreen', hex:'#6dff94'}
      if (wawa === 84) return {short:'RainShovers',long:'',class:'textLabelclassBlackBackgroundGreen', hex:'#6dff94'}
      if (wawa === 85) return {short:'SnowShovers',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#3d8bff'}
      if (wawa === 86) return {short:'SnowShovers',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#3d8bff'}
      if (wawa === 87) return {short:'SnowShovers',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#3d8bff'}
      if (wawa === 89) return {short:'Hail',long:'',class:'textLabelclassBlackBackgroundYellow', hex:'#ffffb3'}
      else return null
    } else {
      if (wawa === 0) return {short:'Poutaa',long:'',class:'textLabelclassGrey', hex:'#ffffff'}
      if (wawa === 10) return {short:'Utu',long:'',class:'textLabelclassBlackBackgroundWhite', hex:'#ffffff'}
      if (wawa === 20) return {short:'Sumu',long:'',class:'textLabelclassBlackBackgroundWhite', hex:'#ffffff'}
      if (wawa === 21) return {short:'Sade',long:'',class:'textLabelclassBlackBackgroundGreen', hex:'#00b430'}
      if (wawa === 22) return {short:'Tihku',long:'',class:'textLabelclassBlackBackgroundYellow', hex:'#ffffb3'}
      if (wawa === 23) return {short:'Vesisade',long:'',class:'textLabelclassBlackBackgroundGreen', hex:'#00b430'}
      if (wawa === 24) return {short:'Lumisade',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#9cc3fc'}
      if (wawa === 25) return {short:'Jäätsade',long:'',class:'textLabelclassBlackBackgroundPurple', hex:'#ff80df'}
      if (wawa === 30) return {short:'Sumu',long:'',class:'textLabelclassBlackBackgroundWhite', hex:'#ffffff'}
      if (wawa === 31) return {short:'Sumu',long:'',class:'textLabelclassBlackBackgroundWhite', hex:'#ffffff'}
      if (wawa === 32) return {short:'Sumu',long:'',class:'textLabelclassBlackBackgroundWhite', hex:'#ffffff'}
      if (wawa === 33) return {short:'Sumu',long:'',class:'textLabelclassBlackBackgroundWhite', hex:'#ffffff'}
      if (wawa === 34) return {short:'Sumu',long:'',class:'textLabelclassBlackBackgroundWhite', hex:'#ffffff'}
      if (wawa === 40) return {short:'Sade',long:'',class:'textLabelclassBlackBackgroundWhite', hex:'#00b430'}
      if (wawa === 41) return {short:'Sade',long:'',class:'textLabelclassBlackBackgroundWhite', hex:'#00b430'}
      if (wawa === 42) return {short:'Sade',long:'',class:'textLabelclassBlackBackgroundWhite', hex:'#00b430'}
      if (wawa === 50) return {short:'Tihku',long:'',class:'textLabelclassBlackBackgroundYellow', hex:'#ffffb3'}
      if (wawa === 51) return {short:'Tihku',long:'',class:'textLabelclassBlackBackgroundYellow', hex:'#ffffb3'}
      if (wawa === 52) return {short:'Tihku',long:'',class:'textLabelclassBlackBackgroundYellow', hex:'#ffffb3'}
      if (wawa === 53) return {short:'Tihku',long:'',class:'textLabelclassBlackBackgroundYellow', hex:'#ffffb3'}
      if (wawa === 54) return {short:'Jäättihku',long:'',class:'textLabelclassBlackBackgroundPurple', hex:'#ff80df'}
      if (wawa === 55) return {short:'Jäättihku',long:'',class:'textLabelclassBlackBackgroundPurple', hex:'#ff80df'}
      if (wawa === 56) return {short:'Jäättihku',long:'',class:'textLabelclassBlackBackgroundPurple', hex:'#ff80df'}
      if (wawa === 60) return {short:'Vesisade',long:'',class:'textLabelclassBlackBackgroundGreen', hex:'#00b430'}
      if (wawa === 61) return {short:'Vesisade',long:'',class:'textLabelclassBlackBackgroundGreen', hex:'#00b430'}
      if (wawa === 62) return {short:'Vesisade',long:'',class:'textLabelclassBlackBackgroundGreen', hex:'#00b430'}
      if (wawa === 63) return {short:'Vesisade',long:'',class:'textLabelclassBlackBackgroundGreen', hex:'#00b430'}
      if (wawa === 64) return {short:'Jäätsade',long:'',class:'textLabelclassBlackBackgroundPurple', hex:'#ff80df'}
      if (wawa === 65) return {short:'Jäätsade',long:'',class:'textLabelclassBlackBackgroundPurple', hex:'#ff80df'}
      if (wawa === 66) return {short:'Jäätsade',long:'',class:'textLabelclassBlackBackgroundPurple', hex:'#ff80df'}
      if (wawa === 67) return {short:'Jäätsade',long:'',class:'textLabelclassBlackBackgroundPurple', hex:'#ff80df'}
      if (wawa === 68) return {short:'Räntä',long:'',class:'textLabelclassBlackBackgroundOrange', hex:'#ffbf80'}
      if (wawa === 70) return {short:'Lumisade',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#9cc3fc'}
      if (wawa === 71) return {short:'Lumisade',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#9cc3fc'}
      if (wawa === 72) return {short:'Lumisade',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#9cc3fc'}
      if (wawa === 73) return {short:'Lumisade',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#9cc3fc'}
      if (wawa === 74) return {short:'Lumisade',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#9cc3fc'}
      if (wawa === 75) return {short:'Lumisade',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#9cc3fc'}
      if (wawa === 76) return {short:'Lumisade',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#9cc3fc'}
      if (wawa === 77) return {short:'Lumisade',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#9cc3fc'}
      if (wawa === 78) return {short:'Lumisade',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#9cc3fc'}
      if (wawa === 80) return {short:'Sadekuuroja',long:'',class:'textLabelclassBlackBackgroundGreen', hex:'#6dff94'}
      if (wawa === 81) return {short:'Vesikuuroja',long:'',class:'textLabelclassBlackBackgroundGreen', hex:'#6dff94'}
      if (wawa === 82) return {short:'Vesikuuroja',long:'',class:'textLabelclassBlackBackgroundGreen', hex:'#6dff94'}
      if (wawa === 83) return {short:'Vesikuuroja',long:'',class:'textLabelclassBlackBackgroundGreen', hex:'#6dff94'}
      if (wawa === 84) return {short:'Vesikuuroja',long:'',class:'textLabelclassBlackBackgroundGreen', hex:'#6dff94'}
      if (wawa === 85) return {short:'Lumikuuroja',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#3d8bff'}
      if (wawa === 86) return {short:'Lumikuuroja',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#3d8bff'}
      if (wawa === 87) return {short:'Lumikuuroja',long:'',class:'textLabelclassBlackBackgroundBlue', hex:'#3d8bff'}
      if (wawa === 89) return {short:'Raesadetta',long:'',class:'textLabelclassBlackBackgroundYellow', hex:'#ffffb3'}
      else return null
    }
  }

  // ---------------------------------------------------------
  // Utility: Resolve wind direction for icon rotation
  // ---------------------------------------------------------

  Tuulikartta.resolveWindDirection = function (winddirection) {
    var winddir = parseFloat(winddirection)
    return (winddir + 180) % 360
  }

  // ---------------------------------------------------------
  // Utility: Convert hex color to rgba
  // ---------------------------------------------------------

  Tuulikartta.hexToRgbA = function (hex, opacity){
    var c;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        c= hex.substring(1).split('');
        if(c.length== 3){
            c= [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c= '0x'+c.join('');
        return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+opacity+')';
    }
  }

}(saa.Tuulikartta = saa.Tuulikartta || {}))
