import express from 'express';
const router = express.Router();

import { adminLogin, getProfile, changePassword, forgotPassword, resetPassword } from '../../controllers/admin/adminAuthController';
import { listAdmins, createAdmin, updateAdmin, updateAdminPassword, deleteAdmin } from '../../controllers/admin/adminManagementController';
import { createPermission, listPermissions, updatePermission, deletePermission } from '../../controllers/admin/permissionController';
import { adminProtect, requireRole } from '../../middlewares/admin/adminAuth';
import { uploadProfileImage, uploadLogo, getFileUrl } from '../../middlewares/upload';
import Admin from '../../models/Admin';

// Auth
router.post('/auth/login', adminLogin);
router.post('/auth/forgot-password', forgotPassword);
router.post('/auth/reset-password', resetPassword);

// Admin profile & self actions (requires admin auth)
router.get('/profile', adminProtect, getProfile);
router.put('/profile', adminProtect, uploadProfileImage, async (req, res, next) => {
  try {
    const admin = await Admin.findById((req as any).admin.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    const { name, email } = req.body;
    if (name) admin.name = name;
    if (email) admin.email = email;
    
    // Handle profile image upload
    if (req.file) {
      admin.profileImage = req.file.filename;
    }
    
    // Handle logo upload if present in form data
    if ((req as any).files) {
      const logoFile = Array.isArray((req as any).files.logo) ? (req as any).files.logo[0] : (req as any).files.logo;
      if (logoFile) {
        admin.logo = logoFile.filename;
      }
    }
    
    await admin.save();
    res.status(200).json({ success: true, data: { admin }, message: 'Profile updated successfully' });
  } catch (err) {
    next(err);
  }
});

// Get site logo (public endpoint)
router.get('/logo', async (req, res, next) => {
  try {
    const admin = await Admin.findOne({ isActive: true }).select('logo');
    if (!admin || !admin.logo) {
      return res.status(404).json({ success: false, message: 'Logo not found' });
    }
    const logoUrl = getFileUrl(admin.logo, 'logos');
    res.status(200).json({ success: true, data: { logoUrl } });
  } catch (err) {
    next(err);
  }
});

// Upload logo
router.post('/logo', adminProtect, uploadLogo, async (req, res, next) => {
  try {
    const admin = await Admin.findById((req as any).admin.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    if (req.file) {
      admin.logo = req.file.filename;
      await admin.save();
      return res.status(200).json({ success: true, data: { admin }, message: 'Logo uploaded successfully' });
    }

    res.status(400).json({ success: false, message: 'No file provided' });
  } catch (err) {
    next(err);
  }
});

router.put('/change-password', adminProtect, changePassword);

// Superadmin-only admin management
router.get('/admins', adminProtect, requireRole('superadmin'), listAdmins);
router.post('/admins', adminProtect, requireRole('superadmin'), createAdmin);
router.put('/admins/:id/password', adminProtect, requireRole('superadmin'), updateAdminPassword);
router.put('/admins/:id', adminProtect, requireRole('superadmin'), updateAdmin);
router.delete('/admins/:id', adminProtect, requireRole('superadmin'), deleteAdmin);

// Permissions (superadmin)
router.post('/permissions', adminProtect, requireRole('superadmin'), createPermission);
router.get('/permissions', adminProtect, requireRole('superadmin'), listPermissions);
router.put('/permissions/:id', adminProtect, requireRole('superadmin'), updatePermission);
router.delete('/permissions/:id', adminProtect, requireRole('superadmin'), deletePermission);

export default router;
