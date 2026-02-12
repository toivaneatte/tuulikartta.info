# Backend

## Overview

A small Node.js / Express backend that fetches weather observation data from the **FMI (Finnish Meteorological Institute) WFS API**, parses XML responses, and exposes cleaned JSON data.

## Features

- Fetches data from FMI Open Data WFS
- Parses XML using `xml2js`
- Extracts weather station names, FMIS IDs, and coordinates
- Returns normalized JSON
- Simple Express API

## Tech Stack

- Node.js
- Express
- node-fetch
- xml2js
- Redis


## Getting Started

### Prerequisites
- Node.js (v14+)
- npm or yarn
- Docker and Docker Compose

### Installation
```bash
npm install
```

### Running the Server with nodemon
```bash
docker compose -f docker-compose.dev.yml up -d
npm run dev
```

The server will start on the configured port (default: 3000).

## Project Structure
```
src/
├── controllers/
└── utils/
```

## API Endpoints


### GET /api/weather

```
[
  {
    "station": "Tampere Siilinkari",
    "fmisid": 101339,
    "pos": "61.51757 23.75388"
  }
]
```


## Testing
```bash
npm test
```

## TODO
- Dockerfile 
- saving data to a file / database
- periodic fetching
- proper config file (csv or JSON)
- kelikamerat
- kelikamerat välimuisti


## Contributing
Please follow the project's coding standards and submit pull requests for review.

## License
See LICENSE file for details.