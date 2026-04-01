const DEFAULT_AUTH_MESSAGE = "Use your email and password to restore uploads, summaries, and previous conversations.";
const state = { user: null, documents: [], currentDocumentId: null, currentDocument: null, conversations: [] };
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const fmt = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? "" : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); };

function setStatus(message, tone = "") {
    $("chatStatusMessage").textContent = message;
    $("chatStatusMessage").className = "chat-status-message";
    if (tone) $("chatStatusMessage").classList.add(`is-${tone}`);
}

function openAuth(message = DEFAULT_AUTH_MESSAGE) {
    $("authMessage").textContent = message;
    $("authModal").hidden = false;
}

function closeAuth() {
    $("authModal").hidden = true;
}

function ensureAuth(message) {
    if (state.user) return true;
    openAuth(message);
    setStatus(message, "error");
    return false;
}

function orderedConversations(items) {
    return [...(items || [])].sort((left, right) => new Date(left.created_at) - new Date(right.created_at));
}

function setComposerEnabled(enabled) {
    $("chatQuestion").disabled = !enabled;
    $("chatSendButton").disabled = !enabled;
}

function updateAuthUI() {
    const loggedIn = Boolean(state.user);
    $("openAuthButton").hidden = loggedIn;
    $("headerCreateAccountButton").hidden = loggedIn;
    $("userMenu").hidden = !loggedIn;
    if (!loggedIn) {
        setComposerEnabled(false);
        return;
    }
    $("userAvatar").textContent = ((state.user.full_name || state.user.email || "L").trim().charAt(0) || "L").toUpperCase();
    $("userName").textContent = state.user.full_name || "Legal user";
    $("userEmail").textContent = state.user.email || "";
}

function renderDocumentList(docs) {
    const empty = `<div class="chat-sidebar-empty"><p>No documents yet.</p><span>Upload a PDF on the home page to start a saved chat workspace.</span></div>`;
    if (!Array.isArray(docs) || !docs.length) {
        $("chatDocumentList").innerHTML = empty;
        return;
    }

    $("chatDocumentList").innerHTML = docs.map((doc) => `<button type="button" class="chat-document-item ${doc.id === state.currentDocumentId ? "active" : ""}" data-doc="${doc.id}"><strong>${esc(doc.original_filename)}</strong><span>${esc(doc.summary_elevator || "Saved legal brief ready for follow-up questions.")}</span><div class="chat-document-meta"><span>${esc(fmt(doc.created_at) || "Recently saved")}</span><span>${esc(doc.conversation_count || 0)} messages</span></div></button>`).join("");
    document.querySelectorAll("[data-doc]").forEach((button) => button.addEventListener("click", () => loadDocument(Number(button.dataset.doc))));
}

function renderSummaryCard(doc) {
    if (!doc) {
        $("chatSummaryCard").innerHTML = `<div class="chat-summary-empty"><p>No document selected.</p><span>Pick a saved document to load its brief, then continue the conversation below.</span></div>`;
        return;
    }

    const summary = doc.summary || {};
    const bullets = Array.isArray(summary.summary_bullets) ? summary.summary_bullets : [];
    const nextSteps = Array.isArray(summary.next_steps) ? summary.next_steps : [];
    $("chatSummaryCard").innerHTML = `<div class="chat-summary-top"><div><p class="panel-kicker">Current document</p><h3>${esc(doc.original_filename)}</h3><span class="chat-summary-date">Saved ${esc(fmt(doc.created_at) || "recently")}</span></div><div class="chat-summary-metric"><span>Confidence</span><strong>${esc(summary.confidence ?? 0)}%</strong></div></div><p class="chat-summary-copy">${esc(summary.summary_elevator || "A saved summary is available for this document.")}</p><div class="chat-summary-grid"><section class="chat-summary-section"><h4>Key points</h4>${bullets.length ? `<ul>${bullets.slice(0, 4).map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : `<p>No key points saved yet.</p>`}</section><section class="chat-summary-section"><h4>Next steps</h4>${nextSteps.length ? `<ul>${nextSteps.slice(0, 4).map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : `<p>No next steps saved yet.</p>`}</section></div>`;
}

function renderThread(items) {
    const conversations = orderedConversations(items);
    state.conversations = conversations;

    if (!conversations.length) {
        $("messageThread").innerHTML = `<div class="thread-empty"><p>No follow-up questions yet.</p><span>Ask about payment terms, obligations, risks, missing clauses, or negotiation points to start this thread.</span></div>`;
        return;
    }

    $("messageThread").innerHTML = conversations.map((item) => `<article class="message-pair"><div class="message-row user"><div class="message-bubble user"><span class="message-role">You</span><p>${esc(item.question)}</p></div></div><div class="message-row assistant"><div class="message-bubble assistant"><span class="message-role">LexiAI</span><p>${esc(item.answer)}</p><span class="message-time">${esc(fmt(item.created_at) || "")}</span></div></div></article>`).join("");
    $("messageThread").scrollTop = $("messageThread").scrollHeight;
}

function setSelectedDocument(doc) {
    state.currentDocument = doc;
    state.currentDocumentId = doc?.id || null;
    $("chatTitle").textContent = doc ? doc.original_filename : "Select a saved document";
    $("chatSubtitle").textContent = doc ? "Continue the saved conversation, ask new follow-up questions, and download the latest brief from this workspace." : "Open a document from the left to view its summary and previous conversation thread.";
    $("chatDocStatus").textContent = doc ? `Active document: ${doc.original_filename}` : "No document selected";
    $("chatDownloadButton").disabled = !doc;
    setComposerEnabled(Boolean(doc && state.user));
    renderSummaryCard(doc);
    renderDocumentList(state.documents);

    const url = doc ? `/chat?document=${doc.id}` : "/chat";
    window.history.replaceState({}, document.title, url);
}

async function parseJson(response) {
    const text = await response.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        throw new Error("The server returned an unreadable response.");
    }
}

