const Admin = require('../models/Admin');
const logger = require('../utils/logger');
const ENV = require('../config/environment');

const seedInitialAdmin = async () => {
  try {
    const email = ENV.INIT_ADMIN_EMAIL;
    const name = ENV.INIT_ADMIN_NAME || 'Super Admin';
    const password = ENV.INIT_ADMIN_PASSWORD;

    if (!email || !password) {
      logger.debug('No initial admin credentials provided in environment variables');
      return;
    }

    const existing = await Admin.findOne({ email });
    if (existing) {
      logger.info('Initial admin already exists', { email });
      return;
    }

    const admin = await Admin.create({
      name,
      email,
      password,
      role: 'superadmin',
      isPrimary: true
    });
    
    logger.info('Seeded initial superadmin', { email: admin.email });
  } catch (err) {
    logger.error('Failed to seed initial admin', err);
  }
};

const seedDevDemoAdmin = async () => {
  try {
    if (ENV.NODE_ENV !== 'development') {
      return;
    }

    const demoEmail = 'admin@zenovia.com';
    const demoPassword = 'admin123';

    const existing = await Admin.findOne({ email: demoEmail });
    if (existing) {
      return;
    }

    const admin = await Admin.create({
      name: 'Demo Admin',
      email: demoEmail,
      password: demoPassword,
      role: 'superadmin',
      isPrimary: false
    });
    
    logger.info('Seeded development demo admin', { email: admin.email });
  } catch (err) {
    logger.error('Failed to seed dev demo admin', err);
  }
};

module.exports = {
  seedInitialAdmin,
  seedDevDemoAdmin
};

