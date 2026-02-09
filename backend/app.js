const express = require('express')
const app = express()

const logger = require('./utils/logger')
const weatherRouter = require('./controllers/weather')

app.use(express.json())
app.use('/api/weather', weatherRouter)


module.exports = app