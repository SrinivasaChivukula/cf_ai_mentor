import React, { useEffect, useRef } from 'react';
import { Menu, Mic, BarChart3, Bot, User } from 'lucide-react';
import { Message, SessionStats } from '../types';

interface ChatAreaProps {
  onOpenSidebar: () => void;
  stats: SessionStats;
  sessionId: string;
  messages: Message[];
  status: 'online' | 'thinking' | 'recording';
  statusText: string;
  isStreaming: boolean;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  onOpenSidebar,
  stats,
  sessionId,
  messages,
  status,
  statusText,
  isStreaming,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <main className="main-chat">
      <header className="chat-header">
        <div className="header-left">
          <button className="icon-btn" onClick={onOpenSidebar} aria-label="Open sidebar">
            <Menu size={20} />
          </button>
          <div className="header-info">
            <h2>{stats.topic}</h2>
            <span>
              {stats.difficulty.toUpperCase()} level · Session {sessionId.slice(-6)}
            </span>
          </div>
        </div>

        <div className="status-pill">
          <span className={'status-dot ' + status}></span>
          <span>{statusText}</span>
        </div>
      </header>

      <div className="messages-stream" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="welcome-screen">
            <div className="welcome-icon">🎯</div>
            <h2>Ready for your interview?</h2>
            <p>
              Your first answer will begin the <strong>{stats.topic}</strong> interview. The AI
              interviewer evaluates your reasoning, checks edge cases, and guides you step-by-step.
            </p>
            <div className="tips-grid">
              <div className="tip-card">
                <Mic size={20} style={{ color: 'var(--cf-orange)' }} />
                <div>
                  <strong>Voice or Text</strong>
                  <p>Click the microphone icon to speak naturally or type your responses.</p>
                </div>
              </div>
              <div className="tip-card">
                <BarChart3 size={20} style={{ color: '#10b981' }} />
                <div>
                  <strong>Deep Workflow Analysis</strong>
                  <p>After a few rounds, run Deep Analysis to receive scored metrics and feedback.</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={'message-row ' + msg.role}>
              <div className={'avatar ' + msg.role}>
                {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
              </div>
              <div className="message-body">
                <div className="message-meta">
                  <strong>{msg.role === 'user' ? 'Candidate' : 'AI Interviewer'}</strong>
                  <span>{formatTime(msg.timestamp)}</span>
                </div>
                <div className="message-bubble">{msg.content}</div>
              </div>
            </div>
          ))
        )}

        {isStreaming && messages[messages.length - 1]?.role === 'user' && (
          <div className="message-row assistant">
            <div className="avatar assistant">
              <Bot size={18} />
            </div>
            <div className="message-body">
              <div className="message-meta">
                <strong>AI Interviewer</strong>
              </div>
              <div className="message-bubble">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};
