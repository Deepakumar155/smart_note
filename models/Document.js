const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  title: { type: String, default: 'Untitled' },
  language: { type: String, default: 'javascript' },
  content: { type: String, default: '' },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Document', DocumentSchema);
