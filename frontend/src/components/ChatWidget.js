import React, { useState, useRef, useEffect, useCallback } from "react";
import { sendChatMessage } from "../api/client";

const MAX_SESSIONS = 20;

export default function ChatWidget({ onClose }) {
  const [sessions, setSessions] = useState(() => {
    try { return JSON.parse(localStorage.getItem("chat_sessions") || "[]"); } catch { return []; }
  });
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEnd = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const saveSessions = useCallback((s) => {
    setSessions(s);
    localStorage.setItem("chat_sessions", JSON.stringify(s));
  }, []);

  const activeSession = sessions.find(s => s.id === activeId);

  const createSession = useCallback(() => {
    const id = `chat-${Date.now()}`;
    const session = { id, title: "New conversation", created: Date.now(), messages: [] };
    const updated = [session, ...sessions].slice(0, MAX_SESSIONS);
    saveSessions(updated);
    setActiveId(id);
    setMessages([]);
  }, [sessions, saveSessions]);

  useEffect(() => {
    if (sessions.length === 0) createSession();
    else if (!activeId && sessions.length > 0) {
      setActiveId(sessions[0].id);
      setMessages(sessions[0].messages || []);
    }
  }, []);

  const switchSession = (id) => {
    setActiveId(id);
    const s = sessions.find(x => x.id === id);
    setMessages(s?.messages || []);
  };

  const deleteSession = (id, e) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== id);
    saveSessions(updated);
    if (activeId === id) {
      const next = updated[0];
      setActiveId(next?.id || null);
      setMessages(next?.messages || []);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    const userEntry = { role: "user", content: userMsg, ts: Date.now() };
    setMessages(prev => [...prev, userEntry]);
    setLoading(true);

    try {
      const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }));
      const data = await sendChatMessage(userMsg, activeId, history);
      const assistantEntry = { role: "assistant", content: data.answer, citations: data.citations || [], ts: Date.now() };
      setMessages(prev => [...prev, assistantEntry]);

      const updatedSessions = sessions.map(s => {
        if (s.id === activeId) {
          const allMsgs = [...(s.messages || []), userEntry, assistantEntry];
          return { ...s, messages: allMsgs, title: (s.messages?.length === 0) ? userMsg.substring(0, 50) : s.title };
        }
        return s;
      });
      saveSessions(updatedSessions);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message}`, citations: [], ts: Date.now() }]);
    } finally { setLoading(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div style={{
      display: "flex", height: "100vh", background: "#000",
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999,
    }}>
      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? 260 : 0, minWidth: sidebarOpen ? 260 : 0,
        background: "#0d0d0d", borderRight: "1px solid #1f1f1f",
        display: "flex", flexDirection: "column", overflow: "hidden",
        transition: "all 0.2s",
      }}>
        <div style={{ padding: "12px", borderBottom: "1px solid #1f1f1f" }}>
          <button onClick={createSession} style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            background: "transparent", border: "1px solid #2a2a2a",
            color: "#ececec", fontSize: 14, display: "flex", alignItems: "center",
            gap: 8, cursor: "pointer", transition: "all 0.15s",
          }}
            onMouseEnter={e => e.target.style.background = "#171717"}
            onMouseLeave={e => e.target.style.background = "transparent"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New chat
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {sessions.map(s => (
            <div key={s.id} onClick={() => switchSession(s.id)} style={{
              padding: "8px 12px", borderRadius: 8, marginBottom: 2,
              background: activeId === s.id ? "#171717" : "transparent",
              border: activeId === s.id ? "1px solid #2a2a2a" : "1px solid transparent",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
              transition: "all 0.15s",
            }}
              onMouseEnter={e => { if (activeId !== s.id) e.currentTarget.style.background = "#1a1a1a"; }}
              onMouseLeave={e => { if (activeId !== s.id) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{
                fontSize: 13, color: activeId === s.id ? "#ececec" : "#a3a3a3",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
              }}>
                {s.title?.substring(0, 35)}{s.title?.length > 35 ? "..." : ""}
              </span>
              {sessions.length > 1 && (
                <button onClick={(e) => deleteSession(s.id, e)} style={{
                  background: "transparent", border: "none", color: "#525252",
                  cursor: "pointer", padding: "2px 4px", fontSize: 14, lineHeight: 1,
                  borderRadius: 4, opacity: 0.6,
                }}
                  onMouseEnter={e => { e.target.style.color = "#ef4444"; e.target.style.opacity = 1; }}
                  onMouseLeave={e => { e.target.style.color = "#525252"; e.target.style.opacity = 0.6; }}
                >×</button>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding: "12px", borderTop: "1px solid #1f1f1f" }}>
          <div style={{ fontSize: 11, color: "#525252", textAlign: "center" }}>Urjasetu AI · v1.0</div>
        </div>
      </div>

      {/* Main chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <div style={{
          height: 48, background: "#0d0d0d", borderBottom: "1px solid #1f1f1f",
          display: "flex", alignItems: "center", padding: "0 16px", gap: 12,
          flexShrink: 0,
        }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
            background: "transparent", border: "none", color: "#a3a3a3",
            cursor: "pointer", padding: 4, display: "flex", borderRadius: 6,
          }}
            onMouseEnter={e => e.currentTarget.style.color = "#ececec"}
            onMouseLeave={e => e.currentTarget.style.color = "#a3a3a3"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#ececec" }}>
              {activeSession?.title?.substring(0, 40) || "New conversation"}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "1px solid #2a2a2a", borderRadius: 6,
            color: "#a3a3a3", cursor: "pointer", padding: "4px 10px", fontSize: 12,
            display: "flex", alignItems: "center", gap: 6,
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#525252"; e.currentTarget.style.color = "#ececec"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = "#a3a3a3"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            Dashboard
          </button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", padding: "80px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>⚡</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: "#ececec", marginBottom: 8 }}>Urjasetu AI</div>
              <div style={{ fontSize: 14, color: "#737373", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
                Solar forecasting, ice TES sizing, policy analysis, and IIT Kharagpur campus data.
                Ask me anything about the platform.
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
                {["What is the P50 forecast?", "How does ice TES sizing work?", "Explain WBSEDCL tariff rates"].map(q => (
                  <button key={q} onClick={() => setInput(q)} style={{
                    padding: "8px 14px", borderRadius: 20, background: "#171717",
                    border: "1px solid #2a2a2a", color: "#a3a3a3", fontSize: 13, cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#f59e0b"; e.currentTarget.style.color = "#ececec"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = "#a3a3a3"; }}
                  >{q}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{
              maxWidth: 800, margin: "0 auto", padding: "16px 24px",
              display: "flex", gap: 12,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: msg.role === "user" ? "#f59e0b" : "#171717",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, color: msg.role === "user" ? "#000" : "#a3a3a3",
                border: msg.role === "assistant" ? "1px solid #2a2a2a" : "none",
              }}>
                {msg.role === "user" ? "👤" : "⚡"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, lineHeight: 1.7, color: "#ececec",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>{msg.content}</div>
                {msg.citations?.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                    {msg.citations.map((c, j) => (
                      <span key={j} style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 12,
                        background: "#171717", color: "#737373", border: "1px solid #1f1f1f",
                      }}>{c}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px 24px", display: "flex", gap: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", background: "#171717",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, border: "1px solid #2a2a2a",
              }}>⚡</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="spinner spinner-sm" />
                <span style={{ fontSize: 14, color: "#737373" }}>Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEnd} />
        </div>

        {/* Input */}
        <div style={{ padding: "16px 24px 24px", maxWidth: 800, margin: "0 auto", width: "100%" }}>
          <div style={{
            display: "flex", gap: 8, alignItems: "flex-end",
            background: "#171717", border: "1px solid #2a2a2a", borderRadius: 12,
            padding: "8px 12px",
          }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown} disabled={loading}
              placeholder="Message Urjasetu..."
              rows={1}
              style={{
                flex: 1, background: "transparent", border: "none", color: "#ececec",
                fontSize: 15, resize: "none", outline: "none", fontFamily: "inherit",
                lineHeight: 1.5, maxHeight: 120, minHeight: 24,
              }}
            />
            <button onClick={handleSend} disabled={loading || !input.trim()} style={{
              width: 36, height: 36, borderRadius: 8,
              background: loading || !input.trim() ? "#2a2a2a" : "#f59e0b",
              color: loading || !input.trim() ? "#525252" : "#000",
              border: "none", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              transition: "all 0.15s", flexShrink: 0,
            }}>
              {loading ? <div className="spinner spinner-sm" /> :
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                </svg>
              }
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#525252", textAlign: "center", marginTop: 8 }}>
            Urjasetu AI can make mistakes. Verify important information.
          </div>
        </div>
      </div>
    </div>
  );
}
