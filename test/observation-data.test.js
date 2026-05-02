import { describe, it, beforeEach, afterEach, before } from 'mocha';
import { expect } from 'chai';

// Tests for observation-data.js that don't require network or DOM rendering.

describe('observation-data.js utilities', () => {
  let Tuulikartta;
  let originalNow;

  before(async () => {
    await import('../js/observation-data.js');
    Tuulikartta = globalThis.saa?.Tuulikartta;
  });

  beforeEach(() => {
    // Freeze 'now' for deterministic moment().diff results
    originalNow = globalThis.moment.now;
    const fixed = globalThis.moment.utc('2026-04-01T12:00:00Z');
    globalThis.moment.now = () => fixed.valueOf();
  });

  afterEach(() => {
    globalThis.moment.now = originalNow;
  });

  it('checkValidity should return true when timestamp is < 18 minutes old', () => {
    // 10 minutes old -> valid
    const ts = globalThis.moment.utc('2026-04-01T11:50:00Z').format('YYYYMMDDHHmmss');

    expect(Tuulikartta.checkValidity(ts)).to.equal(true);
  });

  it('checkValidity should return false when timestamp is >= 18 minutes old', () => {
    // 30 minutes old -> invalid
    const ts = globalThis.moment.utc('2026-04-01T11:30:00Z').format('YYYYMMDDHHmmss');

    expect(Tuulikartta.checkValidity(ts)).to.equal(false);
  });
});
