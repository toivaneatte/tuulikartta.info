import { writeFileSync } from "node:fs";

const config = {
  PROD_MODE: process.env.PROD_MODE || false,
  OSM_TILE_SERVER_URL: process.env.OSM_TILE_SERVER_URL || "http://localhost:8080/tile/{z}/{x}/{y}.png"
};

writeFileSync(
  "./env.js",
  "window.APP_CONFIG = " + JSON.stringify(config, null, 2)
);

console.log("env.js generated");