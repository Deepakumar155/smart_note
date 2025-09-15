const socket = io();
let editor, currentDocId, currentPassword, currentFilename, suppressChange = false;
let currentTheme = "dracula"; // Default dark theme

window.addEventListener("load", () => {
  editor = CodeMirror.fromTextArea(document.getElementById("code"), {
    lineNumbers: true,
    mode: "javascript",
    theme: currentTheme,
  });
  editor.setSize("100%", "80%");

  const statusEl = document.getElementById("status");
  const notesEl = document.getElementById("notes");
  const fileList = document.getElementById("fileList");
  const addFileBtn = document.getElementById("addFileBtn");
  const newFileName = document.getElementById("newFileName");

  const params = new URLSearchParams(window.location.search);
  currentDocId = params.get("id");
  currentPassword = params.get("pw");
  currentFilename = params.get("file") || "main.js";

  if (currentDocId && currentPassword) {
    socket.emit("join-doc", {
      docId: currentDocId,
      password: currentPassword,
      filename: currentFilename,
    });
    statusEl.innerText = `🔗 Joined ${currentDocId}/${currentFilename}`;
  }

  // --- File Handling ---
  async function loadFiles() {
    const res = await fetch(`/api/docs/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docId: currentDocId, password: currentPassword }),
    });
    const data = await res.json();
    if (data.ok) {
      fileList.innerHTML = "";
      data.files.forEach((f) => {
        const li = document.createElement("li");
        li.textContent = f;
        li.onclick = () => switchFile(f);
        if (f === currentFilename) li.style.fontWeight = "bold";
        fileList.appendChild(li);
      });
    }
  }

  async function addFile() {
    const filename = newFileName.value.trim();
    if (!filename) return;
    await fetch(`/api/docs/${currentDocId}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename }),
    });
    newFileName.value = "";
    loadFiles();
  }

  async function switchFile(filename) {
    currentFilename = filename;
    socket.emit("join-doc", {
      docId: currentDocId,
      password: currentPassword,
      filename,
    });
    statusEl.innerText = `🔗 Switched to ${filename}`;
    loadFiles();
  }

  addFileBtn.addEventListener("click", addFile);
  loadFiles();

  // --- Socket Events ---
  socket.on("doc-load", ({ content, notes, filename }) => {
    suppressChange = true;
    editor.setValue(content || "");
    suppressChange = false;
    notesEl.value = notes || "";
    currentFilename = filename;
    loadFiles();
  });

  editor.on("change", (instance, changeObj) => {
    if (!currentDocId || !currentFilename || suppressChange) return;
    socket.emit("content-change", {
      docId: currentDocId,
      filename: currentFilename,
      ...changeObj,
    });
  });

  socket.on("remote-content-change", ({ from, to, text, origin }) => {
    suppressChange = true;
    editor.replaceRange(text, from, to, origin);
    suppressChange = false;
  });

  notesEl.addEventListener("input", () => {
    if (!currentFilename) return;
    socket.emit("notes-change", {
      docId: currentDocId,
      filename: currentFilename,
      notes: notesEl.value,
    });
  });

  socket.on("remote-notes-change", ({ notes }) => {
    if (notes !== notesEl.value) notesEl.value = notes;
  });

  document.getElementById("saveBtn").addEventListener("click", () => {
    socket.emit("save-doc", {
      docId: currentDocId,
      filename: currentFilename,
      content: editor.getValue(),
      notes: notesEl.value,
    });
  });

  socket.on("doc-saved", () => {
    statusEl.innerText = `✅ Saved ${currentFilename} at ${new Date().toLocaleTimeString()}`;
  });

  socket.on("error-msg", (msg) => (statusEl.innerText = `❌ ${msg}`));

  // Notes toggle
  const notesBtn = document.getElementById("notesBtn");
  const notesPanel = document.getElementById("notesPanel");
  const closeNotes = document.getElementById("closeNotes");

  notesBtn.addEventListener("click", () => {
    notesPanel.classList.add("open");
  });

  closeNotes.addEventListener("click", () => {
    notesPanel.classList.remove("open");
  });
});

// --- Upload & Download ---
const uploadBtn = document.getElementById("uploadBtn");
const downloadBtn = document.getElementById("downloadBtn");
const fileInput = document.getElementById("fileInput");

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

downloadBtn.addEventListener("click", () => {
  if (!currentFilename) return;
  window.open(
    `/api/docs/${currentDocId}/download/${currentFilename}?password=${currentPassword}`
  );
});

// --- Theme Toggle ---
const themeToggle = document.getElementById("themeToggle");
themeToggle.addEventListener("click", () => {
  if (currentTheme === "dracula") {
    currentTheme = "eclipse"; // white theme
    themeToggle.textContent = "🌙 Dark Mode";
  } else {
    currentTheme = "dracula"; // dark theme
    themeToggle.textContent = "☀️ Light Mode";
  }
  editor.setOption("theme", currentTheme);
});

// --- Terminal Online Compiler with Piston API ---
const runBtn = document.getElementById("runBtn");
const terminal = document.getElementById("terminal");
const terminalPanel = document.querySelector(".terminal-panel");
const closeTerminal = document.getElementById("closeTerminal");

runBtn.addEventListener("click", async () => {
  if (!currentFilename) return;
  terminalPanel.style.transform = "translateY(0)";

  let language = "javascript";
  if (currentFilename.endsWith(".py")) language = "python";
  if (currentFilename.endsWith(".java")) language = "java";

  try {
    const res = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language,
        version: "*",
        files: [{ name: currentFilename, content: editor.getValue() }],
      }),
    });

    const data = await res.json();
    terminal.innerText += data.run.stdout || "";
    if (data.run.stderr) terminal.innerText += "\n⚠️ " + data.run.stderr;
  } catch (err) {
    terminal.innerText += "\n❌ Error: " + err.message;
  }
});

closeTerminal.addEventListener("click", () => {
  terminalPanel.style.transform = "translateY(100%)";
});

// --- Go Live ---
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
