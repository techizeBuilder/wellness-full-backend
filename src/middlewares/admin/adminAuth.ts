import jwt from 'jsonwebtoken';
import Admin from '../../models/Admin';
import { Request, Response, NextFunction } from 'express';

// Verify admin JWT and attach admin doc
export const adminProtect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied. No admin token provided.' });
    }

    let decoded: any;
    try {
      const secret = (process.env.JWT_SECRET_ADMIN || process.env.JWT_SECRET) as string;
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

    (req as any).admin = { id: admin._id.toString(), role: admin.role };
    (req as any).adminDoc = admin;
    next();
  } catch (error) {
    console.error('adminProtect error', error);
    res.status(500).json({ success: false, message: 'Server error in admin authentication' });
  }
};

// Require role helper
export const requireRole = (roles: string | string[]) => {
  const list = Array.isArray(roles) ? roles : [roles];
  return (req: Request, res: Response, next: NextFunction) => {
    const admin = (req as any).admin;
    if (!admin || !list.includes(admin.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient role privileges' });
    }
    next();
  };
};

// Permission check helper
export const hasPermission = (permissionKey: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminDoc = (req as any).adminDoc;
      if (!adminDoc) return res.status(401).json({ success: false, message: 'Admin not loaded' });

      // Superadmin bypass
      if (adminDoc.role === 'superadmin') return next();

      const perms: string[] = adminDoc.permissions || [];
      if (perms.includes(permissionKey)) return next();

      return res.status(403).json({ success: false, message: 'Permission denied' });
    } catch (err) {
      next(err);
    }
  };
};
