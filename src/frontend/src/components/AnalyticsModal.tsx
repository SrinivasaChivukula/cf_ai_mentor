import React, { useEffect, useState } from 'react';
import { X, Database, BarChart3, TrendingUp, RefreshCw } from 'lucide-react';
import { AnalyticsData } from '../types';
import { getMockAnalytics } from '../services/interviewEngine';

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics');
      if (res.ok) {
        const json = (await res.json()) as AnalyticsData;
        setData(json);
      } else {
        // Fallback for static live demo
        setData(getMockAnalytics());
      }
    } catch {
      // Network failure / static demo fallback
      setData(getMockAnalytics());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAnalytics();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card" style={{ maxWidth: '640px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="logo-icon-sm" style={{ background: '#3b82f6' }}>
              <Database size={18} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Cloudflare D1 Analytics</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Persistent SQLite analytics across candidate mock interviews
              </p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
            <RefreshCw size={24} className="status-dot thinking" style={{ margin: '0 auto 10px' }} />
            <p>Querying Cloudflare D1 tables…</p>
          </div>
        ) : error ? (
          <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', color: '#f87171' }}>
            {error}
          </div>
        ) : data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              <div className="card" style={{ textAlign: 'center', padding: '12px' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--cf-orange)' }}>
                  {data.totalSessions}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Sessions</div>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: '12px' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#3b82f6' }}>
                  {data.totalMessages}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Messages</div>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: '12px' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>
                  {data.avgCommunicationScore || '—'}/10
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Avg Comm</div>
              </div>
              <div className="card" style={{ textAlign: 'center', padding: '12px' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#a855f7' }}>
                  {data.avgTechnicalScore || '—'}/10
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Avg Tech</div>
              </div>
            </div>

            <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BarChart3 size={14} /> Topic Practice Distribution
              </div>
              {data.topicDistribution && data.topicDistribution.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.topicDistribution.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{item.topic}</span>
                      <span style={{ fontWeight: 600 }}>{item.count} session{item.count !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>No session distribution data yet.</p>
              )}
            </div>

            <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingUp size={14} /> Recent Performance Records
              </div>
              {data.recentEvaluations && data.recentEvaluations.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.recentEvaluations.map((ev, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        fontSize: '0.8rem',
                      }}
                    >
                      <div>
                        <strong>{ev.topic || 'General SE'}</strong>{' '}
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>({ev.difficulty})</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span className="tag tag-good">Comm: {ev.communication_score ?? '—'}/10</span>
                        <span className="tag tag-good">Tech: {ev.technical_score ?? '—'}/10</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                  Complete a mock interview and click "Deep Analysis" to see recorded evaluations.
                </p>
              )}
            </div>
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn" onClick={fetchAnalytics} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
