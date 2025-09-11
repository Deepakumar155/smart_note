// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

// Models
const Document = require('./models/Document');

// Initialize app + server
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// --------------------
// Database Connection
// --------------------
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// --------------------
// Middleware
// --------------------
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json());

// Session store
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'dev_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
  }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24, // 1 day
  },
});
app.use(sessionMiddleware);

// --------------------
// Routes
// --------------------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/docs', require('./routes/docs'));

// Serve static files (frontend build)
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --------------------
// Socket.IO with session
// --------------------
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

io.on('connection', (socket) => {
  console.log('⚡ Socket connected:', socket.id);

  // Join a document room
  socket.on('join-doc', async ({ docId }) => {
    if (!docId) return;
    try {
      const doc = await Document.findById(docId).exec();
      if (!doc) {
        socket.emit('error', { message: 'Document not found' });
        return;
      }
      socket.join(`doc:${docId}`);
      socket.emit('doc-load', {
        content: doc.content,
        notes: doc.notes,
        language: doc.language,
      });
    } catch (err) {
      console.error('join-doc error:', err);
      socket.emit('error', { message: 'Invalid document ID' });
    }
  });

  // Content changes
  socket.on('content-change', ({ docId, content }) => {
    if (!docId) return;
    socket.to(`doc:${docId}`).emit('remote-content-change', { content });
  });

  // Notes changes
  socket.on('notes-change', ({ docId, notes }) => {
    if (!docId) return;
    socket.to(`doc:${docId}`).emit('remote-notes-change', { notes });
  });

  // Save document
  socket.on('save-doc', async ({ docId, content, notes }) => {
    if (!docId) return;
    try {
      await Document.findByIdAndUpdate(docId, {
        content,
        notes,
        updatedAt: Date.now(),
      }).exec();
      socket.to(`doc:${docId}`).emit('doc-saved');
    } catch (err) {
      console.error('save-doc error:', err);
      socket.emit('error', { message: 'Failed to save document' });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('❌ Socket disconnected:', socket.id);
  });
});

// --------------------
// Start Server
// --------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
