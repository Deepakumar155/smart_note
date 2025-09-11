const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  _id: { type: String }, // custom document ID
  content: { type: String, default: '' },
  notes: { type: String, default: '' },
  language: { type: String, default: 'javascript' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Document', DocumentSchema);
