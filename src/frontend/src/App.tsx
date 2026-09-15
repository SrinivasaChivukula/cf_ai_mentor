import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SetupModal } from './components/SetupModal';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { InputArea } from './components/InputArea';
import { AnalyticsModal } from './components/AnalyticsModal';
import { Message, SessionStats, AnalysisData } from './types';
import './styles.css';

function generateSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return 'sess_' + crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  }
  return 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const App: React.FC = () => {
  const [sessionId, setSessionId] = useState(generateSessionId);
  const [isSetupOpen, setIsSetupOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [stats, setStats] = useState<SessionStats>({
    topic: 'JavaScript & Web Development',
    difficulty: 'medium',
    messageCount: 0,
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [status, setStatus] = useState<'online' | 'thinking' | 'recording'>('online');
  const [statusText, setStatusText] = useState('AI ready');
  const [latestAnalysis, setLatestAnalysis] = useState<AnalysisData | null>(null);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: number; text: string; type: string }>>([]);

  const pollIntervalRef = useRef<any>(null);
  const pollCountRef = useRef<number>(0);

  const addToast = useCallback((text: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const handleStart = (selectedTopic: string, selectedDifficulty: string) => {
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    setStats({
      topic: selectedTopic,
      difficulty: selectedDifficulty,
      messageCount: 0,
    });
    setMessages([]);
    setLatestAnalysis(null);
    setFollowUp(null);
    setIsSetupOpen(false);
    setStatus('online');
    setStatusText('AI ready');
  };

  const handleNewSession = async () => {
    try {
      await fetch('/api/session/' + sessionId, { method: 'DELETE' });
    } catch {
      /* ignore */
    }
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    setMessages([]);
    setStats((prev) => ({ ...prev, messageCount: 0 }));
    setLatestAnalysis(null);
    setFollowUp(null);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setIsSetupOpen(true);
    addToast('New session started', 'success');
  };

  const handleSendMessage = async (text: string) => {
    if (isStreaming) return;

    const userMessage: Message = {
      id: 'msg_' + Date.now(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setStats((prev) => ({ ...prev, messageCount: prev.messageCount + 1 }));
    setIsStreaming(true);
    setStatus('thinking');
    setStatusText('Thinking…');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: text,
          topic: stats.topic,
          difficulty: stats.difficulty,
        }),
      });

      if (!response.ok) {
        let errorMsg = 'HTTP ' + response.status;
        try {
          const errJson = (await response.json()) as { error?: string };
          if (errJson?.error) errorMsg = errJson.error;
        } catch {
          try {
            const errText = await response.text();
            if (errText) errorMsg = errText.slice(0, 160);
          } catch {}
        }
        throw new Error(errorMsg);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No readable response stream');

      const decoder = new TextDecoder();
      let assistantText = '';
      const assistantMsgId = 'msg_' + (Date.now() + 1);

      // Optimistically create assistant message bubble
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: 'assistant', content: '', timestamp: Date.now() },
      ]);

      let sseBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        // Keep incomplete line in buffer for the next TCP chunk
        sseBuffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6).trim();
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.response) {
              assistantText += parsed.response;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, content: assistantText } : m))
              );
            }
          } catch {
            /* Incomplete JSON within single line */
          }
        }
      }

      setStats((prev) => ({ ...prev, messageCount: prev.messageCount + 1 }));
      setStatus('online');
      setStatusText('AI ready');
    } catch (err: any) {
      addToast('Error: ' + (err?.message || 'Chat request failed'), 'error');
      setStatus('online');
      setStatusText('AI ready');
    } finally {
      setIsStreaming(false);
    }
  };

  const handleAnalyze = async () => {
    if (isAnalyzing || stats.messageCount < 2) return;

    setIsAnalyzing(true);
    setStatus('thinking');
    setStatusText('Running analysis…');
    addToast('Deep analysis started via Cloudflare Workflows', 'info');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          topic: stats.topic,
          difficulty: stats.difficulty,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok) {
        addToast(data.error || 'Failed to start analysis', 'error');
        setIsAnalyzing(false);
        setStatus('online');
        setStatusText('AI ready');
        return;
      }

      const workflowId = data.workflowId;
      pollWorkflow(workflowId);
    } catch (err: any) {
      addToast('Analysis initiation error', 'error');
      setIsAnalyzing(false);
      setStatus('online');
      setStatusText('AI ready');
    }
  };

  const pollWorkflow = (workflowId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollCountRef.current = 0;

    pollIntervalRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      // Cap at 30 polls (~90 seconds)
      if (pollCountRef.current > 30) {
        clearInterval(pollIntervalRef.current);
        setIsAnalyzing(false);
        setStatus('online');
        setStatusText('AI ready');
        addToast('Analysis timed out. Please try again.', 'error');
        return;
      }

      try {
        const res = await fetch('/api/workflow/' + workflowId);
        if (!res.ok) {
          if (pollCountRef.current > 5) {
            clearInterval(pollIntervalRef.current);
            setIsAnalyzing(false);
            setStatus('online');
            setStatusText('AI ready');
            addToast('Unable to check workflow status', 'error');
          }
          return;
        }

        const statusData = (await res.json()) as any;

        if (statusData.status === 'complete') {
          clearInterval(pollIntervalRef.current);
          setIsAnalyzing(false);
          setStatus('online');
          setStatusText('AI ready');
          addToast('Analysis complete! Persisted to DO & D1.', 'success');
          loadAnalysis();
        } else if (statusData.status === 'errored') {
          clearInterval(pollIntervalRef.current);
          setIsAnalyzing(false);
          setStatus('online');
          setStatusText('AI ready');
          addToast('Analysis workflow encountered an error', 'error');
        }
      } catch {
        /* retry on next interval */
      }
    }, 3000);
  };

  const loadAnalysis = async () => {
    try {
      const res = await fetch('/api/session/' + sessionId + '/analysis');
      if (!res.ok) return;
      const data = (await res.json()) as any;
      if (data?.latestAnalysis) {
        setLatestAnalysis(data.latestAnalysis.analysis);
        setFollowUp(data.latestAnalysis.followUp);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  return (
    <div className="app-container">
      <SetupModal isOpen={isSetupOpen} onStart={handleStart} />

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        stats={stats}
        isAnalyzing={isAnalyzing}
        onAnalyze={handleAnalyze}
        onNewSession={handleNewSession}
        onOpenAnalytics={() => setIsAnalyticsOpen(true)}
        latestAnalysis={latestAnalysis}
        followUp={followUp}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <ChatArea
          onOpenSidebar={() => setIsSidebarOpen(true)}
          stats={stats}
          sessionId={sessionId}
          messages={messages}
          status={status}
          statusText={statusText}
          isStreaming={isStreaming}
        />

        <InputArea
          onSendMessage={handleSendMessage}
          disabled={isStreaming || isSetupOpen}
          onVoiceStatusChange={(isRec) => {
            if (isRec) {
              setStatus('recording');
              setStatusText('Listening…');
            } else {
              setStatus('online');
              setStatusText('AI ready');
            }
          }}
        />
      </div>

      <AnalyticsModal isOpen={isAnalyticsOpen} onClose={() => setIsAnalyticsOpen(false)} />

      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={'toast ' + t.type}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
};
export default App;
