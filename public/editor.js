const socket = io();
let editor = null;
let currentDocId = null;

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

  // Load initial doc
  socket.on('doc-load', ({ content, notes }) => {
    editor.setValue(content || '');
    notesEl.value = notes || '';
  });

  // --- Collaborative editing (CODE) ---
  editor.on('change', (instance, changeObj) => {
    if (!currentDocId) return;

    // Send only the diff
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

    // Apply remote changes without re-triggering loops
    editor.replaceRange(text, from, to, origin);
  });

  // --- Collaborative editing (NOTES) ---
  notesEl.addEventListener('input', () => {
    if (!currentDocId) return;
    socket.emit('notes-change', { docId: currentDocId, notes: notesEl.value });
  });

  socket.on('remote-notes-change', ({ notes }) => {
    if (notes !== notesEl.value) notesEl.value = notes;
  });

  // --- Save logic ---
  function autoSave() {
    if (!currentDocId) return;
    socket.emit('save-doc', { docId: currentDocId, content: editor.getValue(), notes: notesEl.value });
  }

  saveBtn.addEventListener('click', autoSave);

  socket.on('doc-saved', () => {
    statusEl.innerText = `Document ${currentDocId} saved at ${new Date().toLocaleTimeString()}`;
  });

  // --- Create / load doc ---
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
