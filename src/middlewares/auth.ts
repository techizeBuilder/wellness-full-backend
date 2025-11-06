import jwt from 'jsonwebtoken';
import User from '../models/User';
import Expert from '../models/Expert';
import { Request, Response, NextFunction } from 'express';

// Protect routes - general authentication middleware
export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    try {
      // Verify token
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
      
      // Find user based on type
      let user: any;
      if (decoded.userType === 'expert') {
        user = await Expert.findById(decoded.id).select('-password');
      } else {
        user = await User.findById(decoded.id).select('-password');
      }

      if (!user) {
        return res.status(401).json({ success: false, message: 'Token is valid but user no longer exists' });
      }

      if (!user.isActive) {
        return res.status(401).json({ success: false, message: 'Your account has been deactivated' });
      }

      // Add user to request object
      (req as any).user = user;
      next();
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error in authentication' });
  }
};

// Authorize specific user types
export const authorize = (...userTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const currentUser = (req as any).user;
    if (!currentUser || !userTypes.includes(currentUser.userType)) {
      return res.status(403).json({ success: false, message: `Access denied. User type '${currentUser?.userType}' is not authorized to access this resource.` });
    }
    next();
  };
};

// Check if expert is approved
export const checkExpertApproval = (req: Request, res: Response, next: NextFunction) => {
  const currentUser = (req as any).user;
  if (currentUser?.userType === 'expert' && currentUser.verificationStatus !== 'approved') {
    return res.status(403).json({ success: false, message: 'Your expert profile is not yet approved. Please wait for admin approval.' });
  }
  next();
};

// Check if user email is verified
export const requireEmailVerification = (req: Request, res: Response, next: NextFunction) => {
  const currentUser = (req as any).user;
  if (!currentUser?.isEmailVerified) {
    return res.status(403).json({ success: false, message: 'Please verify your email address to access this resource.' });
  }
  next();
};

// Generate JWT token
export const generateToken = (id: string, userType: string): string => {
  return jwt.sign(
    { id, userType },
    process.env.JWT_SECRET as string,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

// Generate refresh token
export const generateRefreshToken = (id: string, userType: string): string => {
  return jwt.sign(
    { id, userType },
    process.env.JWT_REFRESH_SECRET as string,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE }
  );
};

// Verify refresh token
export const verifyRefreshToken = (token: string): any => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET as string);
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
        
        let user: any;
        if (decoded.userType === 'expert') {
          user = await Expert.findById(decoded.id).select('-password');
        } else {
          user = await User.findById(decoded.id).select('-password');
        }

        if (user && user.isActive) {
          (req as any).user = user;
        }
      } catch (error) {
        // Token invalid, but continue without user
      }
    }

    next();
  } catch (error) {
    next();
  }
};
