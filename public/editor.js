const socket = io();
let editor = null;
let currentDocId = null;

function debounce(fn, t) {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), t);
  };
}

window.addEventListener('load', () => {
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

  function joinDoc(docId) {
    if (!docId) return;
    currentDocId = docId;
    socket.emit('join-doc', { docId });
    statusEl.innerText = `Joined document: ${docId}`;
  }

  socket.on('doc-load', ({ content, notes }) => {
    editor.setValue(content || '');
    notesEl.value = notes || '';
  });

  socket.on('remote-content-change', ({ content }) => {
    if (content !== editor.getValue()) {
      const cursor = editor.getCursor();
      editor.setValue(content);
      editor.setCursor(cursor);
    }
  });

  socket.on('remote-notes-change', ({ notes }) => {
    if (notes !== notesEl.value) notesEl.value = notes;
  });

  socket.on('doc-saved', () => {
    statusEl.innerText = `Document ${currentDocId} saved at ${new Date().toLocaleTimeString()}`;
  });

  editor.on('change', debounce(() => {
    if (!currentDocId) return;
    socket.emit('content-change', { docId: currentDocId, content: editor.getValue() });
    autoSave();
  }, 500));

  notesEl.addEventListener('input', debounce(() => {
    if (!currentDocId) return;
    socket.emit('notes-change', { docId: currentDocId, notes: notesEl.value });
    autoSave();
  }, 500));

  function autoSave() {
    if (!currentDocId) return;
    socket.emit('save-doc', { docId: currentDocId, content: editor.getValue(), notes: notesEl.value });
  }

  saveBtn.addEventListener('click', autoSave);

  newDocBtn.addEventListener('click', async () => {
    const customId = prompt('Enter custom Document ID:');
    if (!customId) return;
    try {
      const res = await fetch('/api/docs/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: customId }),
      });
      const doc = await res.json();
      if (res.ok) joinDoc(doc._id);
      else statusEl.innerText = doc.error || 'Error creating document';
    } catch (err) {
      console.error(err);
      statusEl.innerText = 'Error creating document';
    }
  });

  loadDocBtn.addEventListener('click', () => {
    const id = docIdInput.value.trim();
    if (id) joinDoc(id);
  });
});
