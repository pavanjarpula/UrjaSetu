import React, { useState, useRef, useEffect } from "react";
import { sendChatMessage, getChatHistory } from "../api/client";

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const messagesEnd = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        { role: "assistant", content: `Error: ${err.message}`, citations: [] },
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

  return (
    <>
      <button
        className="chat-toggle"
        onClick={() => setOpen(!open)}
        title="Chat with Urjasetu"
      >
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <div className="chat-widget">
          <div className="chat-header">
            <h3>Urjasetu Assistant</h3>
            <button onClick={() => setOpen(false)} className="btn btn-secondary btn-sm">
              ✕
            </button>
          </div>

          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-empty">
                <p>Ask me about solar forecasting, ice TES, or the platform.</p>
                <div className="suggested-questions">
                  {[
                    "What is the expected ice volume for today?",
                    "How does the TES sizing engine work?",
                    "What is the forecast accuracy?",
                  ].map((q) => (
                    <button
                      key={q}
                      className="suggestion-chip"
                      onClick={() => {
                        setInput(q);
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`chat-message ${msg.role}`}>
                <div className="bubble">{msg.content}</div>
                {msg.citations?.length > 0 && (
                  <div className="chat-citations">
                    {msg.citations.map((c, j) => (
                      <span key={j} className="citation-chip">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
                {msg.corrective && (
                  <div style={{ fontSize: "0.7rem", color: "var(--accent-purple)", marginTop: 4 }}>
                    ↻ Query was rewritten for better retrieval
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="chat-message assistant">
                <div className="bubble typing">Thinking...</div>
              </div>
            )}

            <div ref={messagesEnd} />
          </div>

          <div className="chat-input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              disabled={loading}
            />
            <button className="btn btn-primary" onClick={handleSend} disabled={loading || !input.trim()}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
