const express = require('express')
const app = express()

require('./utils/redisClient') // Initialize Redis client
require('./utils/db')           // Initialize SQLite database
require('./utils/favouriteFetcher') // Start the favourite stations fetcher

const logger = require('./utils/logger')
const weatherRouter = require('./controllers/weather')

app.use(express.json())
app.use('/api/weather', weatherRouter)


module.exports = app