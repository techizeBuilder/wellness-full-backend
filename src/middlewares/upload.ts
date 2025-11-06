import multer, { MulterError } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';

// Ensure upload directories exist
const ensureUploadDirs = () => {
  const uploadDirs = [
    'uploads/profiles',
    'uploads/documents',
    'uploads/temp'
  ];

  uploadDirs.forEach(dir => {
    const fullPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });
};

// Initialize upload directories
ensureUploadDirs();

// Storage configuration for profile images
const profileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads/profiles'));
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `profile-${uniqueSuffix}${extension}`);
  }
});

// Storage configuration for documents
const documentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads/documents'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `document-${uniqueSuffix}${extension}`);
  }
});

// File filter function
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check if file type is allowed
  const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || ['jpeg', 'jpg', 'png', 'gif'];
  const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);
  
  if (allowedTypes.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${fileExtension} is not allowed. Allowed types: ${allowedTypes.join(', ')}`));
  }
};

// File size limit
const limits = {
  fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10) // 5MB default
};

// Profile image upload middleware
export const uploadProfileImage = multer({
  storage: profileStorage,
  fileFilter: fileFilter,
  limits: limits
}).single('profileImage');

// Document upload middleware
export const uploadDocument = multer({
  storage: documentStorage,
  fileFilter: fileFilter,
  limits: limits
}).single('document');

// Multiple files upload middleware
export const uploadMultiple = multer({
  storage: profileStorage,
  fileFilter: fileFilter,
  limits: limits
}).array('files', 5); // Max 5 files

// Error handling middleware for multer
export const handleUploadError = (error: any, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size allowed is ${Math.round(limits.fileSize / (1024 * 1024))}MB`
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, message: 'Too many files uploaded' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ success: false, message: 'Unexpected field name for file upload' });
    }
  }
  
  if (error?.message?.includes('File type')) {
    return res.status(400).json({ success: false, message: error.message });
  }

  return res.status(500).json({ success: false, message: 'File upload error', error: error?.message });
};

// Helper function to delete file
export const deleteFile = (filePath: string): boolean => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

// Helper function to get file URL
export const getFileUrl = (filename?: string | null, type: 'profiles' | 'documents' = 'profiles') => {
  if (!filename) return null;
  return `/uploads/${type}/${filename}`;
};

// Helper function to get absolute file path
export const getFilePath = (filename?: string | null, type: 'profiles' | 'documents' = 'profiles') => {
  if (!filename) return null;
  return path.join(__dirname, '..', 'uploads', type, filename);
};
