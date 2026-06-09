/*
 * Tuulikartta.info moon phase module
 * Calculates moon phase using the Lasco algorithm (pure math, no API)
 */

globalThis.saa = globalThis.saa || {};
var saa = globalThis.saa;

(function (Tuulikartta, undefined) {
  'use strict';

  var SYNODIC_MONTH = 29.53058867;
  var KNOWN_NEW_MOON = new Date('2000-01-06T18:14:00Z');

  var PHASES = [
    { name: 'Uusikuu', emoji: '🌑' },
    { name: 'Kasvava sirppi', emoji: '🌒' },
    { name: 'Ensimmäinen neljännes', emoji: '🌓' },
    { name: 'Kasvava puolikuu', emoji: '🌔' },
    { name: 'Täysikuu', emoji: '🌕' },
    { name: 'Vähenevä puolikuu', emoji: '🌖' },
    { name: 'Viimeinen neljännes', emoji: '🌗' },
    { name: 'Vähenevä sirppi', emoji: '🌘' },
  ];

  function getMoonPhase() {
    var now = new Date();
    var diffDays = (now - KNOWN_NEW_MOON) / (1000 * 60 * 60 * 24);
    var age = ((diffDays % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
    var illumination = Math.round(((1 - Math.cos((age / SYNODIC_MONTH) * 2 * Math.PI)) / 2) * 100);
    var phaseIndex = Math.floor((age / SYNODIC_MONTH) * 8) % 8;
    var phase = PHASES[phaseIndex];
    return { age: age, illumination: illumination, name: phase.name, emoji: phase.emoji };
  }

  Tuulikartta.getMoonPhase = getMoonPhase;

  Tuulikartta.renderMoonWidget = function (containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var data = getMoonPhase();
    container.innerHTML =
      '<div class="moon-widget">' +
      '<span class="moon-emoji">' +
      data.emoji +
      '</span>' +
      '<div class="moon-info">' +
      '<div class="moon-phase-name">' +
      data.name +
      '</div>' +
      '<div class="moon-illumination">' +
      data.illumination +
      '%</div>' +
      '<div class="moon-progress-bar">' +
      '<div class="moon-progress-fill" style="width:' +
      data.illumination +
      '%"></div>' +
      '</div>' +
      '</div>' +
      '</div>';
  };

  Tuulikartta.initMoonControl = function () {
    Tuulikartta.renderMoonWidget('moon-info');

    var moonControl = L.Control.extend({
      options: {
        position: 'topright',
      },
      onAdd: function () {
        var container = L.DomUtil.create(
          'div',
          'leaflet-bar leaflet-control leaflet-control-custom leaflet-control-moon'
        );
        container.title = 'Kuun vaihe';
        container.onclick = function () {
          var panel = document.getElementById('moon-info');
          if (panel.style.display === 'none') {
            panel.style.display = 'block';
            $(container).addClass('active');
          } else {
            panel.style.display = 'none';
            $(container).removeClass('active');
          }
        };
        return container;
      },
    });
    saa.Tuulikartta.map.addControl(new moonControl());
  };
})(saa.Tuulikartta);
