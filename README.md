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
