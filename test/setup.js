// Global setup file that runs before all tests
// This initializes the global environment needed for browser-based code

import moment from "moment";

// Mock document object
globalThis.document = {
  createElement: function (tag) {
    return {
      tagName: tag.toUpperCase(),
      setAttribute: function () {},
      getAttribute: function () {
        return null;
      },
      style: {},
      innerHTML: "",
      appendChild: function () {},
      removeChild: function () {},
    };
  },
  getElementById: function (id) {
    return {
      className: "",
      innerHTML: "",
      style: {},
      value: "",
      classList: {
        add: function () {},
        remove: function () {},
      },
    };
  },
  getElementsByClassName: function () {
    return [{ onclick: null }];
  },
  createTextNode: function (text) {
    return { nodeValue: text };
  },
  body: {
    style: {},
  },
};

// Mock window object
globalThis.window = {
  localStorage: {
    getItem: function () {
      return null;
    },
    setItem: function () {},
    removeItem: function () {},
  },
  location: {
    href: "http://localhost",
    hostname: "localhost",
    pathname: "/",
    search: "",
  },
  selectedLanguage: "fi", // Default language for tests
};

// Initialize saa namespace
globalThis.saa = {
  Tuulikartta: {},
};

// Mock Leaflet
globalThis.L = {
  divIcon: function (options) {
    return {
      options: options,
      createIcon: function () {
        return document.createElement("div");
      },
    };
  },
  layerGroup: function () {
    return {
      clearLayers: function () {},
      addTo: function () { return this; },
      addLayer: function () { return this; },
      removeLayer: function () {},
      getLayers: function () { return []; },
      hasLayer: function () { return false; },
    };
  },
  markerClusterGroup: function () {
    return {
      clearLayers: function () {},
      addTo: function () { return this; },
      addLayer: function () { return this; },
      removeLayer: function () {},
      getLayers: function () { return []; },
      hasLayer: function () { return false; },
    };
  },
  Browser: {
    mobile: false,
  },
};

// Mock translations
globalThis.translations = {
  fi: {
    loadObservations: "Ladataan...",
  },
  en: {
    loadObservations: "Loading...",
  },
  sv: {},
};

globalThis.selectedLanguage = "fi";

globalThis.localStorage = globalThis.window.localStorage;

// Provide moment globally for browser-script modules imported in Node tests
globalThis.moment = moment;

// Mock setInterval/setTimeout to prevent side effects in tests
const originalSetInterval = globalThis.setInterval;
const originalSetTimeout = globalThis.setTimeout;
const intervals = [];
const timeouts = [];

// Override to track and prevent timers from running
globalThis.setInterval = function(fn, delay) {
  // Return a fake ID instead of actually setting an interval
  const fakeId = { __test_interval: true };
  intervals.push(fakeId);
  return fakeId;
};

globalThis.setTimeout = function(fn, delay) {
  // Return a fake ID instead of actually setting a timeout
  const fakeId = { __test_timeout: true };
  timeouts.push(fakeId);
  return fakeId;
};

// Cleanup function (if needed for afterAll hooks)
globalThis.__clearAllTestTimers = function() {
  intervals.length = 0;
  timeouts.length = 0;
};