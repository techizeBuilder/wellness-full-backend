import multer, { MulterError } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';

// Ensure upload directories exist
const ensureUploadDirs = () => {
  const uploadDirs = [
    'uploads/profiles',
    'uploads/documents',
    'uploads/prescriptions',
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

const createFileFilter = (allowedTypes: string[]) => (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);
  if (allowedTypes.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${fileExtension} is not allowed. Allowed types: ${allowedTypes.join(', ')}`));
  }
};

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

const prescriptionStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads/prescriptions'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `prescription-${uniqueSuffix}${extension}`);
  }
});

const imageFileFilter = createFileFilter((process.env.ALLOWED_FILE_TYPES?.split(',') || ['jpeg', 'jpg', 'png', 'gif']).map(type => type.trim().toLowerCase()));
const documentFileFilter = createFileFilter((process.env.ALLOWED_DOCUMENT_TYPES?.split(',') || ['pdf', 'doc', 'docx', 'jpeg', 'jpg', 'png']).map(type => type.trim().toLowerCase()));
const prescriptionFileFilter = createFileFilter(['pdf']);

// File size limit
const limits = {
  fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10) // 5MB default
};

// Profile image upload middleware
export const uploadProfileImage = multer({
  storage: profileStorage,
  fileFilter: imageFileFilter,
  limits: limits
}).single('profileImage');

// Document upload middleware
export const uploadDocument = multer({
  storage: documentStorage,
  fileFilter: documentFileFilter,
  limits: limits
}).single('document');

// Multiple files upload middleware
export const uploadMultiple = multer({
  storage: profileStorage,
  fileFilter: imageFileFilter,
  limits: limits
}).array('files', 5); // Max 5 files

export const uploadPrescription = multer({
  storage: prescriptionStorage,
  fileFilter: prescriptionFileFilter,
  limits: {
    fileSize: parseInt(process.env.PRESCRIPTION_MAX_FILE_SIZE || '5242880', 10)
  }
}).single('prescription');

// Certificate storage (PDF, JPG, PNG)
const certificateStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads/documents'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname) || '.pdf';
    cb(null, `certificate-${uniqueSuffix}${extension}`);
  }
});

const certificateFileFilter = createFileFilter(['pdf', 'jpg', 'jpeg', 'png']);

export const uploadCertificates = multer({
  storage: certificateStorage,
  fileFilter: certificateFileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10) // 5MB default
  }
}).array('certificates', 3); // Max 3 certificates

// Combined file filter for expert registration (profile image + certificates)
const expertRegistrationFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (file.fieldname === 'profileImage') {
    return imageFileFilter(req, file, cb);
  } else if (file.fieldname === 'certificates') {
    return certificateFileFilter(req, file, cb);
  }
  cb(new Error(`Unexpected field name: ${file.fieldname}`));
};

// Combined upload for expert registration: profile image + certificates
// Use different storage for certificates
const expertRegistrationStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'profileImage') {
      cb(null, path.join(__dirname, '..', 'uploads/profiles'));
    } else if (file.fieldname === 'certificates') {
      cb(null, path.join(__dirname, '..', 'uploads/documents'));
    } else {
      cb(new Error(`Unexpected field name: ${file.fieldname}`), '');
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    if (file.fieldname === 'profileImage') {
      const extension = path.extname(file.originalname);
      cb(null, `profile-${uniqueSuffix}${extension}`);
    } else if (file.fieldname === 'certificates') {
      const extension = path.extname(file.originalname) || '.pdf';
      cb(null, `certificate-${uniqueSuffix}${extension}`);
    } else {
      cb(new Error(`Unexpected field name: ${file.fieldname}`), '');
    }
  }
});

export const uploadExpertRegistration = multer({
  storage: expertRegistrationStorage,
  fileFilter: expertRegistrationFileFilter,
  limits: limits
}).fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'certificates', maxCount: 3 }
]);

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

// Helper function to normalize filename (extract just filename from path)
const normalizeFilename = (filePath: string | null | undefined): string | null => {
  if (!filePath) return null;
  
  // If it's already just a filename (no path separators), return as is
  if (!filePath.includes('/') && !filePath.includes('\\')) {
    return filePath;
  }
  
  // Extract filename from path
  const normalized = filePath.replace(/\\/g, '/');
  const filename = normalized.split('/').pop() || null;
  
  return filename;
};

// Helper function to get file URL
export const getFileUrl = (filename?: string | null, type: 'profiles' | 'documents' | 'prescriptions' = 'profiles') => {
  if (!filename) return null;
  
  // Normalize filename to handle cases where full path might be stored
  const normalizedFilename = normalizeFilename(filename);
  if (!normalizedFilename) return null;
  
  return `/uploads/${type}/${normalizedFilename}`;
};

// Helper function to get absolute file path
export const getFilePath = (filename?: string | null, type: 'profiles' | 'documents' | 'prescriptions' = 'profiles') => {
  if (!filename) return null;
  return path.join(__dirname, '..', 'uploads', type, filename);
};