async function api(url, options = {}) {
    const response = await fetch(url, options);
    const data = await parseJson(response);
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
}

function applyAuth(payload) {
    state.user = payload.authenticated ? payload.user : null;
    state.currentDocumentId = payload.current_document_id || null;
    updateAuthUI();
}

function queryDocumentId() {
    const params = new URLSearchParams(window.location.search);
    const value = Number(params.get("document"));
    return Number.isFinite(value) && value > 0 ? value : null;
}

async function loadDocument(id, preserveStatus = false) {
    if (!ensureAuth("Sign in to restore your saved chat workspace.")) return;

    try {
        const data = await api(`/auth/documents/${id}`);
        setSelectedDocument(data.document);
        renderThread(data.conversations || []);
        if (!preserveStatus) setStatus(`Loaded ${data.document.original_filename}.`, "success");
    } catch (error) {
        setStatus(error.message, "error");
    }
}

async function refreshHistory(preferredDocumentId = null) {
    if (!state.user) {
        renderDocumentList([]);
        renderThread([]);
        setSelectedDocument(null);
        return;
    }

    const data = await api("/auth/history");
    state.documents = data.documents || [];
    renderDocumentList(state.documents);

    const selectedId = preferredDocumentId || queryDocumentId() || state.currentDocumentId || state.documents[0]?.id || null;
    if (selectedId) await loadDocument(selectedId, true);
    else {
        setSelectedDocument(null);
        renderThread([]);
    }
}

async function fetchAuthState() {
    try {
        applyAuth(await api("/auth/me"));
        if (state.user) {
            await refreshHistory();
            setStatus(state.currentDocumentId ? "Your saved chat workspace is ready." : "Choose a saved document to continue the conversation.", "success");
        } else {
            renderDocumentList([]);
            renderThread([]);
            setSelectedDocument(null);
            setStatus("Sign in to restore your saved documents and previous conversations.", "error");
        }
    } catch (error) {
        setStatus(error.message, "error");
    }
}

async function authSubmit(url, body, okMessage) {
    applyAuth(await api(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    }));
    closeAuth();
    setStatus(okMessage, "success");
    await refreshHistory(queryDocumentId());
}

async function askQuestion() {
    if (!ensureAuth("Sign in to save and continue document conversations.")) return;
    if (!state.currentDocumentId) {
        setStatus("Select a saved document before asking a follow-up question.", "error");
        return;
    }

    const question = $("chatQuestion").value.trim();
    if (!question) {
        setStatus("Type a follow-up question before sending it.", "error");
        $("chatQuestion").focus();
        return;
    }

    $("chatSendButton").disabled = true;
    setStatus("Searching your saved document for the most relevant answer...", "loading");

    try {
        await api("/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question, document_id: state.currentDocumentId }),
        });
        $("chatQuestion").value = "";
        await loadDocument(state.currentDocumentId, true);
        setStatus("Answer saved to your chat history.", "success");
    } catch (error) {
        setStatus(error.message, "error");
    } finally {
        $("chatSendButton").disabled = false;
    }
}

async function downloadPDF() {
    if (!ensureAuth("Sign in to download saved summaries.")) return;
    if (!state.currentDocumentId) {
        setStatus("Select a document before downloading the summary.", "error");
        return;
    }

    $("chatDownloadButton").disabled = true;
    setStatus("Preparing your PDF summary...", "loading");

    try {
        const response = await fetch(`/download?document_id=${state.currentDocumentId}`);
        if (!response.ok) throw new Error((await parseJson(response)).error || "Could not prepare the download.");
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "summary.pdf";
        link.click();
        window.URL.revokeObjectURL(url);
        setStatus("Your PDF summary has started downloading.", "success");
    } catch (error) {
        setStatus(error.message, "error");
    } finally {
        $("chatDownloadButton").disabled = false;
    }
}

function init() {
    $("openAuthButton").addEventListener("click", () => openAuth());
    $("headerCreateAccountButton").addEventListener("click", () => openAuth("Create an account to save uploads, summaries, and previous conversations."));
    document.querySelectorAll("[data-close-auth]").forEach((element) => element.addEventListener("click", closeAuth));
    $("chatComposer").addEventListener("submit", async (event) => { event.preventDefault(); await askQuestion(); });
    $("chatQuestion").addEventListener("keydown", (event) => {
        if (event.key === "Enter" && event.ctrlKey) {
            event.preventDefault();
            askQuestion();
        }
    });
    $("chatDownloadButton").addEventListener("click", downloadPDF);
    $("loginForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
            await authSubmit("/auth/login", { email: $("loginEmail").value.trim(), password: $("loginPassword").value }, "Signed in successfully. Your saved chat workspace is ready.");
        } catch (error) {
            $("authMessage").textContent = error.message;
            setStatus(error.message, "error");
        }
    });
    $("registerForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
            await authSubmit("/auth/register", { full_name: $("registerName").value.trim(), email: $("registerEmail").value.trim(), password: $("registerPassword").value }, "Account created. Your saved chat workspace is ready.");
        } catch (error) {
            $("authMessage").textContent = error.message;
            setStatus(error.message, "error");
        }
    });
    $("logoutButton").addEventListener("click", async () => {
        try {
            applyAuth(await api("/auth/logout", { method: "POST" }));
            state.documents = [];
            setSelectedDocument(null);
            renderDocumentList([]);
            renderThread([]);
            setStatus("Signed out successfully.", "success");
        } catch (error) {
            setStatus(error.message, "error");
        }
    });
    setComposerEnabled(false);
    fetchAuthState();
}

document.addEventListener("DOMContentLoaded", init);
