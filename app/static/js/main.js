const DEFAULT_FILE_TEXT = "Attach a PDF to analyze";
const DEFAULT_STATUS = "Upload a legal PDF to generate a structured summary and unlock follow-up Q&A.";
const DEFAULT_ANSWER = "Ask a question after analyzing a PDF to get a document-grounded answer here.";
const DEFAULT_AUTH_MESSAGE = "Use your email and password to save uploads, summaries, and previous conversations.";
const state = { user: null, currentDocumentId: null, documents: [] };
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const fmt = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? "" : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); };

function setStatus(message, tone = "") { $("statusMessage").textContent = message; $("statusMessage").className = "status-message"; if (tone) $("statusMessage").classList.add(`is-${tone}`); }
function setAnswer(message, isEmpty = false) { $("answer").textContent = message; $("answer").classList.toggle("answer-empty", isEmpty); }
function setSummaryHeader(title = "Summary dashboard", subtitle = "Your latest uploaded brief will appear here.") { $("summaryTitle").textContent = title; $("summarySubtitle").textContent = subtitle; }
function setFileLabel() { const file = $("fileInput").files[0]; $("fileName").textContent = file ? file.name : DEFAULT_FILE_TEXT; }
function setUploadBusy(busy) { $("uploadButton").disabled = busy; $("uploadButton").textContent = busy ? "Analyzing..." : "Upload & Analyze"; }
function updateChatLink() {
    const href = state.currentDocumentId ? `/chat?document=${state.currentDocumentId}` : "/chat";
    $("openChatButton").href = href;
    $("chatLaunchButton").href = href;
}
function openAuth(message = DEFAULT_AUTH_MESSAGE) { $("authMessage").textContent = message; $("authModal").hidden = false; }
function closeAuth() { $("authModal").hidden = true; }
function ensureAuth(message) { if (state.user) return true; openAuth(message); setStatus(message, "error"); return false; }

