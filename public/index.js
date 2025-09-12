document.addEventListener('DOMContentLoaded', () => {
  const createBtn = document.getElementById('createBtn');
  const joinBtn = document.getElementById('joinBtn');
  const statusEl = document.getElementById('status');

  // Create Room
  createBtn.addEventListener('click', async () => {
    const docId = document.getElementById('createDocId').value.trim();
    const password = document.getElementById('createPassword').value.trim();
    if (!docId || !password) return statusEl.innerText = "Room ID and Password required";

    try {
      const res = await fetch('/api/docs/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId, password }),
      });
      const data = await res.json();
      if (res.ok) window.location.href = `/editor.html?id=${docId}&pw=${encodeURIComponent(password)}`;
      else statusEl.innerText = data.error || "Error creating room";
    } catch (err) {
      console.error(err);
      statusEl.innerText = "Server error while creating room";
    }
  });

  // Join Room
  joinBtn.addEventListener('click', () => {
    const docId = document.getElementById('joinDocId').value.trim();
    const password = document.getElementById('joinPassword').value.trim();
    if (!docId || !password) return statusEl.innerText = "Room ID and Password required";

    window.location.href = `/editor.html?id=${docId}&pw=${encodeURIComponent(password)}`;
  });
});
