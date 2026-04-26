import { describe, it, before } from 'mocha';
import { expect } from 'chai';

// These tests focus on pure helper utilities in camera.js.
// They should not require network calls or a real Leaflet map instance.

describe('camera.js utilities', () => {
  let camera;

  before(async () => {
    // camera.js is a browser-script module, we rely on test/setup.js mocks.
    await import('../js/camera.js');
    camera = globalThis.saa?.camera;
  });

  it('should attach saa.camera namespace', () => {
    expect(camera).to.exist;
  });

  describe('getCameraIcon()', () => {
    it('should return gray icon for null age', () => {
      expect(camera.getCameraIcon(null)).to.equal('cameragry.svg');
    });

    it('should return green icon for fresh cameras (<=15 min)', () => {
      expect(camera.getCameraIcon(0)).to.equal('cameragre.svg');
      expect(camera.getCameraIcon(15)).to.equal('cameragre.svg');
    });

    it('should return yellow icon for recent cameras (>15 and <=60 min)', () => {
      expect(camera.getCameraIcon(16)).to.equal('camerayel.svg');
      expect(camera.getCameraIcon(60)).to.equal('camerayel.svg');
    });

    it('should return gray icon for older cameras (>60 min)', () => {
      expect(camera.getCameraIcon(61)).to.equal('cameragry.svg');
      expect(camera.getCameraIcon(500)).to.equal('cameragry.svg');
    });
  });

  describe('normalizeStation()', () => {
    it('should return raw as-is when it already has properties', () => {
      const raw = { properties: { id: '123' } };
      expect(camera.normalizeStation(raw)).to.equal(raw);
    });

    it('should build a normalized properties object when given flat fields', () => {
      const raw = {
        id: 'A',
        name: 'Station A',
        dataUpdatedTime: '2026-04-01T10:00:00Z',
        presets: [],
      };

      const normalized = camera.normalizeStation(raw);
      expect(normalized).to.deep.include({
        properties: {
          id: 'A',
          name: 'Station A',
          dataUpdatedTime: '2026-04-01T10:00:00Z',
          presets: [],
          nearestWeatherStationId: null,
        },
      });
    });

    it('should use fallback properties when raw is missing fields', () => {
      const raw = { name: 'Override Name' };
      const fallback = { properties: { id: 'FALLBACK', name: 'Fallback Name', presets: [1] } };

      const normalized = camera.normalizeStation(raw, fallback);
      expect(normalized.properties.id).to.equal('FALLBACK');
      expect(normalized.properties.name).to.equal('Override Name');
      expect(normalized.properties.presets).to.deep.equal([1]);
    });

    it('should return null when station id is missing', () => {
      const normalized = camera.normalizeStation(
        { name: 'No ID' },
        { properties: { name: 'No ID' } }
      );
      expect(normalized).to.equal(null);
    });
  });

  describe('resolvePresetImageUrl()', () => {
    it('should select imageUrl when present', () => {
      expect(camera.resolvePresetImageUrl({ imageUrl: 'a' })).to.equal('a');
    });

    it('should fall back to other common field names', () => {
      expect(camera.resolvePresetImageUrl({ imageURL: 'b' })).to.equal('b');
      expect(camera.resolvePresetImageUrl({ url: 'c' })).to.equal('c');
      expect(camera.resolvePresetImageUrl({ image: 'd' })).to.equal('d');
      expect(camera.resolvePresetImageUrl({ thumbnailUrl: 'e' })).to.equal('e');
    });

    it('should return null if preset is missing', () => {
      expect(camera.resolvePresetImageUrl(null)).to.equal(null);
    });
  });

  describe('resolvePresetTitle()', () => {
    it('should prefer presentationName over name and id', () => {
      expect(camera.resolvePresetTitle({ presentationName: 'P', name: 'N', id: 'I' })).to.equal(
        'P'
      );
    });

    it('should fall back to name then id then empty', () => {
      expect(camera.resolvePresetTitle({ name: 'N', id: 'I' })).to.equal('N');
      expect(camera.resolvePresetTitle({ id: 'I' })).to.equal('I');
      expect(camera.resolvePresetTitle({})).to.equal('');
    });
  });

  describe('resolveLatestTime()', () => {
    it('should resolve latest measuredTime from presets', () => {
      const station = {
        properties: {
          presets: [
            { measuredTime: '2026-04-01T10:00:00.000Z' },
            { measuredTime: '2026-04-01T11:00:00.000Z' },
          ],
        },
      };

      const latest = camera.resolveLatestTime(station);
      expect(latest).to.exist;
      expect(latest.toISOString()).to.equal('2026-04-01T11:00:00.000Z');
    });

    it('should fall back to dataUpdatedTime when presets have no times', () => {
      const station = {
        properties: {
          presets: [{}, {}],
          dataUpdatedTime: '2026-04-01T12:00:00.000Z',
        },
      };

      const latest = camera.resolveLatestTime(station);
      expect(latest.toISOString()).to.equal('2026-04-01T12:00:00.000Z');
    });

    it('should return null when station is missing', () => {
      expect(camera.resolveLatestTime(null)).to.equal(null);
    });
  });
});
