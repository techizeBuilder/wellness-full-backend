const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  key: {
    type: String,
    required: [true, 'Permission key is required'],
    unique: true,
    trim: true
  },
  label: {
    type: String,
    required: [true, 'Permission label is required'],
    trim: true
  }
}, {
  timestamps: true
});

permissionSchema.index({ key: 1 });

module.exports = mongoose.model('Permission', permissionSchema);
