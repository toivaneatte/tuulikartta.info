import { describe, it, before } from 'mocha';
import { expect } from 'chai';

describe('Color schemes', () => {
  let saa;

  before(async () => {
    await import('../js/color-schemes.js');
    saa = globalThis.saa;
  });

  describe('windSpeedColors()', () => {
    it('returns calm below 1 m/s', () => {
      const result = global.saa.Tuulikartta.resolveWindSpeed(0.5);
      expect(result).to.deep.equal({ code: 'calm', hex: '#ffffff' });
    });

    it('returns light at 1 m/s', () => {
      const result = global.saa.Tuulikartta.resolveWindSpeed(1);
      expect(result).to.deep.equal({ code: 'light', hex: '#e6f7ff' });
    });

    it('returns moderate for range 2-7 m/s', () => {
      expect(global.saa.Tuulikartta.resolveWindSpeed(2).code).to.equal('moderate');
      expect(global.saa.Tuulikartta.resolveWindSpeed(4).code).to.equal('moderate');
      expect(global.saa.Tuulikartta.resolveWindSpeed(6.9).code).to.equal('moderate');
    });

    it('returns brisk for range 7-14 m/s', () => {
      expect(global.saa.Tuulikartta.resolveWindSpeed(7).code).to.equal('brisk');
      expect(global.saa.Tuulikartta.resolveWindSpeed(10).code).to.equal('brisk');
      expect(global.saa.Tuulikartta.resolveWindSpeed(13.9).code).to.equal('brisk');
    });

    it('returns hard for range 14-21 m/s', () => {
      expect(global.saa.Tuulikartta.resolveWindSpeed(14).code).to.equal('hard');
      expect(global.saa.Tuulikartta.resolveWindSpeed(17).code).to.equal('hard');
      expect(global.saa.Tuulikartta.resolveWindSpeed(20.9).code).to.equal('hard');
    });

    it('returns storm for range 21-25 m/s', () => {
      expect(global.saa.Tuulikartta.resolveWindSpeed(21).code).to.equal('storm');
      expect(global.saa.Tuulikartta.resolveWindSpeed(23).code).to.equal('storm');
      expect(global.saa.Tuulikartta.resolveWindSpeed(24.9).code).to.equal('storm');
    });

    it('returns severestorm for range 25-28 m/s', () => {
      expect(global.saa.Tuulikartta.resolveWindSpeed(25).code).to.equal('severestorm');
      expect(global.saa.Tuulikartta.resolveWindSpeed(26).code).to.equal('severestorm');
      expect(global.saa.Tuulikartta.resolveWindSpeed(27.9).code).to.equal('severestorm');
    });

    it('returns extremestorm for range 28-32 m/s', () => {
      expect(global.saa.Tuulikartta.resolveWindSpeed(28).code).to.equal('extremestorm');
      expect(global.saa.Tuulikartta.resolveWindSpeed(30).code).to.equal('extremestorm');
      expect(global.saa.Tuulikartta.resolveWindSpeed(31.9).code).to.equal('extremestorm');
    });

    it('returns hurricane at 32 m/s', () => {
      const result = global.saa.Tuulikartta.resolveWindSpeed(32);
      expect(result).to.deep.equal({ code: 'hurricane', hex: '#6600cc' });
    });

    it('parses string input correctly', () => {
      expect(global.saa.Tuulikartta.resolveWindSpeed('15').code).to.equal('hard');
    });
  });

  describe('temperatureColors()', () => {
    it('maps extreme cold below -30', () => {
      expect(global.saa.Tuulikartta.resolveTemperature(-35)).to.equal('#8a79f7');
    });

    it('maps -30 to -28 range', () => {
      expect(global.saa.Tuulikartta.resolveTemperature(-30)).to.equal('#8a79f7');
      expect(global.saa.Tuulikartta.resolveTemperature(-29)).to.equal('#8a79f7');
      expect(global.saa.Tuulikartta.resolveTemperature(-28.1)).to.equal('#8a79f7');
    });

    it('maps -22 to -20 range', () => {
      expect(global.saa.Tuulikartta.resolveTemperature(-22)).to.equal('#1b58ba');
      expect(global.saa.Tuulikartta.resolveTemperature(-21)).to.equal('#1b58ba');
      expect(global.saa.Tuulikartta.resolveTemperature(-20.1)).to.equal('#1b58ba');
    });

    it('maps -20 to -18 range', () => {
      expect(global.saa.Tuulikartta.resolveTemperature(-20)).to.equal('#0050ab');
      expect(global.saa.Tuulikartta.resolveTemperature(-19)).to.equal('#0050ab');
      expect(global.saa.Tuulikartta.resolveTemperature(-18.1)).to.equal('#0050ab');
    });

    it('maps -2 to -1 range', () => {
      expect(global.saa.Tuulikartta.resolveTemperature(-2)).to.equal('#c1f4fd');
      expect(global.saa.Tuulikartta.resolveTemperature(-1.5)).to.equal('#c1f4fd');
      expect(global.saa.Tuulikartta.resolveTemperature(-1.1)).to.equal('#c1f4fd');
    });

    it('maps -1 to 0 range (just before freezing)', () => {
      expect(global.saa.Tuulikartta.resolveTemperature(-1)).to.equal('#d4ffff');
      expect(global.saa.Tuulikartta.resolveTemperature(-0.5)).to.equal('#d4ffff');
      expect(global.saa.Tuulikartta.resolveTemperature(-0.1)).to.equal('#d4ffff');
    });

    it('maps 0 to 1 range (freezing to just above)', () => {
      expect(global.saa.Tuulikartta.resolveTemperature(0)).to.equal('#05b38a');
      expect(global.saa.Tuulikartta.resolveTemperature(0.5)).to.equal('#05b38a');
    });

    it('maps warm positive temperatures 10-12°C and 14-16°C', () => {
      expect(global.saa.Tuulikartta.resolveTemperature(10)).to.equal('#ffea80');
      expect(global.saa.Tuulikartta.resolveTemperature(11)).to.equal('#ffea80');
      expect(global.saa.Tuulikartta.resolveTemperature(14)).to.equal('#f5b400');
      expect(global.saa.Tuulikartta.resolveTemperature(15.5)).to.equal('#f5b400');
    });

    it('maps hot temperatures to red', () => {
      expect(global.saa.Tuulikartta.resolveTemperature(23)).to.equal('#f71707');
      expect(global.saa.Tuulikartta.resolveTemperature(28)).to.equal('#9e0101');
      expect(global.saa.Tuulikartta.resolveTemperature(31)).to.equal('#eb0052');
    });
  });

  describe('dewpointDifferenceColors()', () => {
    it('handles very dry air', () => {
      expect(global.saa.Tuulikartta.resolveDewpointDiff(-5)).to.equal('#053061');
    });

    it('handles dry air range -4 to -2', () => {
      expect(global.saa.Tuulikartta.resolveDewpointDiff(-4)).to.equal('#2166ac');
      expect(global.saa.Tuulikartta.resolveDewpointDiff(-3)).to.equal('#2166ac');
      expect(global.saa.Tuulikartta.resolveDewpointDiff(-2.1)).to.equal('#2166ac');
    });

    it('handles near-zero difference', () => {
      expect(global.saa.Tuulikartta.resolveDewpointDiff(0)).to.equal('#f7f7f7');
    });

    it('handles slightly humid air range 1-2', () => {
      expect(global.saa.Tuulikartta.resolveDewpointDiff(1)).to.equal('#fddbc7');
      expect(global.saa.Tuulikartta.resolveDewpointDiff(1.5)).to.equal('#fddbc7');
      expect(global.saa.Tuulikartta.resolveDewpointDiff(1.9)).to.equal('#fddbc7');
    });

    it('handles humid air range 2-4', () => {
      expect(global.saa.Tuulikartta.resolveDewpointDiff(2)).to.equal('#f4a582');
      expect(global.saa.Tuulikartta.resolveDewpointDiff(3)).to.equal('#f4a582');
      expect(global.saa.Tuulikartta.resolveDewpointDiff(3.9)).to.equal('#f4a582');
    });

    it('handles very humid air', () => {
      expect(global.saa.Tuulikartta.resolveDewpointDiff(9)).to.equal('#b2182b');
    });
  });

  describe('relativeHumidityColors()', () => {
    it('maps low humidity to light blue', () => {
      expect(global.saa.Tuulikartta.resolveRelativeHumidity(49)).to.equal('#f7fbff');
    });

    it('maps 50-60% humidity band', () => {
      expect(global.saa.Tuulikartta.resolveRelativeHumidity(50)).to.equal('#deebf7');
      expect(global.saa.Tuulikartta.resolveRelativeHumidity(55)).to.equal('#deebf7');
      expect(global.saa.Tuulikartta.resolveRelativeHumidity(59)).to.equal('#deebf7');
    });

    it('maps very high humidity to dark blue', () => {
      expect(global.saa.Tuulikartta.resolveRelativeHumidity(90)).to.equal('#08306b');
    });
  });

  describe('pressureColors()', () => {
    it('maps low pressure', () => {
      expect(global.saa.Tuulikartta.resolvePressure(979)).to.equal('#9e0142');
    });

    it('maps mid pressure ranges 1000-1005 and 1010-1015', () => {
      expect(global.saa.Tuulikartta.resolvePressure(1000)).to.equal('#fee08b');
      expect(global.saa.Tuulikartta.resolvePressure(1002)).to.equal('#fee08b');
      expect(global.saa.Tuulikartta.resolvePressure(1010)).to.equal('#e6f598');
      expect(global.saa.Tuulikartta.resolvePressure(1012)).to.equal('#e6f598');
    });

    it('maps high pressure', () => {
      expect(global.saa.Tuulikartta.resolvePressure(1031)).to.equal('#5e4fa2');
    });
  });

  describe('precipitationColors()', () => {
    it('maps very light precipitation', () => {
      expect(global.saa.Tuulikartta.resolvePrecipitationAmount(0.05)).to.equal('#fff7fb');
    });

    it('maps light precipitation', () => {
      expect(global.saa.Tuulikartta.resolvePrecipitationAmount(0.15)).to.equal('#ece7f2');
    });

    it('maps moderate precipitation range 0.5-1.0 mm', () => {
      expect(global.saa.Tuulikartta.resolvePrecipitationAmount(0.6)).to.equal('#3690c0');
      expect(global.saa.Tuulikartta.resolvePrecipitationAmount(0.75)).to.equal('#3690c0');
      expect(global.saa.Tuulikartta.resolvePrecipitationAmount(1.0)).to.equal('#3690c0');
    });

    it('maps heavy precipitation', () => {
      expect(global.saa.Tuulikartta.resolvePrecipitationAmount(15)).to.equal('#fee090');
    });

    it('maps extreme precipitation', () => {
      expect(global.saa.Tuulikartta.resolvePrecipitationAmount(35)).to.equal('#d73027');
    });
  });

  describe('snowDepthColors()', () => {
    it('maps light snow 1-10 cm', () => {
      expect(global.saa.Tuulikartta.resolveSnowDepth(5)).to.equal('#bfe6ff');
      expect(global.saa.Tuulikartta.resolveSnowDepth(10)).to.equal('#bfe6ff');
    });

    it('maps medium snow 20-40 cm', () => {
      expect(global.saa.Tuulikartta.resolveSnowDepth(30)).to.equal('#3c9dde');
    });

    it('maps deep snow over 200 cm', () => {
      expect(global.saa.Tuulikartta.resolveSnowDepth(201)).to.equal('#ebdaf0');
    });
  });

  describe('windDirection()', () => {
    it('rotates 0° to 180°', () => {
      expect(global.saa.Tuulikartta.resolveWindDirection(0)).to.equal(180);
    });

    it('rotates 180° to 0°', () => {
      expect(global.saa.Tuulikartta.resolveWindDirection(180)).to.equal(0);
    });

    it('rotates 270° to 90°', () => {
      expect(global.saa.Tuulikartta.resolveWindDirection(270)).to.equal(90);
    });
  });

  describe('doseRateColors()', () => {
    it('maps low dose rate below 0.10', () => {
      expect(global.saa.Tuulikartta.resolveDoseRate(0.05)).to.equal('#d4ffff');
    });

    it('maps elevated dose rate 0.30-0.40', () => {
      expect(global.saa.Tuulikartta.resolveDoseRate(0.35)).to.equal('#ffcc00');
    });

    it('maps high dose rate above 0.40', () => {
      expect(global.saa.Tuulikartta.resolveDoseRate(0.5)).to.equal('#ff3300');
    });
  });
});
