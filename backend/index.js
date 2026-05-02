const app = require('./app'); // Express application
const logger = require('./utils/logger');
const config = require('./config');

PORT = config.serverPort || 3000;

app.listen(PORT, () => {
  logger.info(`Server version ${config.version} running on port ${PORT}`);
});
