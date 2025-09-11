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
app.use('/api/docs', require('./routes/docs'));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// --- Socket.IO ---
io.on('connection', socket => {
  console.log('⚡ Socket connected:', socket.id);

  socket.on('join-doc', async ({ docId }) => {
    if (!docId) return;
    try {
      const doc = await Document.findById(docId).exec();
      if (!doc) return socket.emit('error', { message: 'Document not found' });

      socket.join(`doc:${docId}`);
      socket.emit('doc-load', { content: doc.content, notes: doc.notes, language: doc.language });
    } catch (err) {
      console.error('join-doc error:', err);
      socket.emit('error', { message: 'Invalid document ID' });
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
      await Document.findByIdAndUpdate(docId, { content, notes, updatedAt: Date.now() }).exec();
      io.in(`doc:${docId}`).emit('doc-saved');
    } catch (err) {
      console.error('save-doc error:', err);
      socket.emit('error', { message: 'Failed to save document' });
    }
  });

  socket.on('disconnect', () => console.log('❌ Socket disconnected:', socket.id));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
