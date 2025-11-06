const MESSAGES = {
  // Auth messages
  AUTH: {
    REGISTER_SUCCESS: 'Registration successful',
    LOGIN_SUCCESS: 'Login successful',
    LOGOUT_SUCCESS: 'Logout successful',
    INVALID_CREDENTIALS: 'Invalid email or password',
    TOKEN_REQUIRED: 'Access denied. No token provided.',
    TOKEN_INVALID: 'Invalid token',
    TOKEN_EXPIRED: 'Token expired',
    USER_NOT_FOUND: 'User not found',
    ACCOUNT_LOCKED: 'Account locked due to too many failed login attempts',
    ACCOUNT_DEACTIVATED: 'Your account has been deactivated',
    EMAIL_NOT_VERIFIED: 'Please verify your email address',
    PASSWORD_CHANGED: 'Password changed successfully',
    PASSWORD_RESET_SENT: 'Password reset email sent',
    PASSWORD_RESET_SUCCESS: 'Password reset successful',
    OTP_SENT: 'OTP sent successfully',
    OTP_VERIFIED: 'OTP verified successfully',
    OTP_INVALID: 'Invalid or expired OTP',
    OTP_LOCKED: 'OTP verification locked due to too many attempts'
  },
  
  // User messages
  USER: {
    PROFILE_UPDATED: 'Profile updated successfully',
    PROFILE_NOT_FOUND: 'Profile not found',
    EMAIL_EXISTS: 'Email address is already registered',
    PHONE_EXISTS: 'Phone number is already registered',
    USER_CREATED: 'User created successfully',
    USER_UPDATED: 'User updated successfully',
    USER_DELETED: 'User deleted successfully'
  },
  
  // Expert messages
  EXPERT: {
    REGISTER_SUCCESS: 'Expert registration successful. Your profile is pending approval.',
    PROFILE_NOT_APPROVED: 'Your expert profile is not yet approved. Please wait for admin approval.',
    PROFILE_UPDATED: 'Expert profile updated successfully',
    EXPERT_NOT_FOUND: 'Expert not found',
    EXPERT_CREATED: 'Expert created successfully',
    EXPERT_UPDATED: 'Expert updated successfully',
    EXPERT_DELETED: 'Expert deleted successfully'
  },
  
  // Admin messages
  ADMIN: {
    ACCESS_DENIED: 'Access denied. Admin privileges required.',
    ADMIN_CREATED: 'Admin created successfully',
    ADMIN_UPDATED: 'Admin updated successfully',
    ADMIN_DELETED: 'Admin deleted successfully'
  },
  
  // Validation messages
  VALIDATION: {
    REQUIRED_FIELD: 'This field is required',
    INVALID_EMAIL: 'Please enter a valid email address',
    INVALID_PHONE: 'Please enter a valid phone number',
    PASSWORD_TOO_SHORT: 'Password must be at least 6 characters long',
    INVALID_INPUT: 'Invalid input provided'
  },
  
  // General messages
  GENERAL: {
    SUCCESS: 'Operation successful',
    ERROR: 'An error occurred',
    NOT_FOUND: 'Resource not found',
    UNAUTHORIZED: 'Unauthorized access',
    FORBIDDEN: 'Access forbidden',
    SERVER_ERROR: 'Internal server error',
    RATE_LIMIT_EXCEEDED: 'Too many requests, please try again later'
  }
};

module.exports = {
  MESSAGES
};

