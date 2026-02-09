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


## Getting Started

### Prerequisites
- Node.js (v14+)
- npm or yarn

### Installation
```bash
npm install
```

### Running the Server with nodemon
```bash
npm run dev
```

The server will start on the configured port (default: 3000).

## Project Structure
```
src/
├── routes/
├── controllers/
├── models/
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
- caching
- periodic fetching
- proper config file (csv or JSON)
- kelikamerat
- kelikamerat välimuisti


## Contributing
Please follow the project's coding standards and submit pull requests for review.

## License
See LICENSE file for details.