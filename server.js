require("dotenv").config();
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const { Server } = require("socket.io");
const multer = require("multer");
const fs = require("fs");
const { spawn, spawnSync } = require("child_process");

const Document = require("./models/Document");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || "*", methods: ["GET", "POST"] },
});

// --- Ensure temp folder exists ---
if (!fs.existsSync("./temp")) {
  fs.mkdirSync("./temp");
}

// --- MongoDB Connection ---
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// --- Middleware ---
app.use(cors({ origin: process.env.CLIENT_URL || "*", credentials: true }));
app.use(express.json());

// --- API Routes ---
const router = express.Router();

// Create room
router.post("/new", async (req, res) => {
  try {
    const { docId, password, filename } = req.body;
    if (!docId || !password || !filename) {
      return res
        .status(400)
        .json({ error: "Room ID, Password, and Filename required" });
    }

    const exists = await Document.findOne({ roomId: docId });
    if (exists) return res.status(409).json({ error: "Room ID already exists" });

    const doc = new Document({
      roomId: docId,
      password,
      files: [{ filename, content: "", language: "javascript" }],
    });
    await doc.save();

    res.json({ ok: true, roomId: docId, file: filename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create room" });
  }
});

// Join room
router.post("/join", async (req, res) => {
  try {
    const { docId, password } = req.body;
    const doc = await Document.findOne({ roomId: docId });
    if (!doc) return res.status(404).json({ error: "Room not found" });

    const valid = await doc.comparePassword(password);
    if (!valid) return res.status(401).json({ error: "Invalid password" });

    res.json({ ok: true, files: doc.files.map((f) => f.filename) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to join room" });
  }
});

// Add new file
router.post("/:roomId/files", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { filename, language } = req.body;

    const doc = await Document.findOne({ roomId });
    if (!doc) return res.status(404).json({ error: "Room not found" });

    if (doc.files.find((f) => f.filename === filename)) {
      return res.status(409).json({ error: "File already exists" });
    }

    doc.files.push({ filename, language: language || "javascript" });
    await doc.save();

    res.json({ ok: true, file: filename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add file" });
  }
});

// Upload file
const upload = multer({ storage: multer.memoryStorage() });
router.post("/:roomId/upload", upload.single("file"), async (req, res) => {
  try {
    const { roomId } = req.params;
    const { password } = req.body;
    const { originalname, buffer } = req.file;

    const doc = await Document.findOne({ roomId });
    if (!doc) return res.status(404).json({ error: "Room not found" });

    const valid = await doc.comparePassword(password);
    if (!valid) return res.status(401).json({ error: "Invalid password" });

    if (doc.files.find((f) => f.filename === originalname)) {
      return res.status(409).json({ error: "File already exists" });
    }

    doc.files.push({
      filename: originalname,
      content: buffer.toString(),
      language: "javascript",
    });
    await doc.save();

    res.json({ ok: true, file: originalname });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// Download file
router.get("/:roomId/download/:filename", async (req, res) => {
  try {
    const { roomId, filename } = req.params;
    const { password } = req.query;

    const doc = await Document.findOne({ roomId });
    if (!doc) return res.status(404).json({ error: "Room not found" });

    const valid = await doc.comparePassword(password);
    if (!valid) return res.status(401).json({ error: "Invalid password" });

    const file = doc.files.find((f) => f.filename === filename);
    if (!file) return res.status(404).json({ error: "File not found" });

    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.setHeader("Content-Type", "text/plain");
    res.send(file.content);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Download failed" });
  }
});

app.use("/api/docs", router);

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

// --- Socket.IO ---
io.on("connection", (socket) => {
  console.log("⚡ Socket connected:", socket.id);

  // === Document Collaboration ===
  socket.on("join-doc", async ({ docId, password, filename }) => {
    try {
      const doc = await Document.findOne({ roomId: docId });
      if (!doc) return socket.emit("error-msg", "Document not found");

      const valid = await doc.comparePassword(password);
      if (!valid) return socket.emit("error-msg", "Invalid password");

      const file = doc.files.find((f) => f.filename === filename);
      if (!file) return socket.emit("error-msg", "File not found");

      socket.join(`doc:${docId}:${filename}`);
      socket.emit("doc-load", file);
    } catch (err) {
      console.error(err);
      socket.emit("error-msg", "Failed to join document");
    }
  });

  socket.on("content-change", ({ docId, filename, from, to, text, origin }) => {
    socket
      .to(`doc:${docId}:${filename}`)
      .emit("remote-content-change", { from, to, text, origin });
  });

  socket.on("notes-change", ({ docId, filename, notes }) => {
    socket.to(`doc:${docId}:${filename}`).emit("remote-notes-change", { notes });
  });

  socket.on("save-doc", async ({ docId, filename, content, notes }) => {
    try {
      await Document.updateOne(
        { roomId: docId, "files.filename": filename },
        {
          $set: {
            "files.$.content": content,
            "files.$.notes": notes,
            "files.$.updatedAt": Date.now(),
          },
        }
      );
      io.in(`doc:${docId}:${filename}`).emit("doc-saved");
    } catch (err) {
      console.error(err);
      socket.emit("error-msg", "Failed to save document");
    }
  });

  // === Terminal Execution ===
  socket.on("run-code", ({ filename, content }) => {
    try {
      const filePath = `./temp/${filename}`;
      fs.writeFileSync(filePath, content);

      let command, args;

      if (filename.endsWith(".js")) {
        command = "node";
        args = [filePath];
      } else if (filename.endsWith(".py")) {
        command = "python3";
        args = [filePath];
      } else if (filename.endsWith(".c")) {
        const exePath = filePath.replace(".c", "");
        spawnSync("gcc", [filePath, "-o", exePath]);
        command = exePath;
        args = [];
      } else if (filename.endsWith(".cpp")) {
        const exePath = filePath.replace(".cpp", "");
        spawnSync("g++", [filePath, "-o", exePath]);
        command = exePath;
        args = [];
      } else if (filename.endsWith(".java")) {
        const dir = path.dirname(filePath);
        const base = path.basename(filename, ".java");
        spawnSync("javac", [filePath]);
        command = "java";
        args = ["-cp", dir, base];
      } else {
        socket.emit("terminal-output", `❌ Unsupported file type: ${filename}`);
        return;
      }

      const run = spawn(command, args);

      run.stdout.on("data", (data) => {
        socket.emit("terminal-output", data.toString());
      });

      run.stderr.on("data", (data) => {
        socket.emit("terminal-output", data.toString());
      });

      run.on("close", (code) => {
        socket.emit(
          "terminal-output",
          `\n🚀 Process exited with code ${code}\n`
        );
      });
    } catch (err) {
      socket.emit("terminal-output", `❌ Error: ${err.message}`);
    }
  });
  socket.on("track-edit", async ({ docId, filename, line, user, timestamp }) => {
  await Document.updateOne(
    { roomId: docId, "files.filename": filename },
    { $set: { [`files.$.editHistory.${line}`]: { user, timestamp } } }
  );
});



  socket.on("disconnect", () =>
    console.log("❌ Socket disconnected:", socket.id)
  );
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
