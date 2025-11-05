const express = require('express');
const router = express.Router();

const { adminLogin, getProfile, changePassword, forgotPassword, resetPassword } = require('../../controllers/admin/adminAuthController');
const { listAdmins, createAdmin, updateAdmin, deleteAdmin } = require('../../controllers/admin/adminManagementController');
const { createPermission, listPermissions, updatePermission, deletePermission } = require('../../controllers/admin/permissionController');
const { adminProtect, requireRole } = require('../../middlewares/admin/adminAuth');

// Auth
router.post('/auth/login', adminLogin);
router.post('/auth/forgot-password', forgotPassword);
router.post('/auth/reset-password', resetPassword);

// Admin profile & self actions (requires admin auth)
router.get('/profile', adminProtect, getProfile);
router.put('/profile', adminProtect, async (req, res, next) => {
  try {
    const AdminModel = require('../../models/Admin');
    const admin = await AdminModel.findById(req.admin.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    const { name, email } = req.body;
    if (name) admin.name = name;
    if (email) admin.email = email;
    await admin.save();
    res.status(200).json({ success: true, data: { admin } });
  } catch (err) {
    next(err);
  }
});
router.put('/change-password', adminProtect, changePassword);

// Superadmin-only admin management
router.get('/admins', adminProtect, requireRole('superadmin'), listAdmins);
router.post('/admins', adminProtect, requireRole('superadmin'), createAdmin);
router.put('/admins/:id', adminProtect, requireRole('superadmin'), updateAdmin);
router.delete('/admins/:id', adminProtect, requireRole('superadmin'), deleteAdmin);

// Permissions (superadmin)
router.post('/permissions', adminProtect, requireRole('superadmin'), createPermission);
router.get('/permissions', adminProtect, requireRole('superadmin'), listPermissions);
router.put('/permissions/:id', adminProtect, requireRole('superadmin'), updatePermission);
router.delete('/permissions/:id', adminProtect, requireRole('superadmin'), deletePermission);

module.exports = router;
