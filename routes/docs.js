const express = require('express');
const router = express.Router();
const Document = require('../models/Document');

// --- Create new blank document ---
router.post('/new', async (req, res) => {
  try {
    const doc = await Document.create({ content: '', notes: '' });
    res.status(201).json({ ok: true, _id: doc._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Failed to create document' });
  }
});

// --- Get document by ID ---
router.get('/:id', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, error: 'Document not found' });
    res.json({ ok: true, doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Failed to fetch document' });
  }
});

// --- Update document ---
router.put('/:id', async (req, res) => {
  try {
    const { content, notes, title, language } = req.body;
    const doc = await Document.findByIdAndUpdate(
      req.params.id,
      { content, notes, title, language },
      { new: true }
    );
    if (!doc) return res.status(404).json({ ok: false, error: 'Document not found' });
    res.json({ ok: true, doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Failed to update document' });
  }
});

// --- List recent documents (optional, limit 50) ---
router.get('/', async (req, res) => {
  try {
    const docs = await Document.find().limit(50).sort({ updatedAt: -1 });
    res.json({ ok: true, docs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Failed to fetch documents' });
  }
});

module.exports = router;
