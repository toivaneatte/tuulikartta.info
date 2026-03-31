const express = require('express')
const app = express()

require('./utils/redisClient') // Initialize Redis client

const logger = require('./utils/logger')
const weatherRouter = require('./controllers/weather')
const radiationRouter = require('./controllers/radiation')
const roadRouter = require('./controllers/roadObs')

app.use(express.json())
app.use('/api/weather', weatherRouter)
app.use('/api/radiation', radiationRouter)
app.use('/api/road', roadRouter)


module.exports = app