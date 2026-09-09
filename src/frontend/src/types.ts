export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface SessionStats {
  topic: string;
  difficulty: string;
  messageCount: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface AnalysisData {
  communicationScore?: number;
  technicalScore?: number;
  strengths?: string[];
  gaps?: string[];
  nextFocus?: string[];
  raw?: string;
}

export interface AnalysisResponse {
  analysis: AnalysisData;
  followUp: string;
  generatedAt: number;
}

export interface AnalyticsData {
  totalSessions: number;
  totalMessages: number;
  avgCommunicationScore: number;
  avgTechnicalScore: number;
  totalEvaluations: number;
  topicDistribution: Array<{ topic: string; count: number }>;
  recentEvaluations: Array<{
    id: number;
    session_id: string;
    topic: string;
    difficulty: string;
    communication_score: number;
    technical_score: number;
    created_at: number;
  }>;
  notice?: string;
}
