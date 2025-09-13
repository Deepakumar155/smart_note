const socket = io();
let editor, currentDocId, currentPassword, currentFilename, suppressChange = false;

window.addEventListener('load', () => {
  editor = CodeMirror.fromTextArea(document.getElementById('code'), {
    lineNumbers: true,
    mode: 'javascript',
    theme: 'default',
  });
  editor.setSize('100%', '80%');

  const statusEl = document.getElementById('status');
  const notesEl = document.getElementById('notes');
  const fileList = document.getElementById('fileList');
  const addFileBtn = document.getElementById('addFileBtn');
  const newFileName = document.getElementById('newFileName');

  const params = new URLSearchParams(window.location.search);
  currentDocId = params.get('id');
  currentPassword = params.get('pw');
  currentFilename = params.get('file') || "main.js";

  if (currentDocId && currentPassword) {
    socket.emit('join-doc', { docId: currentDocId, password: currentPassword, filename: currentFilename });
    statusEl.innerText = `🔗 Joined ${currentDocId}/${currentFilename}`;
  }

  // --- File Handling ---
  async function loadFiles() {
    const res = await fetch(`/api/docs/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId: currentDocId, password: currentPassword }),
    });
    const data = await res.json();
    if (data.ok) {
      fileList.innerHTML = '';
      data.files.forEach(f => {
        const li = document.createElement('li');
        li.textContent = f;
        li.onclick = () => switchFile(f);
        if (f === currentFilename) li.style.fontWeight = 'bold';
        fileList.appendChild(li);
      });
    }
  }

  async function addFile() {
    const filename = newFileName.value.trim();
    if (!filename) return;
    await fetch(`/api/docs/${currentDocId}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    });
    newFileName.value = '';
    loadFiles();
  }

  async function switchFile(filename) {
    currentFilename = filename;
    socket.emit('join-doc', { docId: currentDocId, password: currentPassword, filename });
    statusEl.innerText = `🔗 Switched to ${filename}`;
    loadFiles();
  }

  addFileBtn.addEventListener('click', addFile);
  loadFiles();

  // --- Socket Events ---
  socket.on('doc-load', ({ content, notes, filename }) => {
    suppressChange = true;
    editor.setValue(content || '');
    suppressChange = false;
    notesEl.value = notes || '';
    currentFilename = filename;
    loadFiles();
  });

  editor.on('change', (instance, changeObj) => {
    if (!currentDocId || !currentFilename || suppressChange) return;
    socket.emit('content-change', { docId: currentDocId, filename: currentFilename, ...changeObj });
  });

  socket.on('remote-content-change', ({ from, to, text, origin }) => {
    suppressChange = true;
    editor.replaceRange(text, from, to, origin);
    suppressChange = false;
  });

  notesEl.addEventListener('input', () => {
    if (!currentFilename) return;
    socket.emit('notes-change', { docId: currentDocId, filename: currentFilename, notes: notesEl.value });
  });

  socket.on('remote-notes-change', ({ notes }) => {
    if (notes !== notesEl.value) notesEl.value = notes;
  });

  document.getElementById('saveBtn').addEventListener('click', () => {
    socket.emit('save-doc', { docId: currentDocId, filename: currentFilename, content: editor.getValue(), notes: notesEl.value });
  });

  socket.on('doc-saved', () => {
    statusEl.innerText = `✅ Saved ${currentFilename} at ${new Date().toLocaleTimeString()}`;
  });

  socket.on('error-msg', msg => statusEl.innerText = `❌ ${msg}`);

  // Notes toggle
  document.getElementById("notesBtn").addEventListener("click", () => {
    document.getElementById("notesPanel").classList.add("open");
  });
  document.getElementById("closeNotes").addEventListener("click", () => {
    document.getElementById("notesPanel").classList.remove("open");
  });
});
const uploadBtn = document.getElementById("uploadBtn");
const downloadBtn = document.getElementById("downloadBtn");
const fileInput = document.getElementById("fileInput");

// Upload File
uploadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("password", currentPassword);

  const res = await fetch(`/api/docs/${currentDocId}/upload`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (data.ok) {
    statusEl.innerText = `✅ Uploaded ${file.name}`;
    loadFiles();
  } else {
    statusEl.innerText = `❌ Upload failed: ${data.error}`;
  }
});

// Download File
downloadBtn.addEventListener("click", () => {
  if (!currentFilename) return;
  window.open(`/api/docs/${currentDocId}/download/${currentFilename}?password=${currentPassword}`);
});


const themeToggle = document.getElementById('themeToggle');
const root = document.documentElement;

// Load saved preference
if (localStorage.getItem('theme') === 'dark') {
  root.classList.add('dark-mode');
  themeToggle.textContent = '☀️ Light Mode';
}

themeToggle.addEventListener('click', () => {
  root.classList.toggle('dark-mode');
  const isDark = root.classList.contains('dark-mode');
  themeToggle.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

  const hamburger = document.getElementById("hamburger");
  const navLinks = document.querySelector(".nav-links");

  hamburger.addEventListener("click", () => {
    navLinks.classList.toggle("active");
    hamburger.classList.toggle("open");
  });
  const notesBtn = document.getElementById("notesBtn");
  const notesPanel = document.getElementById("notesPanel");
  const closeNotes = document.getElementById("closeNotes");

  notesBtn.addEventListener("click", () => {
    notesPanel.classList.add("open");
  });

  closeNotes.addEventListener("click", () => {
    notesPanel.classList.remove("open");
  });
  const runBtn = document.getElementById("runBtn");
const terminal = document.getElementById("terminal");

runBtn.addEventListener("click", () => {
  if (!currentFilename) return;
  terminal.innerText = "⏳ Running...\n";
  socket.emit("run-code", {
    filename: currentFilename,
    content: editor.getValue(),
  });
});

socket.on("terminal-output", (data) => {
  terminal.innerText += data;
  terminal.scrollTop = terminal.scrollHeight;
});
const goLiveBtn = document.getElementById("goLiveBtn");

goLiveBtn.addEventListener("click", () => {
  if (!currentFilename.endsWith(".html")) {
    statusEl.innerText = "❌ Go Live works only with .html files";
    return;
  }

  socket.emit("go-live", {
    filename: currentFilename,
    content: editor.getValue(),
  });
  statusEl.innerText = `🚀 Live preview launched for ${currentFilename}`;
  window.open(`/live/${currentFilename}`, "_blank");
});

