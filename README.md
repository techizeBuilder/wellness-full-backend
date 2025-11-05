# Wellness App Backend API

A complete Node.js + Express + MongoDB backend with JWT authentication, email verification, password reset, and file upload functionality.

## Features

- ✅ User and Expert Registration/Login with JWT
- ✅ Email verification with OTP
- ✅ Password reset functionality
- ✅ Profile image upload with Multer
- ✅ Input validation with Joi
- ✅ Rate limiting and security middleware
- ✅ MongoDB with Mongoose ODM
- ✅ Email service with Nodemailer
- ✅ Production-ready error handling
- ✅ CORS configuration
- ✅ File serving for uploaded images

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud)
- Gmail account for email service

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## Environment Variables

```env
NODE_ENV=development
PORT=5000

# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database

# JWT
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=your_super_secret_refresh_jwt_key
JWT_REFRESH_EXPIRE=30d

# Email (Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=your_email@gmail.com

# OTP
OTP_EXPIRE_MINUTES=10

# File Upload
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=jpeg,jpg,png,gif

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Security
BCRYPT_ROUNDS=12
```

## API Endpoints

### Authentication (Users)

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "password": "Password123",
  "confirmPassword": "Password123",
  "dateOfBirth": "1990-01-01",
  "gender": "male"
}
```

#### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "Password123"
}
```

#### Send OTP
```http
POST /api/auth/send-otp
Content-Type: application/json

{
  "email": "john@example.com"
}
```

#### Verify OTP
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "email": "john@example.com",
  "otp": "123456"
}
```

#### Forgot Password
```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "john@example.com"
}
```

#### Reset Password
```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "reset_token_from_email",
  "password": "NewPassword123",
  "confirmPassword": "NewPassword123"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <jwt_token>
```

#### Update Profile
```http
PUT /api/auth/profile
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data

{
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+1234567890",
  "profileImage": <file>
}
```

#### Change Password
```http
PUT /api/auth/change-password
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword123",
  "confirmNewPassword": "NewPassword123"
}
```

### Expert Management

#### Register Expert
```http
POST /api/experts/register
Content-Type: multipart/form-data

{
  "firstName": "Dr. Jane",
  "lastName": "Smith",
  "email": "jane@example.com",
  "phone": "+1234567890",
  "password": "Password123",
  "confirmPassword": "Password123",
  "specialization": "Nutrition",
  "experience": 5,
  "bio": "Certified nutritionist...",
  "hourlyRate": 100,
  "qualifications": "[{\"degree\":\"PhD Nutrition\",\"institution\":\"University\",\"year\":2015}]",
  "languages": "[\"English\",\"Spanish\"]",
  "consultationMethods": "[\"video\",\"audio\"]",
  "profileImage": <file>
}
```

#### Expert Login
```http
POST /api/experts/login
Content-Type: application/json

{
  "email": "jane@example.com",
  "password": "Password123"
}
```

#### Get All Experts (Public)
```http
GET /api/experts?page=1&limit=10&specialization=nutrition&minRating=4&sortBy=rating
```

#### Get Expert by ID
```http
GET /api/experts/:expertId
```

#### Get Current Expert
```http
GET /api/experts/me
Authorization: Bearer <jwt_token>
```

#### Update Expert Profile
```http
PUT /api/experts/profile
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data

{
  "bio": "Updated bio...",
  "hourlyRate": 120,
  "availability": "{\"monday\":{\"start\":\"09:00\",\"end\":\"17:00\",\"available\":true}}",
  "profileImage": <file>
}
```

### Expert-specific Auth Endpoints

Expert authentication endpoints follow the same pattern as user auth but use the `/api/experts/` prefix:

- `POST /api/experts/send-otp`
- `POST /api/experts/verify-otp`
- `POST /api/experts/forgot-password`
- `POST /api/experts/reset-password`
- `PUT /api/experts/change-password`

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": ["Specific error messages"]
}
```

## File Uploads

### Profile Images
- **Endpoint**: Any endpoint with file upload
- **Field name**: `profileImage`
- **Allowed formats**: JPEG, JPG, PNG, GIF
- **Max size**: 5MB
- **Storage**: Local storage in `/uploads/profiles/`
- **Access**: `GET /uploads/profiles/filename.jpg`

### Upload Response
Uploaded files are returned with full URLs:
```json
{
  "success": true,
  "data": {
    "user": {
      "profileImage": "/uploads/profiles/profile-1234567890-123456789.jpg"
    }
  }
}
```

## Rate Limiting

- **Global**: 100 requests per 15 minutes per IP
- **Authentication**: 5 requests per 15 minutes per IP
- **OTP**: 3 requests per minute per IP

## Security Features

- JWT token authentication
- Password hashing with bcrypt
- Account lockout after failed login attempts
- OTP verification with attempt limits
- Rate limiting on sensitive endpoints
- Input validation with Joi
- CORS configuration
- Helmet security headers
- File upload restrictions

## Database Models

### User Model
- Basic user information
- Authentication fields
- Email/phone verification
- Profile image
- Account status and security

### Expert Model
- Extends user functionality
- Professional qualifications
- Specialization and experience
- Availability schedule
- Rating system
- Verification status

## Error Handling

The API includes comprehensive error handling:
- Mongoose validation errors
- JWT token errors
- Duplicate key errors
- File upload errors
- Custom application errors

## Development

### Run in Development Mode
```bash
npm run dev
```

### Project Structure
```
backend/
├── config/          # Database configuration
├── controllers/     # Route controllers
├── middlewares/     # Custom middleware
├── models/          # Mongoose models
├── routes/          # Express routes
├── utils/           # Utility functions
├── uploads/         # File uploads
└── server.js        # Main server file
```

### Adding New Features

1. Create model in `/models/`
2. Create controller in `/controllers/`
3. Add validation in `/utils/validation.js`
4. Create routes in `/routes/`
5. Register routes in `server.js`

## Deployment

### Production Setup

1. Set `NODE_ENV=production`
2. Configure production MongoDB URI
3. Set secure JWT secrets
4. Configure email service
5. Set up reverse proxy (nginx)
6. Enable SSL/HTTPS
7. Configure file storage (consider cloud storage)

### Environment Configuration

Ensure all environment variables are properly set in production:
- Database connection
- JWT secrets (different from development)
- Email credentials
- File upload limits
- CORS origins

## Testing

The API can be tested using:
- Postman (import collection)
- curl commands
- Frontend integration
- Automated tests (to be added)

## Support

For issues and questions:
1. Check the logs for error details
2. Verify environment configuration
3. Test individual endpoints
4. Check database connectivity
5. Validate email service setup

## License

MIT License - see LICENSE file for details.