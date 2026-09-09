import React, { useState } from 'react';
import { ArrowRight, Zap, Brain, Database, BarChart3, Mic } from 'lucide-react';

interface SetupModalProps {
  isOpen: boolean;
  onStart: (topic: string, difficulty: string) => void;
}

const TOPICS = [
  'JavaScript & Web Development',
  'Data Structures & Algorithms',
  'System Design',
  'Python',
  'Database Design & SQL',
  'Distributed Systems',
  'Machine Learning',
  'Behavioral & Leadership',
];

export const SetupModal: React.FC<SetupModalProps> = ({ isOpen, onStart }) => {
  const [topic, setTopic] = useState('JavaScript & Web Development');
  const [difficulty, setDifficulty] = useState('medium');

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-logo">⚡</div>
          <h1>Cloudflare AI Mentor</h1>
          <p>Practice technical interviews with an AI coach running on Cloudflare edge.</p>
        </div>

        <div className="form-group">
          <label htmlFor="topic-select">Interview Topic</label>
          <select
            id="topic-select"
            className="select-styled"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          >
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Difficulty Level</label>
          <div className="difficulty-grid" role="radiogroup" aria-label="Difficulty">
            <div
              className={'diff-card ' + (difficulty === 'easy' ? 'active' : '')}
              onClick={() => setDifficulty('easy')}
              role="radio"
              aria-checked={difficulty === 'easy'}
            >
              <span className="diff-dot easy"></span>
              <span className="diff-title">Easy</span>
              <span className="diff-sub">Junior</span>
            </div>

            <div
              className={'diff-card ' + (difficulty === 'medium' ? 'active' : '')}
              onClick={() => setDifficulty('medium')}
              role="radio"
              aria-checked={difficulty === 'medium'}
            >
              <span className="diff-dot medium"></span>
              <span className="diff-title">Medium</span>
              <span className="diff-sub">Mid-level</span>
            </div>

            <div
              className={'diff-card ' + (difficulty === 'hard' ? 'active' : '')}
              onClick={() => setDifficulty('hard')}
              role="radio"
              aria-checked={difficulty === 'hard'}
            >
              <span className="diff-dot hard"></span>
              <span className="diff-title">Hard</span>
              <span className="diff-sub">Senior</span>
            </div>
          </div>
        </div>

        <button className="btn btn-primary" onClick={() => onStart(topic, difficulty)}>
          <span>Start Interview</span>
          <ArrowRight size={18} />
        </button>

        <div className="modal-features">
          <div className="feature-pill"><Brain size={14} /> Llama 3.3 70B</div>
          <div className="feature-pill"><Database size={14} /> Durable Objects + D1</div>
          <div className="feature-pill"><BarChart3 size={14} /> Deep Analysis</div>
          <div className="feature-pill"><Mic size={14} /> Voice Input</div>
        </div>
      </div>
    </div>
  );
};
