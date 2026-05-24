import { useEffect, useRef, useState, useCallback } from 'react';
import '../styles/call-chat.css';

export default function CallChat({ socket, mySocketId, enabled }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [chatError, setChatError] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const listRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom, isOpen]);

  useEffect(() => {
    if (!socket) return;

    const onHistory = (history) => {
      setMessages(Array.isArray(history) ? history : []);
    };

    const onMessage = (message) => {
      setMessages((prev) => [...prev, message]);
    };

    const onChatError = ({ message }) => {
      setChatError(message || 'Could not send message.');
      setTimeout(() => setChatError(''), 4000);
    };

    socket.on('chat-history', onHistory);
    socket.on('chat-message', onMessage);
    socket.on('chat-error', onChatError);

    return () => {
      socket.off('chat-history', onHistory);
      socket.off('chat-message', onMessage);
      socket.off('chat-error', onChatError);
    };
  }, [socket]);

  useEffect(() => {
    if (!enabled) {
      setMessages([]);
    }
  }, [enabled]);

  const sendMessage = (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || !socket || !enabled) return;

    socket.emit('chat-message', { text });
    setInput('');
    setChatError('');
  };

  const formatTime = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        className="chat-toggle chat-toggle-collapsed"
        onClick={() => setIsOpen(true)}
        aria-label="Open chat"
      >
        💬 Chat {messages.length > 0 && <span className="chat-badge">{messages.length}</span>}
      </button>
    );
  }

  return (
    <aside className={`call-chat ${enabled ? '' : 'call-chat-disabled'}`}>
      <div className="call-chat-header">
        <h3>Room chat</h3>
        <button
          type="button"
          className="chat-close-btn"
          onClick={() => setIsOpen(false)}
          aria-label="Close chat"
        >
          ✕
        </button>
      </div>

      {!enabled && (
        <p className="chat-hint">Connect to the room to send messages.</p>
      )}

      {chatError && <p className="chat-inline-error">{chatError}</p>}

      <div className="call-chat-messages" ref={listRef}>
        {messages.length === 0 ? (
          <p className="chat-empty">No messages yet. Say hello!</p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === mySocketId;
            return (
              <div
                key={msg.id}
                className={`chat-message ${isMine ? 'chat-message-mine' : 'chat-message-other'}`}
              >
                <div className="chat-message-meta">
                  <span className="chat-sender">
                    {isMine ? 'You' : msg.senderName || 'Guest'}
                  </span>
                  <span className="chat-time">{formatTime(msg.timestamp)}</span>
                </div>
                <p className="chat-text">{msg.text}</p>
              </div>
            );
          })
        )}
      </div>

      <form className="call-chat-form" onSubmit={sendMessage}>
        <input
          type="text"
          className="call-chat-input"
          placeholder={enabled ? 'Type a message…' : 'Waiting for connection…'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          disabled={!enabled || !socket}
          aria-label="Chat message"
        />
        <button
          type="submit"
          className="call-chat-send"
          disabled={!enabled || !socket || !input.trim()}
        >
          Send
        </button>
      </form>
    </aside>
  );
}
