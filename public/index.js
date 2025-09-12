document.addEventListener('DOMContentLoaded', () => {
  const createBtn = document.getElementById('createBtn');
  const joinBtn = document.getElementById('joinBtn');
  const statusEl = document.getElementById('status');

  // --- Create Room ---
  createBtn.addEventListener('click', async () => {
    const docId = document.getElementById('createDocId').value.trim();
    const password = document.getElementById('createPassword').value.trim();
    if (!docId || !password) {
      statusEl.innerText = "Room ID and Password required";
      return;
    }

    try {
      const res = await fetch('/api/docs/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId, password }),
      });
      const data = await res.json();

      if (res.ok) {
        // ✅ Redirect to editor only if room created successfully
        window.location.href = `/editor.html?id=${docId}&pw=${encodeURIComponent(password)}`;
      } else {
        statusEl.innerText = data.error || "Error creating room";
      }
    } catch (err) {
      console.error(err);
      statusEl.innerText = "Server error while creating room";
    }
  });

  // --- Join Room ---
  joinBtn.addEventListener('click', async () => {
    const docId = document.getElementById('joinDocId').value.trim();
    const password = document.getElementById('joinPassword').value.trim();
    if (!docId || !password) {
      statusEl.innerText = "Room ID and Password required";
      return;
    }

    try {
      const res = await fetch('/api/docs/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId, password }),
      });
      const data = await res.json();

      if (res.ok) {
        // ✅ Only redirect if credentials are valid
        window.location.href = `/editor.html?id=${docId}&pw=${encodeURIComponent(password)}`;
      } else {
        // ❌ Invalid room/password, do not redirect
        statusEl.innerText = data.error || "Invalid Room ID or Password";
      }
    } catch (err) {
      console.error(err);
      statusEl.innerText = "Server error while joining room";
    }
  });
});
