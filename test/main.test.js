import { describe, it, before, beforeEach } from 'mocha';
import { expect } from 'chai';

describe('main.js utilities', () => {
  let saa;

  // Load the module after setup
  before(async () => {
    await import('../js/main.js');
    await import('../js/camera.js');
    saa = globalThis.saa;
  });

  describe('timeTotime', () => {
    it('should format epoch time to DD.MM.YYYY HH:mm format', () => {
      // February 23, 2024 12:00:00 (epoch: 1708689600)
      const result = saa.Tuulikartta.timeTotime(1708689600);

      // Result format should be: "DD.M.YYYY HH:MM"
      expect(result).to.match(/^\d{1,2}\.\d{1,2}\.\d{4} \d{2}:\d{2}$/);
      expect(result).to.include('.2.2024');
    });

    it('should add leading zeros to single-digit hours', () => {
      // Create a timestamp for 3:05 AM
      const date = new Date('2024-02-23T03:05:00Z');
      const epoch = Math.floor(date.getTime() / 1000);

      const result = saa.Tuulikartta.timeTotime(epoch);

      // Should contain 03:05
      expect(result).to.match(/0[0-9]:[0-9]{2}/);
    });

    it('should add leading zeros to single-digit minutes', () => {
      // Create a timestamp for 12:05
      const date = new Date('2024-02-23T12:05:00Z');
      const epoch = Math.floor(date.getTime() / 1000);

      const result = saa.Tuulikartta.timeTotime(epoch);

      // Should contain :05
      expect(result).to.include(':05');
    });

    it('should handle midnight correctly', () => {
      // Test with midnight to verify hour padding
      const date = new Date(2024, 1, 23, 0, 0, 0); // Feb 23, 2024, 00:00 local time
      const epoch = Math.floor(date.getTime() / 1000);

      const result = saa.Tuulikartta.timeTotime(epoch);

      // Just verify the date matches and time format is correct
      expect(result).to.match(/^\d{1,2}\.\d{1,2}\.\d{4} \d{2}:\d{2}$/);
      // Verify it's the correct date (month is 0-indexed in constructor but 1-indexed in output)
      const expectedDate = `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
      expect(result).to.include(expectedDate);
    });

    it('should handle noon correctly', () => {
      // Test with noon
      const date = new Date(2024, 1, 23, 12, 0, 0); // Feb 23, 2024, 12:00 local time
      const epoch = Math.floor(date.getTime() / 1000);

      const result = saa.Tuulikartta.timeTotime(epoch);

      // Verify format and date
      expect(result).to.match(/^\d{1,2}\.\d{1,2}\.\d{4} \d{2}:\d{2}$/);
      const expectedDate = `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
      expect(result).to.include(expectedDate);
    });
  });

  describe('resolveGraphStartposition', () => {
    it('should return 1 for wind speed parameters', () => {
      expect(globalThis.window.resolveGraphStartposition('ws_10min')).to.equal(1);
      expect(globalThis.window.resolveGraphStartposition('wg_10min')).to.equal(1);
    });

    it('should return 1 for daily wind parameters', () => {
      expect(globalThis.window.resolveGraphStartposition('ws_1d')).to.equal(1);
      expect(globalThis.window.resolveGraphStartposition('wg_1d')).to.equal(1);
    });

    it('should return 2 for temperature parameters', () => {
      expect(globalThis.window.resolveGraphStartposition('t2m')).to.equal(2);
      expect(globalThis.window.resolveGraphStartposition('tmax')).to.equal(2);
      expect(globalThis.window.resolveGraphStartposition('tmin')).to.equal(2);
      expect(globalThis.window.resolveGraphStartposition('dewpoint')).to.equal(2);
    });

    it('should return 2 for precipitation parameters', () => {
      expect(globalThis.window.resolveGraphStartposition('ri_10min')).to.equal(2);
      expect(globalThis.window.resolveGraphStartposition('rr_1h')).to.equal(2);
      expect(globalThis.window.resolveGraphStartposition('rr_1d')).to.equal(2);
    });

    it('should return 2 for weather code parameter', () => {
      expect(globalThis.window.resolveGraphStartposition('wawa')).to.equal(2);
    });

    it('should return 3 for visibility parameter', () => {
      expect(globalThis.window.resolveGraphStartposition('vis')).to.equal(3);
    });

    it('should return 3 for cloud cover parameter', () => {
      expect(globalThis.window.resolveGraphStartposition('n_man')).to.equal(3);
    });

    it('should return 1 for radiation dose rate', () => {
      expect(globalThis.window.resolveGraphStartposition('dose_rate')).to.equal(1);
    });

    it('should return 1 for air activity', () => {
      expect(globalThis.window.resolveGraphStartposition('air_activity')).to.equal(1);
    });

    it('should return 1 as default for unknown parameters', () => {
      expect(globalThis.window.resolveGraphStartposition('unknown_param')).to.equal(1);
      expect(globalThis.window.resolveGraphStartposition('')).to.equal(1);
      expect(globalThis.window.resolveGraphStartposition('invalid')).to.equal(1);
    });

    it('should handle null and undefined gracefully', () => {
      expect(globalThis.window.resolveGraphStartposition(null)).to.equal(1);
      expect(globalThis.window.resolveGraphStartposition(undefined)).to.equal(1);
    });
  });

  describe('createLabelIcon', () => {
    it('should create divIcon config with correct class and text', () => {
      const result = saa.Tuulikartta.createLabelIcon('test-class', 'Test Label');

      expect(result.options).to.exist;
      expect(result.options.className).to.equal('test-class');
      expect(result.options.html).to.equal('Test Label');
    });

    it('should set iconSize to null', () => {
      const result = saa.Tuulikartta.createLabelIcon('class', 'text');

      expect(result.options.iconSize).to.be.null;
    });

    it('should set iconAnchor to [10, 7]', () => {
      const result = saa.Tuulikartta.createLabelIcon('class', 'text');

      expect(result.options.iconAnchor).to.deep.equal([10, 7]);
    });

    it('should handle empty strings', () => {
      const result = saa.Tuulikartta.createLabelIcon('', '');

      expect(result.options.className).to.equal('');
      expect(result.options.html).to.equal('');
    });

    it('should handle special characters in label text', () => {
      const result = saa.Tuulikartta.createLabelIcon('wind-icon', '15.5 m/s');

      expect(result.options.html).to.equal('15.5 m/s');
    });

    it('should handle HTML in label text', () => {
      const result = saa.Tuulikartta.createLabelIcon('temp-icon', '<b>20°C</b>');

      expect(result.options.html).to.equal('<b>20°C</b>');
    });
  });

  describe('dataLoader', () => {
    let mockLoader;
    let mockBody;

    beforeEach(() => {
      // Create mock elements
      mockLoader = {
        innerHTML: '',
        style: { display: 'none' },
      };

      mockBody = {
        style: { cursor: 'default' },
      };

      // Reset document mock to return the same objects
      globalThis.document.getElementById = (id) => {
        if (id === 'data-loader') return mockLoader;
        return {};
      };

      globalThis.document.body = mockBody;
    });

    it('should show loader when param is true', () => {
      saa.Tuulikartta.dataLoader(true);

      expect(mockLoader.style.display).to.equal('block');
      expect(mockBody.style.cursor).to.equal('wait');
    });

    it('should hide loader when param is false', () => {
      saa.Tuulikartta.dataLoader(false);

      expect(mockLoader.style.display).to.equal('none');
      expect(mockBody.style.cursor).to.equal('default');
    });
  });
});
