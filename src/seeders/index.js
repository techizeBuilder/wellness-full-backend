const { seedInitialAdmin, seedDevDemoAdmin } = require('./adminSeeder');
const { seedDefaultPermissions } = require('./permissionSeeder');
const logger = require('../utils/logger');

const runSeeders = async () => {
  try {
    logger.info('Running seeders...');
    
    await seedInitialAdmin();
    await seedDevDemoAdmin();
    await seedDefaultPermissions();
    
    logger.info('Seeders completed successfully');
  } catch (error) {
    logger.error('Error running seeders', error);
    throw error;
  }
};

module.exports = {
  runSeeders
};

