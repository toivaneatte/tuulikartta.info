# tuulikartta.info

Display and visualize finnish meteorological observations.

Private clone of https://github.com/nakkim/tuulikartta.info.

## Dependencies

This project uses other's repositories for it's advantage. These include the following: 

- Karttapalvelin as a submodule from https://github.com/eemilniemi/karttapalvelin
- Docker and Docker compose
- NodeJS as a backend server

## Run the project 

To run this project the needs atleast Git for it's submodule and Docker compose. To run the code with the map from submodule run the following:

1. `git submodule sync`
2. `git submodule update --init --recursive`
3. `docker compose up` (Optionals; In the background `-d` and rebuild `--build`)
This can take upto 30 minutes for the inital run, as the map is being worked and pre-rendered. 

To run this project without its submodule, the first two command are not needed and instead the map should be fetched from external server. 

## Update or configure project parameters

The project offers configuration options for those who have the need to change things. 

### Frontend

In the **config/color-thresholds.json**

- Raja-arvot värit

### Backend

In the **backend/config.js**

- URLs
- Ports
- Välimuistin ajat 
- Suosikit
- yms. yms.

## Fetching data from external APIs
Observations to be displyed on the map are fetched via the backend, except for magnetic field data (which just has not been refactored to backend). varmaan tarkempi selitys minkä tiedostojen kautta api-haku tehdään backendissä?

Synop data: regular weather data, data is fetched for previous midnight until asked timestamp so that values for the day (e.g. max value) can be calculated.

R data: R-values, describe fluctuations in the earth's magnetic field and tell how likely northern lights are to appear. The API only returns the newest data, history and graphs would have to be implemented using backend cache.

Magnetometer data: strength of earth's magnetic field. Sets url time differently than synop data to avoid fetching unnecessary data, only the few newest measurements are needed. Does not use backend, url parts are defined in getdata.php and data is fetched and parsed in the magnetometer-function in dataMiner.php.

Data for the graphs is fetched directly by the frontend from the APIs (kai?), has not been refactored to use backend. Data is handled in weather-graph-ts.php and graphs are drawn in graph.js.
