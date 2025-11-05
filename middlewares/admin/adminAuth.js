const jwt = require('jsonwebtoken');
const Admin = require('../../models/Admin');

// Verify admin JWT and attach admin doc
const adminProtect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied. No admin token provided.' });
    }

    let decoded;
    try {
      const secret = process.env.JWT_SECRET_ADMIN || process.env.JWT_SECRET;
      decoded = jwt.verify(token, secret);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid admin token' });
    }

    const admin = await Admin.findById(decoded.id).select('-password');
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Admin not found' });
    }

    if (!admin.isActive) {
      return res.status(403).json({ success: false, message: 'Admin account is deactivated' });
    }

    req.admin = { id: admin._id.toString(), role: admin.role };
    req.adminDoc = admin;
    next();
  } catch (error) {
    console.error('adminProtect error', error);
    res.status(500).json({ success: false, message: 'Server error in admin authentication' });
  }
};

// Require role helper
const requireRole = (roles) => {
  if (!Array.isArray(roles)) roles = [roles];
  return (req, res, next) => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient role privileges' });
    }
    next();
  };
};

// Permission check helper
const hasPermission = (permissionKey) => {
  return (req, res, next) => {
    try {
      if (!req.adminDoc) return res.status(401).json({ success: false, message: 'Admin not loaded' });

      // Superadmin bypass
      if (req.adminDoc.role === 'superadmin') return next();

      const perms = req.adminDoc.permissions || [];
      if (perms.includes(permissionKey)) return next();

      return res.status(403).json({ success: false, message: 'Permission denied' });
    } catch (err) {
      next(err);
    }
  };
};

module.exports = {
  adminProtect,
  requireRole,
  hasPermission
};
