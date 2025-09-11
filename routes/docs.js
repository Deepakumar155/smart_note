const express = require('express');
const router = express.Router();
const Document = require('../models/Document');

// Create new document with custom ID
router.post('/new', async (req, res) => {
  const { docId } = req.body;
  if (!docId) return res.status(400).json({ error: 'Document ID is required' });
  if (!/^[\w-]+$/.test(docId)) return res.status(400).json({ error: 'Invalid Document ID' });

  try {
    const exists = await Document.findById(docId).exec();
    if (exists) return res.status(400).json({ error: 'Document ID already exists' });

    const newDoc = await Document.create({ _id: docId });
    res.json(newDoc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// Optional: get a document by ID
router.get('/:id', async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).exec();
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

module.exports = router;
