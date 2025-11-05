# Wellness App API Summary & Issues Report

## Overview
The Wellness App backend provides REST APIs for user authentication, expert management, and file uploads. This document summarizes all available endpoints and any issues found during analysis.

## Issues Found and Fixed

### 1. Server.js File Corruption ✅ FIXED
**Issue**: The original server.js file had severe corruption with duplicated imports and malformed code.
**Resolution**: Created a clean server.js file with proper structure and all necessary middleware configurations.

### 2. No Critical Backend Errors Found
After fixing the server.js file, no other critical errors were found in:
- Route configurations
- Controller implementations
- Model definitions
- Middleware implementations

## Complete API Endpoints

### Public Endpoints

#### Health & Information
- `GET /health` - Server health check
- `GET /` - API information and documentation

#### Expert Browsing (Public)
- `GET /api/experts` - Get all experts with optional filtering
  - Query parameters: `page`, `limit`, `specialization`, `minRating`, `maxPrice`, `availability`
- `GET /api/experts/:id` - Get specific expert by ID

#### File Access
- `GET /uploads/profiles/:filename` - Access uploaded profile images
- `GET /uploads/documents/:filename` - Access uploaded documents

### Authentication Endpoints

#### User Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/send-otp` - Send OTP for email verification
- `POST /api/auth/verify-otp` - Verify OTP code
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

#### User Protected Endpoints (Requires Authentication)
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/profile` - Update user profile (supports file upload)
- `PUT /api/auth/change-password` - Change user password
- `POST /api/auth/logout` - Logout user

#### Expert Authentication
- `POST /api/experts/register` - Register new expert (supports file upload)
- `POST /api/experts/login` - Expert login
- `POST /api/experts/send-otp` - Send OTP for expert verification
- `POST /api/experts/verify-otp` - Verify expert OTP
- `POST /api/experts/forgot-password` - Expert password reset request
- `POST /api/experts/reset-password` - Expert password reset

#### Expert Protected Endpoints (Requires Expert Authentication)
- `GET /api/experts/me` - Get current expert profile
- `PUT /api/experts/profile` - Update expert profile (supports file upload)
- `PUT /api/experts/change-password` - Change expert password

## Security Features

### Rate Limiting
- **Global Limit**: 100 requests per 15 minutes per IP
- **Authentication Endpoints**: 5 requests per 15 minutes per IP
- **OTP Endpoints**: 3 requests per minute per IP

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (user vs expert)
- Password hashing with bcrypt
- OTP verification for email validation
- Account lockout after failed login attempts

### Security Middleware
- Helmet.js for security headers
- CORS configuration for cross-origin requests
- Request size limits (10MB)
- File upload restrictions and validation

## Data Models

### User Model
- Personal information (name, email, phone, DOB, gender)
- Authentication fields (password, verification status)
- Profile management (profile image)
- Security features (login attempts, OTP handling)

### Expert Model
- All user fields plus:
- Professional information (specialization, experience, bio)
- Pricing (hourly rate)
- Qualifications and certifications
- Languages spoken
- Consultation methods (video, chat, phone)
- Verification status (pending, approved, rejected)
- Rating system

## File Upload Support

### Supported File Types
- Profile images: JPG, JPEG, PNG
- Documents: PDF (for expert qualifications)

### Upload Locations
- Profile images: `/uploads/profiles/`
- Documents: `/uploads/documents/`
- Temporary files: `/uploads/temp/`

## Environment Configuration

### Required Environment Variables
- `NODE_ENV` - Environment mode (development/production)
- `PORT` - Server port (default: 5000)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `JWT_EXPIRE` - JWT expiration time
- `RATE_LIMIT_MAX_REQUESTS` - Global rate limit
- `EMAIL_*` - Email service configuration
- `FRONTEND_URL` - Frontend application URL

## Database Collections

### Users Collection
- Stores user accounts with authentication and profile data
- Indexes on email and phone for quick lookups

### Experts Collection
- Stores expert accounts with professional information
- Extended user model with additional expert-specific fields
- Verification workflow support

## Postman Collection Features

### Automatic Token Management
- Auto-extracts JWT tokens from login/register responses
- Auto-includes tokens in protected endpoint requests
- Supports both user and expert authentication flows

### Environment Support
- Development environment (localhost:5000)
- Production environment (configurable)
- Easy environment switching

### Comprehensive Coverage
- All 25+ API endpoints included
- Example request bodies for all POST/PUT endpoints
- File upload examples with form-data
- Query parameter examples for GET endpoints

## Testing Recommendations

### 1. Authentication Flow Testing
1. Test user registration → OTP verification → login
2. Test expert registration → OTP verification → login → profile approval
3. Test password reset flows
4. Test token expiration and refresh

### 2. Authorization Testing
1. Access protected endpoints without tokens (should fail)
2. Access expert endpoints with user tokens (should fail)
3. Access user endpoints with expert tokens (should work for general endpoints)

### 3. Rate Limiting Testing
1. Exceed rate limits on various endpoint categories
2. Verify proper error responses and retry headers

### 4. File Upload Testing
1. Upload valid profile images
2. Test file size limits
3. Test invalid file types
4. Test file access via static URLs

### 5. Input Validation Testing
1. Test required field validation
2. Test email format validation
3. Test password strength requirements
4. Test phone number format validation

## API Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

### Validation Error Response
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Valid email is required"
    }
  ]
}
```

## Conclusion

The backend API is well-structured with comprehensive authentication, authorization, and data management capabilities. The major issue (corrupted server.js) has been resolved, and the provided Postman collection offers complete testing coverage for all endpoints.

### Files Provided:
1. `wellness-app-postman-collection.json` - Complete API collection
2. `wellness-app-development-environment.json` - Development environment
3. `wellness-app-production-environment.json` - Production environment  
4. `POSTMAN_README.md` - Detailed usage instructions
5. `server.js` - Fixed and cleaned server file

The API is ready for testing and development use.