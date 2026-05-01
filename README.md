# tuulikartta.info

Display and visualize finnish meteorological observations. 

Course work for COMP.SE.610/620 Spring 2026 Software Engineering Project 1 and 2.
Original work of Ville Oravilkka: https://github.com/nakkim/tuulikartta.info.

Mahdollisesti joku kuva tähän?

## Features

- Basic synop weather data from The Finnish Meteorological Institute FMI (Wind, Temp, Rain, etc,...)
- R-values from RWC
- External Radiation data from FMI Radiation and Nuclear Safety Authority (STUK)
- Radionuclide activity from FMI STUK
- Magnetometer data from FMI, NOTE: the data from the API may differ from the description on FMI's site, needs to be checked.
- Road weather observations from Digitraffic
- Road weather cameras from Digitraffic
- Different visual graphs (Wind, Temp, Snow, etc,...)
- Favourite stations view and automatic fetching and caching

## Dependencies

This project uses OSM data as it's base map and thus is needed in one form or another. Other dependencies include:

- OSM map server of Finland as a submodule from https://github.com/eemilniemi/karttapalvelin or some other OMS server.
- Docker and Docker Compose for running the project

## To run the project 

To run this project you need at least Docker and Docker Compose as well as some kind of OSM map server of Finland. 

### Production

**Make sure you have external OSM server running**

1.  `docker compose -f docker-compose.prod.yml up` (Optionals; In the background `-d` and rebuild `--build`)

### Development

**The OSM data server used in this project is private! You need to have your own.**

1. Download the OSM data server from Repo `git submodule sync`
2. Init the OSM server `git submodule update --init --recursive`
3. Start Tuulikartta `docker compose -f docker-compose.dev.yml up` (Optionals; In the background `-d` and rebuild `--build`)

**This can take up to 30 minutes for the inital run, as the map is being worked and pre-rendered.**

## Testing

Testing currently focuses on frontend/unit logic and browser-level end-to-end flows.

### Unit tests (Mocha + Chai)

Run all unit tests from the project root:

`npm test`

This runs Mocha with the shared setup file (`test/setup.js`) and executes tests under `test/`.

### E2E tests (Cypress)

Run Cypress in interactive mode:

`npx cypress open`

Run Cypress in headless mode:

`npx cypress run`

E2E specs are located in `cypress/e2e/`.

### Linting (ESLint) and formatting (Prettier)

ESLint is configured for code quality and Prettier for consistent formatting.

Run the linter with:

`npm run lint`

And Prettier with:

`npm run format`

## Update or configure project parameters

The project offers configuration options for those who have the need to change things. 

### Frontend

- -> **config/color-thresholds.json**
  - Limit values and colors

### Backend

- ->**backend/config.js**
  - API URLs
  - Ports
  - Cache timers 
  - Favourite stations and values
  - and many more

## Fetching data from external APIs

Observations to be displayed on the map are fetched via the backend, except for magnetic field data (which just has not been refactored to backend). 
Backend API requests are handled in backend/controllers/, parsed in backend/utils/fmiParser.js and backend/services/, and routed through php/getdata.php which calls the backend endpoints in parallel.

Synop data: regular weather data. All observations are fetched for a configurable time window (mapObservationsWindowMinutes in config). Daily aggregate values (e.g. daily max gust, min/max temperature) are calculated separately from a midnight-to-now fetch. 

Favourite station synop data is fetched on a configurable cron schedule and stored in SQLite cache for a configurable time period.

R data: R-values, describe fluctuations in the earth's magnetic field and tell how likely northern lights are to appear. The API only returns the newest data, history and graphs would have to be implemented using backend cache.

Magnetometer data: strength of earth's magnetic field. Sets url time differently than synop data to avoid fetching unnecessary data, only the few newest measurements are needed. Does not use backend, url parts are defined in getdata.php and data is fetched and parsed in the magnetometer-function in dataMiner.php.

Road observation data: currently only the most recent data is fetched. Doesn't have implementation for the history as there needs to be a way to go around the API call limits for it. Doesn't have graphs due to it.

Graph data is handled in weather-graph-ts.php and graphs are drawn in graph.js. Synop data is stored in cache and this data is used for synop graphs, graphs for other data types depend on fetching the data from the APIs. The HTML base element for the graphs (showing station info etc) is made in populateInfoWindow in populate-sidebar.js.

## Data flow 

When the project starts, the frontend initiates requests to the backend for the required data. The backend then retrieves information from external APIs, processes and parses the responses, and stores the results in a cache for efficiency. Once prepared, the data is sent back to the frontend, where it is rendered and displayed to the user.

Main points of this process:
1. php/getdata.php -> Create the requests and send them to backend
2. backend/controllers/* -> One of the controllers responds depending on the request
3. js/main.js -> handles the data responses

## Technologies 

- PHP handles some backend properties like creating requests to NodeJS backend and magnetic field data. This is the old backend from the base repo. This should be replaced by the NodeJS if further development is done.
- javaScript handles the frontend as basic HTML + JS combo.
- NodeJS backend handles fetching data from APIs and parsing as well as caching. Except fron Magnetic field data, this is handled with PHP. More about backend in the READMe of /backend.
- nginx acts as a reverse proxy and is used only in the prod version.
- better-sqlite3 handles caching in the backend for better performance and reliability.

## Known problems

- Sometimes the loading of the website takes a long time or may get stuck in a loop.
- HTML encoding error sometimes appears. Refresh usually fixes this.

## License

No license has been applied to this project. It is based in large part on an existing public repository that did not include a license, and as such, all rights to the original code remain with its author. This repository is provided for reference and educational purposes only. If you wish to reuse or distribute any part of this project, you should obtain permission from the original author where applicable.

