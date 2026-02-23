// Global setup file that runs before all tests
// This initializes the global environment needed for browser-based code

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
      addTo: function () {},
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
