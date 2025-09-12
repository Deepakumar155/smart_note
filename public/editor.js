const socket = io();
let editor = null;
let currentDocId = null;
let currentPassword = null;
let suppressChange = false;

window.addEventListener('load', () => {
  editor = CodeMirror.fromTextArea(document.getElementById('code'), {
    lineNumbers: true,
    mode: 'javascript',
    theme: 'default',
  });
  editor.setSize('100%', '80%');

  const notesEl = document.getElementById('notes');
  const saveBtn = document.getElementById('saveBtn');
  const statusEl = document.getElementById('status');

  const params = new URLSearchParams(window.location.search);
  const docId = params.get('id');
  const password = params.get('pw');

  if (docId && password) joinDoc(docId, password);

  function joinDoc(docId, password) {
    currentDocId = docId;
    currentPassword = password;
    socket.emit('join-doc', { docId, password });
    statusEl.innerText = `🔗 Joined document: ${docId}`;
  }

  socket.on('doc-load', ({ content, notes }) => {
    suppressChange = true;
    editor.setValue(content || '');
    suppressChange = false;
    notesEl.value = notes || '';
  });

  editor.on('change', (instance, changeObj) => {
    if (!currentDocId || suppressChange) return;
    socket.emit('content-change', {
      docId: currentDocId,
      from: changeObj.from,
      to: changeObj.to,
      text: changeObj.text,
      origin: changeObj.origin,
    });
  });

  socket.on('remote-content-change', ({ from, to, text, origin }) => {
    if (!currentDocId) return;
    suppressChange = true;
    editor.replaceRange(text, from, to, origin);
    suppressChange = false;
  });

  notesEl.addEventListener('input', () => {
    if (!currentDocId) return;
    socket.emit('notes-change', { docId: currentDocId, notes: notesEl.value });
  });

  socket.on('remote-notes-change', ({ notes }) => {
    if (notes !== notesEl.value) notesEl.value = notes;
  });

  function autoSave() {
    if (!currentDocId) return;
    socket.emit('save-doc', { docId: currentDocId, content: editor.getValue(), notes: notesEl.value });
  }

  saveBtn.addEventListener('click', autoSave);

  socket.on('doc-saved', () => {
    statusEl.innerText = `✅ Document ${currentDocId} saved at ${new Date().toLocaleTimeString()}`;
  });

  socket.on('error-msg', (msg) => {
    statusEl.innerText = `❌ ${msg}`;
  });
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
  
