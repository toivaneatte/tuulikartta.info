const app = require('./app') // Express application
const logger = require('./utils/logger')

PORT = 3000;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
})