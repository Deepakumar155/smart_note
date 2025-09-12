require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

const Document = require('./models/Document');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || '*', methods: ['GET', 'POST'] },
});

// --- MongoDB ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// --- Middleware ---
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json());

// --- Routes ---
const router = express.Router();

// Create new document
router.post('/new', async (req, res) => {
  try {
    const { docId, password } = req.body;
    if (!docId || !password) {
      return res.status(400).json({ error: "Room ID and Password required" });
    }

    const exists = await Document.findOne({ roomId: docId }).exec();
    if (exists) return res.status(409).json({ error: "Room ID already exists" });

    const doc = new Document({ roomId: docId, password });
    await doc.save();

    res.json({ ok: true, roomId: docId });
  } catch (err) {
    console.error("Create room error:", err);
    res.status(500).json({ error: "Failed to create room" });
  }
});

// Join existing document (validate credentials)
router.post('/join', async (req, res) => {
  try {
    const { docId, password } = req.body;
    if (!docId || !password) {
      return res.status(400).json({ error: "Room ID and Password required" });
    }

    const doc = await Document.findOne({ roomId: docId }).exec();
    if (!doc) return res.status(404).json({ error: "Room not found" });

    const valid = await doc.comparePassword(password);
    if (!valid) return res.status(401).json({ error: "Invalid password" });

    res.json({ ok: true });
  } catch (err) {
    console.error("Join room error:", err);
    res.status(500).json({ error: "Failed to join room" });
  }
});

app.use('/api/docs', router);

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// --- Socket.IO ---
io.on('connection', socket => {
  console.log('⚡ Socket connected:', socket.id);

  socket.on('join-doc', async ({ docId, password }) => {
    if (!docId || !password) return;

    try {
      const doc = await Document.findOne({ roomId: docId }).exec();
      if (!doc) return socket.emit('error-msg', 'Document not found');

      const valid = await doc.comparePassword(password);
      if (!valid) return socket.emit('error-msg', 'Invalid password');

      socket.join(`doc:${docId}`);
      socket.emit('doc-load', {
        content: doc.content,
        notes: doc.notes,
        language: doc.language,
      });
    } catch (err) {
      console.error('join-doc error:', err);
      socket.emit('error-msg', 'Failed to join document');
    }
  });

  socket.on('content-change', ({ docId, from, to, text, origin }) => {
    if (!docId) return;
    socket.to(`doc:${docId}`).emit('remote-content-change', { from, to, text, origin });
  });

  socket.on('notes-change', ({ docId, notes }) => {
    if (!docId) return;
    socket.to(`doc:${docId}`).emit('remote-notes-change', { notes });
  });

  socket.on('save-doc', async ({ docId, content, notes }) => {
    if (!docId) return;
    try {
      await Document.findOneAndUpdate(
        { roomId: docId },
        { content, notes, updatedAt: Date.now() }
      ).exec();
      io.in(`doc:${docId}`).emit('doc-saved');
    } catch (err) {
      console.error('save-doc error:', err);
      socket.emit('error-msg', 'Failed to save document');
    }
  });

  socket.on('disconnect', () => console.log('❌ Socket disconnected:', socket.id));
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
