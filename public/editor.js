// === Editor client: handles creation/opening, socket.io collaboration, save ===
const socket = io();
let editor = null;
let currentDocId = null;

// Debounce helper
function debounce(fn, t) {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), t);
  };
}

window.addEventListener('load', () => {
  // --- Initialize CodeMirror ---
  editor = CodeMirror.fromTextArea(document.getElementById('code'), {
    lineNumbers: true,
    mode: 'javascript',
    theme: 'default',
  });
  editor.setSize('100%', '80%');

  const notesEl = document.getElementById('notes');
  const saveBtn = document.getElementById('saveBtn');
  const newDocBtn = document.getElementById('newDocBtn');
  const loadDocBtn = document.getElementById('loadDocBtn');
  const docIdInput = document.getElementById('docIdInput');
  const statusEl = document.getElementById('status');

  // --- Join a document ---
  function joinDoc(docId) {
    if (!docId) return;
    currentDocId = docId;
    socket.emit('join-doc', { docId });
    statusEl.innerText = `Joined document: ${docId}`;
  }

  // --- Socket.io events ---
  socket.on('doc-load', ({ content, notes }) => {
    editor.setValue(content || '');
    notesEl.value = notes || '';
  });

  socket.on('remote-content-change', ({ content }) => {
    if (content !== editor.getValue()) {
      editor.setValue(content);
    }
  });

  socket.on('remote-notes-change', ({ notes }) => {
    if (notes !== notesEl.value) {
      notesEl.value = notes;
    }
  });

  socket.on('doc-saved', () => {
    statusEl.innerText = `Document ${currentDocId} saved at ${new Date().toLocaleTimeString()}`;
  });

  // --- Editor listeners ---
  editor.on(
    'change',
    debounce(() => {
      if (!currentDocId) return;
      const content = editor.getValue();
      socket.emit('content-change', { docId: currentDocId, content });
      autoSave();
    }, 500)
  );

  notesEl.addEventListener(
    'input',
    debounce(() => {
      if (!currentDocId) return;
      const notes = notesEl.value;
      socket.emit('notes-change', { docId: currentDocId, notes });
      autoSave();
    }, 500)
  );

  // --- Save ---
  function autoSave() {
    if (!currentDocId) return;
    socket.emit('save-doc', {
      docId: currentDocId,
      content: editor.getValue(),
      notes: notesEl.value,
    });
  }

  saveBtn.addEventListener('click', autoSave);

  // --- Create new document ---
  newDocBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/docs/new', { method: 'POST' });
      const doc = await res.json();
      joinDoc(doc._id);
    } catch (err) {
      console.error(err);
      statusEl.innerText = 'Error creating document';
    }
  });

  // --- Load document by ID ---
  loadDocBtn.addEventListener('click', () => {
    const id = docIdInput.value.trim();
    if (id) joinDoc(id);
  });
});
