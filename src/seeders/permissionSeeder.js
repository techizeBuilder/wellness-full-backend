const Permission = require('../models/Permission').default || require('../models/Permission');
const logger = require('../utils/logger').default || require('../utils/logger');

const seedDefaultPermissions = async () => {
  try {
    const defaultPermissions = [
      { key: 'manage_users', label: 'Manage Users' },
      { key: 'manage_experts', label: 'Manage Experts' },
      { key: 'manage_admins', label: 'Manage Admins' },
      { key: 'manage_bookings', label: 'Manage Bookings' },
      { key: 'manage_payments', label: 'Manage Payments' },
      { key: 'manage_subscriptions', label: 'Manage Subscriptions' },
      { key: 'view_reports', label: 'View Reports' },
      { key: 'manage_settings', label: 'Manage Settings' },
      { key: 'view_analytics', label: 'View Analytics' }
    ];

    for (const perm of defaultPermissions) {
      const existing = await Permission.findOne({ key: perm.key });
      if (!existing) {
        await Permission.create(perm);
        logger.info(`Seeded permission: ${perm.label}`);
      }
    }
  } catch (err) {
    logger.error('Failed to seed default permissions', err);
  }
};

module.exports = {
  seedDefaultPermissions
};