function list(items, empty) { return Array.isArray(items) && items.length ? `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : `<p class="summary-empty">${esc(empty)}</p>`; }
function renderEmptySummary(message, detail) { setSummaryHeader(); $("summary").innerHTML = `<div class="empty-card"><p>${esc(message)}</p><span>${esc(detail)}</span></div>`; }
function renderSummary(summary, doc = null) {
    if (!summary || typeof summary !== "object") return renderEmptySummary("No summary available.", "Upload a document to see the structured brief.");
    const missing = Array.isArray(summary.missing_info) ? summary.missing_info : [];
    const next = Array.isArray(summary.next_steps) ? summary.next_steps : [];
    setSummaryHeader(doc?.original_filename || "Summary dashboard", doc ? `Saved ${fmt(doc.created_at) || "recently"}` : "Your latest uploaded brief will appear here.");
    $("summary").innerHTML = `<div class="summary-overview"><div class="metric-card"><span class="metric-label">Confidence</span><strong class="metric-value">${esc(summary.confidence ?? 0)}%</strong></div><div class="metric-card"><span class="metric-label">Missing items</span><strong class="metric-value">${missing.length}</strong></div><div class="metric-card"><span class="metric-label">Next steps</span><strong class="metric-value">${next.length}</strong></div></div><div class="summary-grid"><section class="summary-card"><h4>Elevator Summary</h4><p>${esc(summary.summary_elevator || "No summary available.")}</p></section><section class="summary-card"><h4>Key Points</h4>${list(summary.summary_bullets, "No key points were returned.")}</section><section class="summary-card"><h4>Missing Information</h4>${list(missing, "No missing information was identified.")}</section><section class="summary-card"><h4>Next Steps</h4>${list(next, "No recommended next steps were returned.")}</section></div>`;
}
function renderDocs(docs) {
    const empty = `<div class="history-empty"><p>No saved documents yet.</p><span>Sign in and upload a file to build your personal library.</span></div>`;
    if (!Array.isArray(docs) || !docs.length) return $("documentHistory").innerHTML = empty;
    $("documentHistory").innerHTML = docs.slice(0, 4).map((doc) => `<button type="button" class="history-item ${doc.id === state.currentDocumentId ? "active" : ""}" data-doc="${doc.id}"><strong>${esc(doc.original_filename)}</strong><span>${esc(doc.summary_elevator || "A saved legal brief is available for this document.")}</span><div class="history-meta"><span>${esc(fmt(doc.created_at) || "Recently saved")}</span><span>${esc(doc.confidence ?? 0)}% confidence</span></div></button>`).join("");
    document.querySelectorAll("[data-doc]").forEach((button) => button.addEventListener("click", () => loadDocument(Number(button.dataset.doc))));
}
function renderConversations(items) {
    const empty = `<div class="history-empty"><p>No conversations yet.</p><span>Ask follow-up questions after a document is analyzed.</span></div>`;
    if (!Array.isArray(items) || !items.length) return $("conversationHistory").innerHTML = empty;
    $("conversationHistory").innerHTML = items.slice(0, 3).map((item) => `<a class="history-item" href="/chat?document=${esc(item.document_id)}"><strong>${esc(item.question)}</strong><span>${esc(item.answer)}</span><div class="history-meta"><span>${esc(item.document_name || "Saved document")}</span><span>${esc(fmt(item.created_at) || "")}</span></div></a>`).join("");
}
function updateAuthUI() {
    const loggedIn = Boolean(state.user);
    $("openAuthButton").hidden = loggedIn;
    $("headerCreateAccountButton").hidden = loggedIn;
    $("userMenu").hidden = !loggedIn;
    $("heroAuthButton").textContent = loggedIn ? "Open Workspace" : "Create Account";
    if (!loggedIn) return;
    $("userAvatar").textContent = ((state.user.full_name || state.user.email || "L").trim().charAt(0) || "L").toUpperCase();
    $("userName").textContent = state.user.full_name || "Legal user";
    $("userEmail").textContent = state.user.email || "";
}

async function parseJson(response) { const text = await response.text(); if (!text) return {}; try { return JSON.parse(text); } catch { throw new Error("The server returned an unreadable response."); } }
async function api(url, options = {}) { const response = await fetch(url, options); const data = await parseJson(response); if (!response.ok) throw new Error(data.error || "Request failed."); return data; }
function applyAuth(payload) { state.user = payload.authenticated ? payload.user : null; state.currentDocumentId = payload.current_document_id || null; updateAuthUI(); updateChatLink(); }

async function refreshHistory(loadCurrent = false) {
    if (!state.user) return renderDocs([]), renderConversations([]);
    const data = await api("/auth/history");
    state.documents = data.documents || [];
    if (!state.currentDocumentId && data.current_document_id) state.currentDocumentId = data.current_document_id;
    renderDocs(state.documents);
    renderConversations(data.conversations || []);
    const target = loadCurrent ? (state.currentDocumentId || state.documents[0]?.id) : null;
    if (target) await loadDocument(target, true);
}
async function loadDocument(id, preserveStatus = false) {
    if (!ensureAuth("Sign in to restore saved documents and conversations.")) return;
    try {
        const data = await api(`/auth/documents/${id}`);
        state.currentDocumentId = data.document.id;
        renderSummary(data.document.summary, data.document);
        renderConversations(data.conversations || []);
        renderDocs(state.documents);
        setAnswer(data.conversations?.[0]?.answer || DEFAULT_ANSWER, !data.conversations?.length);
        $("downloadButton").disabled = false;
        updateChatLink();
        if (!preserveStatus) setStatus(`Loaded ${data.document.original_filename}.`, "success");
    } catch (error) { setStatus(error.message, "error"); }
}
async function fetchAuthState() { try { applyAuth(await api("/auth/me")); if (state.user) await refreshHistory(true); else renderDocs([]), renderConversations([]); } catch (error) { setStatus(error.message, "error"); } }
async function authSubmit(url, body, okMessage) { applyAuth(await api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })); closeAuth(); setStatus(okMessage, "success"); await refreshHistory(true); }

async function uploadPDF() {
    if (!ensureAuth("Sign in to upload files and save them to your account.")) return;
    const file = $("fileInput").files[0];
    if (!file) return setStatus("Select a PDF file before starting the analysis.", "error"), $("fileInput").focus();
    const formData = new FormData(); formData.append("file", file);
    setUploadBusy(true); setStatus("Analyzing document and generating your structured brief...", "loading"); renderEmptySummary("Working on your upload...", "This usually takes a few seconds depending on document length.");
    try {
        const response = await fetch("/upload", { method: "POST", body: formData });
        const data = await parseJson(response);
        if (!response.ok || data.error) throw new Error(data.error || "Upload failed.");
        state.currentDocumentId = data.document.id;
        renderSummary(data.summary, data.document); renderConversations([]); setAnswer(DEFAULT_ANSWER, true); $("downloadButton").disabled = false; updateChatLink();
        setStatus("Summary ready. Your file and future Q&A are now saved to your account.", "success");
        await refreshHistory(false); $("results").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
        renderEmptySummary("Upload failed.", error.message); $("downloadButton").disabled = true; setStatus(error.message, "error");
    } finally { setUploadBusy(false); }
}

async function askQuestion() {
    if (!ensureAuth("Sign in to save conversations and ask follow-up questions.")) return;
    const question = $("question").value.trim();
    if (!question) return setStatus("Type a follow-up question before asking the assistant.", "error"), $("question").focus();
    if (!state.currentDocumentId) return setStatus("Upload or select a saved document before asking a question.", "error");
    $("askButton").disabled = true; setAnswer("Thinking through the uploaded document..."); setStatus("Searching the uploaded document for a grounded answer...", "loading");
    try {
        const data = await api("/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, document_id: state.currentDocumentId }) });
        setAnswer(data.answer || "No answer returned."); $("question").value = ""; setStatus("Answer ready and saved to your conversation history.", "success");
        await refreshHistory(false); await loadDocument(state.currentDocumentId, true);
    } catch (error) { setAnswer(error.message); setStatus(error.message, "error"); }
    finally { $("askButton").disabled = false; }
}

async function downloadPDF() {
    if (!ensureAuth("Sign in to download saved summaries.")) return;
    if (!state.currentDocumentId) return setStatus("Select a saved document or upload one before downloading the summary.", "error");
    $("downloadButton").disabled = true; setStatus("Preparing the PDF summary for download...", "loading");
    try {
        const response = await fetch(`/download?document_id=${state.currentDocumentId}`);
        if (!response.ok) throw new Error((await parseJson(response)).error || "Could not prepare the download.");
        const blob = await response.blob(); const url = window.URL.createObjectURL(blob); const link = document.createElement("a");
        link.href = url; link.download = "summary.pdf"; link.click(); window.URL.revokeObjectURL(url); setStatus("Your PDF summary has started downloading.", "success");
    } catch (error) { setStatus(error.message, "error"); }
    finally { $("downloadButton").disabled = false; }
}

function init() {
    $("fileInput").addEventListener("change", setFileLabel);
    $("openAuthButton").addEventListener("click", () => openAuth());
    $("headerCreateAccountButton").addEventListener("click", () => openAuth("Create an account to save uploads, summaries, and previous conversations."));
    $("heroAuthButton").addEventListener("click", () => state.user ? $("workspace").scrollIntoView({ behavior: "smooth", block: "start" }) : openAuth("Create an account to save uploads and previous conversations."));
    document.querySelectorAll("[data-close-auth]").forEach((el) => el.addEventListener("click", closeAuth));
    document.querySelectorAll(".prompt-chip").forEach((chip) => chip.addEventListener("click", () => { $("question").value = chip.dataset.prompt || ""; $("question").focus(); }));
    $("question").addEventListener("keydown", (event) => { if (event.key === "Enter" && event.ctrlKey) { event.preventDefault(); askQuestion(); } });
    $("loginForm").addEventListener("submit", async (event) => { event.preventDefault(); try { await authSubmit("/auth/login", { email: $("loginEmail").value.trim(), password: $("loginPassword").value }, "Signed in successfully. Your saved workspace is ready."); } catch (error) { $("authMessage").textContent = error.message; setStatus(error.message, "error"); } });
    $("registerForm").addEventListener("submit", async (event) => { event.preventDefault(); try { await authSubmit("/auth/register", { full_name: $("registerName").value.trim(), email: $("registerEmail").value.trim(), password: $("registerPassword").value }, "Account created. Your uploads and conversations will now be saved."); } catch (error) { $("authMessage").textContent = error.message; setStatus(error.message, "error"); } });
    $("logoutButton").addEventListener("click", async () => { try { applyAuth(await api("/auth/logout", { method: "POST" })); renderDocs([]); renderConversations([]); renderEmptySummary("No summary yet.", "Your uploaded document will appear here as a structured legal brief."); setAnswer(DEFAULT_ANSWER, true); $("downloadButton").disabled = true; updateChatLink(); setStatus("Signed out successfully.", "success"); } catch (error) { setStatus(error.message, "error"); } });
    renderEmptySummary("No summary yet.", "Your uploaded document will appear here as a structured legal brief.");
    renderDocs([]); renderConversations([]); setAnswer(DEFAULT_ANSWER, true); updateChatLink(); setStatus(DEFAULT_STATUS); fetchAuthState();
}

document.addEventListener("DOMContentLoaded", init);
