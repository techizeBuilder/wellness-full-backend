const crypto = require('crypto');
const Admin = require('../../models/Admin');
const Permission = require('../../models/Permission');
const { asyncHandler } = require('../../middlewares/errorHandler');
const { sendEmail } = require('../../utils/emailService');

// List all admins
const listAdmins = asyncHandler(async (req, res) => {
  const admins = await Admin.find().select('-password');
  res.status(200).json({ success: true, data: { admins } });
});

// Create new admin (generate password and send email)
const createAdmin = asyncHandler(async (req, res) => {
  const { name, email, role = 'admin', permissions = [] } = req.body;

  if (!name || !email) return res.status(400).json({ success: false, message: 'Name and email are required' });

  const existing = await Admin.findOne({ email });
  if (existing) return res.status(400).json({ success: false, message: 'Admin with this email already exists' });

  // Basic validation for role
  if (!['admin', 'superadmin'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role' });

  // Use provided password if present, otherwise generate a secure temp password
  let tempPassword = req.body.password;
  if (!tempPassword) {
    tempPassword = crypto.randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
  }

  const admin = await Admin.create({ name, email, password: tempPassword, role, permissions });

  // Send welcome email with credentials
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2c5e6b; margin: 0;">Welcome to Wellness App</h1>
          <p style="color: #666; font-size: 16px;">Admin Account Created</p>
        </div>
        
        <p style="font-size: 16px; color: #333;">Hello <strong>${name}</strong>,</p>
        
        <p style="font-size: 16px; color: #333; line-height: 1.6;">
          Your admin account has been successfully created for the Wellness App Admin Panel. 
          Below are your login credentials:
        </p>
        
        <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2c5e6b;">
          <p style="margin: 0; font-size: 16px;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 10px 0 0 0; font-size: 16px;"><strong>Password:</strong> <span style="font-family: monospace; background: #e8e8e8; padding: 4px 8px; border-radius: 4px;">${tempPassword}</span></p>
          <p style="margin: 10px 0 0 0; font-size: 16px;"><strong>Role:</strong> ${role === 'superadmin' ? 'Super Admin' : 'Admin'}</p>
        </div>
        
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0; font-size: 14px; color: #856404;">
            <strong>Security Notice:</strong> Please log in and change your password immediately for security purposes.
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" 
             style="background-color: #2c5e6b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            Access Admin Panel
          </a>
        </div>
        
        <p style="font-size: 14px; color: #666; text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
          © 2025 Techizebuilder. All rights reserved.<br>
          If you have any questions, please contact the system administrator.
        </p>
      </div>
    </div>
  `;

  try {
    const emailResult = await sendEmail({ 
      email, 
      subject: 'Welcome to Wellness App - Admin Account Created', 
      html 
    });
    
    if (emailResult.success) {
      console.log(`Welcome email sent successfully to ${email}, messageId: ${emailResult.messageId}`);
    } else {
      console.error(`Failed to send welcome email to ${email}:`, emailResult.error);
    }
  } catch (err) {
    // Log but continue - don't fail admin creation if email fails
    console.error('Failed to send admin welcome email to', email, ':', err.message);
  }

  res.status(201).json({ success: true, data: { admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role, permissions: admin.permissions } } });
});

// Update admin
const updateAdmin = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const { name, role, isActive, permissions } = req.body;

  const admin = await Admin.findById(id);
  if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

  // Prevent demote/delete of primary superadmin
  if (admin.isPrimary) {
    // if trying to change role or deactivate primary superadmin, block
    if ((role && role !== 'superadmin') || (isActive === false)) {
      return res.status(400).json({ success: false, message: 'Cannot modify primary superadmin' });
    }
  }

  // Prevent superadmin from demoting themselves
  if (req.admin.id === id && role && role !== admin.role) {
    return res.status(400).json({ success: false, message: 'You cannot change your own role' });
  }

  if (name) admin.name = name;
  if (typeof isActive === 'boolean') admin.isActive = isActive;
  if (permissions) admin.permissions = permissions;
  if (role) admin.role = role;

  await admin.save();

  res.status(200).json({ success: true, data: { admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role, permissions: admin.permissions, isActive: admin.isActive } } });
});

// Delete admin (hard delete)
const deleteAdmin = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const admin = await Admin.findById(id);
  if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

  if (admin.isPrimary) return res.status(400).json({ success: false, message: 'Cannot delete primary superadmin' });

  await Admin.findByIdAndDelete(id);

  res.status(200).json({ success: true, message: 'Admin deleted' });
});

module.exports = {
  listAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin
};
