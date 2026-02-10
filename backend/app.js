const express = require('express')
const app = express()

require('./utils/redisClient') // Initialize Redis client

const logger = require('./utils/logger')
const weatherRouter = require('./controllers/weather')

app.use(express.json())
app.use('/api/weather', weatherRouter)


module.exports = app