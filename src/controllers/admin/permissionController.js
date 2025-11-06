const Permission = require('../../models/Permission');
const Admin = require('../../models/Admin');
const { asyncHandler } = require('../../middlewares/errorHandler');

// Create permission
const createPermission = asyncHandler(async (req, res) => {
  const { key, label } = req.body;
  if (!key || !label) return res.status(400).json({ success: false, message: 'Key and label are required' });

  const existing = await Permission.findOne({ key });
  if (existing) return res.status(400).json({ success: false, message: 'Permission key already exists' });

  const perm = await Permission.create({ key, label });
  res.status(201).json({ success: true, data: { permission: perm } });
});

// List permissions
const listPermissions = asyncHandler(async (req, res) => {
  const perms = await Permission.find();
  res.status(200).json({ success: true, data: { permissions: perms } });
});

// Update permission
const updatePermission = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const { key, label } = req.body;
  const perm = await Permission.findById(id);
  if (!perm) return res.status(404).json({ success: false, message: 'Permission not found' });

  if (key) perm.key = key;
  if (label) perm.label = label;
  await perm.save();

  res.status(200).json({ success: true, data: { permission: perm } });
});

// Delete permission
const deletePermission = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const perm = await Permission.findById(id);
  if (!perm) return res.status(404).json({ success: false, message: 'Permission not found' });

  // Optionally remove this permission from admins
  await Admin.updateMany({ permissions: perm.key }, { $pull: { permissions: perm.key } });

  await perm.remove();

  res.status(200).json({ success: true, message: 'Permission removed' });
});

module.exports = {
  createPermission,
  listPermissions,
  updatePermission,
  deletePermission
};
