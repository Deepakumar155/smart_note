const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const DocumentSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  content: { type: String, default: '' },
  notes: { type: String, default: '' },
  language: { type: String, default: 'javascript' },
}, { timestamps: true });

// Hash password before save
DocumentSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password
DocumentSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Document', DocumentSchema);
