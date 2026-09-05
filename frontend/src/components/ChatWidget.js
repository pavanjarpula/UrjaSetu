import React, { useState, useRef, useEffect } from "react";
import { sendChatMessage, getChatHistory } from "../api/client";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const messagesEnd = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const data = await sendChatMessage(userMsg, sessionId);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          citations: data.citations || [],
          corrective: data.corrective_action,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Sorry, an error occurred: ${err.message}`, citations: [] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!open) {
    return (
      <button className="chat-fab" onClick={() => setOpen(true)} title="Open AI Assistant">
        💬
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
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-state" style={{ padding: "2rem 1rem" }}>
            <div className="empty-state-icon">🤖</div>
            <div className="empty-state-title">Ask anything</div>
            <div className="empty-state-desc">
              Questions about solar forecasting, ice TES sizing, policy analysis, or IIT Kharagpur campus data.
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
            <div className="chat-msg-avatar">
              {msg.role === "user" ? "👤" : "⚡"}
            </div>
            <div>
              <div className="chat-msg-bubble">{msg.content}</div>
              {msg.citations?.length > 0 && (
                <div className="chat-citations">
                  {msg.citations.map((c, j) => (
                    <span key={j} className="chat-citation">{c}</span>
                  ))}
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
              <span className="loading-text" style={{ margin: 0 }}>Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEnd} />
      </div>

      <div className="chat-input-bar">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about solar, TES, policy..."
          disabled={loading}
        />
        <button className="chat-send-btn" onClick={handleSend} disabled={loading || !input.trim()}>
          {loading ? <div className="spinner spinner-sm" style={{ borderTopColor: "var(--text-inverse)" }} /> : "↑"}
        </button>
      </div>
    </div>
  );
}
