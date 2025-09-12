const express = require('express');
const router = express.Router();
const Document = require('../models/Document');

// Create new document
router.post('/new', async (req, res) => {
  const { docId, password } = req.body;
  if (!docId || !password) return res.status(400).json({ error: 'Room ID and password required' });

  try {
    const existing = await Document.findOne({ roomId: docId }).exec();
    if (existing) return res.status(400).json({ error: 'Room ID already exists' });

    const doc = new Document({ roomId: docId, password });
    await doc.save();

    res.json({ ok: true, doc });
  } catch (err) {
    console.error('Create doc error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
