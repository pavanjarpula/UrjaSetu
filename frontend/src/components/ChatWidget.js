import React, { useState, useRef, useEffect, useCallback } from "react";
import { sendChatMessage } from "../api/client";

const MAX_SESSIONS = 10;

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState(() => {
    try { return JSON.parse(localStorage.getItem("chat_sessions") || "[]"); } catch { return []; }
  });
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEnd = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const saveSessions = useCallback((newSessions) => {
    setSessions(newSessions);
    localStorage.setItem("chat_sessions", JSON.stringify(newSessions));
  }, []);

  const createNewSession = () => {
    const id = `session-${Date.now()}`;
    const newSession = { id, title: "New conversation", created: Date.now(), messages: [] };
    const updated = [newSession, ...sessions].slice(0, MAX_SESSIONS);
    saveSessions(updated);
    setActiveSession(id);
    setMessages([]);
  };

  const switchSession = (id) => {
    setActiveSession(id);
    const session = sessions.find(s => s.id === id);
    setMessages(session?.messages || []);
  };

  const deleteSession = (id, e) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== id);
    saveSessions(updated);
    if (activeSession === id) {
      setActiveSession(updated[0]?.id || null);
      setMessages(updated[0]?.messages || []);
    }
  };

  useEffect(() => {
    if (sessions.length === 0 && !activeSession) {
      createNewSession();
    }
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg, ts: Date.now() }]);
    setLoading(true);

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const data = await sendChatMessage(userMsg, activeSession, history);
      const assistantMsg = { role: "assistant", content: data.answer, citations: data.citations || [], ts: Date.now() };
      setMessages((prev) => [...prev, assistantMsg]);

      // Update session in storage
      const updatedSessions = sessions.map(s => {
        if (s.id === activeSession) {
          const allMessages = [...(s.messages || []), { role: "user", content: userMsg }, assistantMsg];
          return {
            ...s,
            messages: allMessages,
            title: s.messages?.length === 0 ? userMsg.substring(0, 40) : s.title,
          };
        }
        return s;
      });
      saveSessions(updatedSessions);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err.message}`, citations: [], ts: Date.now() }]);
    } finally { setLoading(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (!open) {
    return (
      <button className="chat-fab" onClick={() => setOpen(true)} title="Open AI Assistant">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
    );
  }

  return (
    <div className="chat-panel">
      <div className="chat-panel-header">
        <div className="chat-panel-title">
          <div className="chat-panel-title-dot" />
          Urjasetu AI
        </div>
        <div className="chat-panel-actions">
          <button className="btn btn-ghost btn-sm" onClick={createNewSession} title="New chat">+ New</button>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      {sessions.length > 1 && (
        <div className="chat-sessions-bar">
          {sessions.map(s => (
            <button key={s.id} className={`chat-session-btn ${activeSession === s.id ? "active" : ""}`}
              onClick={() => switchSession(s.id)} title={s.title}>
              {s.title?.substring(0, 20)}{s.title?.length > 20 ? "..." : ""}
              {activeSession === s.id && sessions.length > 1 && (
                <span onClick={(e) => deleteSession(s.id, e)} style={{ marginLeft: 4, cursor: "pointer" }}>×</span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-state" style={{ padding: "2rem 1rem" }}>
            <div className="empty-state-icon">⚡</div>
            <div className="empty-state-title">Ask Urjasetu</div>
            <div className="empty-state-desc">
              Solar forecasting, ice TES sizing, policy analysis, IIT Kharagpur data.
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
            <div className="chat-msg-avatar">{msg.role === "user" ? "👤" : "⚡"}</div>
            <div>
              <div className="chat-msg-bubble" style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
              {msg.citations?.length > 0 && (
                <div className="chat-citations">
                  {msg.citations.map((c, j) => <span key={j} className="chat-citation">{c}</span>)}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="chat-msg chat-msg-assistant">
            <div className="chat-msg-avatar">⚡</div>
            <div className="chat-msg-bubble" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="spinner spinner-sm" />
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEnd} />
      </div>

      <div className="chat-input-bar">
        <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown} placeholder="Ask about solar, TES, policy..."
          disabled={loading} autoComplete="off" />
        <button className="chat-send-btn" onClick={handleSend} disabled={loading || !input.trim()}>
          {loading ? <div className="spinner spinner-sm" /> : "↑"}
        </button>
      </div>
    </div>
  );
}
