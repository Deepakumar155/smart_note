const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const fileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  content: { type: String, default: '' },
  notes: { type: String, default: '' },
  language: { type: String, default: 'javascript' },
  updatedAt: { type: Date, default: Date.now }
});

const documentSchema = new mongoose.Schema({
  roomId: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  files: [fileSchema],
}, { timestamps: true });

// Hash password before save
documentSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password
documentSchema.methods.comparePassword = async function(pw) {
  return bcrypt.compare(pw, this.password);
};

module.exports = mongoose.model('Document', documentSchema);
