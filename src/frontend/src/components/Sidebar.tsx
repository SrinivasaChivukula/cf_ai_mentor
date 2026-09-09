import React from 'react';
import { Sparkles, RefreshCw, X, BarChart2 } from 'lucide-react';
import { SessionStats, AnalysisData } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  stats: SessionStats;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  onNewSession: () => void;
  onOpenAnalytics: () => void;
  latestAnalysis: AnalysisData | null;
  followUp: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  stats,
  isAnalyzing,
  onAnalyze,
  onNewSession,
  onOpenAnalytics,
  latestAnalysis,
  followUp,
}) => {
  const commScore = latestAnalysis?.communicationScore ?? null;
  const techScore = latestAnalysis?.technicalScore ?? null;
  const strengths = latestAnalysis?.strengths ?? [];
  const gaps = latestAnalysis?.gaps ?? [];
  const nextFocus = latestAnalysis?.nextFocus ?? [];

  const getScoreClass = (score: number) => {
    if (score >= 8) return 'score-good';
    if (score >= 5) return 'score-mid';
    return 'score-bad';
  };

  return (
    <aside className={'sidebar ' + (isOpen ? 'open' : '')}>
      <div className="sidebar-header">
        <div className="logo-group">
          <div className="logo-icon-sm">⚡</div>
          <span className="logo-title">AI Mentor</span>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close sidebar">
          <X size={18} />
        </button>
      </div>

      <div className="sidebar-content">
        <div className="card">
          <div className="card-title">Active Session</div>
          <div className="stat-item">
            <span className="stat-label">Topic</span>
            <span className="stat-val">{stats.topic}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Difficulty</span>
            <span className="stat-val" style={{ textTransform: 'capitalize' }}>
              {stats.difficulty}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Messages</span>
            <span className="stat-val">{stats.messageCount}</span>
          </div>
        </div>

        <div className="sidebar-buttons">
          <button
            className="btn btn-primary"
            onClick={onAnalyze}
            disabled={isAnalyzing || stats.messageCount < 2}
          >
            <Sparkles size={16} />
            <span>{isAnalyzing ? 'Running Workflow…' : 'Deep Analysis'}</span>
          </button>

          <button className="btn" onClick={onOpenAnalytics}>
            <BarChart2 size={16} />
            <span>D1 Database Analytics</span>
          </button>

          <button className="btn" onClick={onNewSession}>
            <RefreshCw size={16} />
            <span>New Session</span>
          </button>
        </div>

        {latestAnalysis && (
          <div className="analysis-container">
            <div className="card-title">Evaluation Breakdown</div>

            {commScore !== null && (
              <div className="score-badge-row">
                <span className="stat-label">Communication</span>
                <span className={'score-badge ' + getScoreClass(commScore)}>
                  {commScore}/10
                </span>
              </div>
            )}

            {techScore !== null && (
              <div className="score-badge-row">
                <span className="stat-label">Technical Accuracy</span>
                <span className={'score-badge ' + getScoreClass(techScore)}>
                  {techScore}/10
                </span>
              </div>
            )}

            {strengths.length > 0 && (
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Strengths
                </div>
                <div className="tag-list">
                  {strengths.map((s, idx) => (
                    <span key={idx} className="tag tag-good">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {gaps.length > 0 && (
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Identified Gaps
                </div>
                <div className="tag-list">
                  {gaps.map((g, idx) => (
                    <span key={idx} className="tag tag-gap">{g}</span>
                  ))}
                </div>
              </div>
            )}

            {nextFocus.length > 0 && (
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Recommended Focus
                </div>
                <div className="tag-list">
                  {nextFocus.map((f, idx) => (
                    <span key={idx} className="tag tag-good">{f}</span>
                  ))}
                </div>
              </div>
            )}

            {followUp && (
              <div className="followup-box">
                <strong>💡 Suggested probe:</strong>
                <p style={{ marginTop: '4px' }}>{followUp}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <div>Cloudflare Full-Stack Edge Architecture:</div>
        <div className="tech-badges">
          <span className="tech-badge">React 19 + Vite</span>
          <span className="tech-badge">Workers AI (Llama 3.3)</span>
          <span className="tech-badge">Durable Objects</span>
          <span className="tech-badge">D1 (SQLite)</span>
          <span className="tech-badge">Workflows</span>
        </div>
      </div>
    </aside>
  );
};
