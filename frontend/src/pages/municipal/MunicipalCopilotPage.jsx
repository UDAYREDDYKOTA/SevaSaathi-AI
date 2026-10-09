import React, { useState, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
} from 'lucide-react';
import {
  queryMunicipalCopilot,
  fetchCopilotSuggestedQuestions,
} from '../../services/aiService';

const INITIAL_MESSAGES = [
  {
    id: 'welcome-msg',
    sender: 'copilot',
    text: 'Good day, Commissioner. I am your Municipal AI Copilot, grounded strictly in live database ledgers across Incidents, Civic Memory, Predictive Risk, Knowledge Graph, Preventive Plans, and What-If Simulations. How may I assist your review today?',
    answer: null,
    timestamp: '10:00 AM',
  },
];

export default function MunicipalCopilotPage() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputQuery, setInputQuery] = useState('');
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchCopilotSuggestedQuestions()
      .then((res) => {
        if (res?.questions) {
          setSuggestedQuestions(res.questions);
        }
      })
      .catch((err) => console.warn('Failed to fetch suggested questions:', err));
  }, []);

  const handleSend = async (questionText) => {
    const q = (questionText || inputQuery).trim();
    if (!q || isLoading) return;

    const userMsgId = `user-msg-${messages.length + 1}`;
    const newMessages = [
      ...messages,
      {
        id: userMsgId,
        sender: 'user',
        text: q,
        timestamp: 'Just now',
      },
    ];
    setMessages(newMessages);
    setInputQuery('');
    setIsLoading(true);

    try {
      const res = await queryMunicipalCopilot(q);
      if (res?.answer) {
        setMessages((prev) => [
          ...prev,
          {
            id: `copilot-msg-${prev.length + 1}`,
            sender: 'copilot',
            text: res.answer.summary,
            answer: res.answer,
            timestamp: 'Just now',
          },
        ]);
      }
    } catch (err) {
      console.error('Copilot query error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `copilot-msg-${prev.length + 1}`,
          sender: 'copilot',
          text: 'Insufficient municipal data available to answer this question. Please rephrase or query specific incident IDs.',
          answer: null,
          timestamp: 'Just now',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="municipal-page-container">
      {/* Disclaimer Trust Banner */}
      <div className="kg-trust-banner">
        <div className="kg-trust-content">
          <span className="kg-trust-badge" style={{ background: '#8b5cf6' }}>STAGE 21 MUNICIPAL COPILOT</span>
          <span className="kg-trust-text">
            AI-ASSISTED MUNICIPAL DECISION SUPPORT &middot; STRICTLY GROUNDED IN CIVIC LEDGERS &middot; ZERO HALLUCINATION &middot; OFFICER AUTHORIZATION MANDATORY
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="municipal-page-header">
        <div>
          <h1 className="page-title">Municipal AI Copilot</h1>
          <p className="page-subtitle">
            Enterprise decision-support assistant synthesizing Incidents, Root Causes, Preventive Actions, Simulations, and Environmental Context for senior municipal leadership.
          </p>
        </div>
      </div>

      {/* Suggested Questions Carousel */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Sparkles size={13} className="text-primary" />
          <span>Quick Inquiries:</span>
        </div>
        <div className="kg-node-filters" style={{ flexWrap: 'wrap', gap: '0.4rem' }}>
          {suggestedQuestions.map((sq, idx) => (
            <button
              key={idx}
              className="kg-filter-chip"
              onClick={() => handleSend(sq)}
              disabled={isLoading}
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem' }}
            >
              <span>{sq}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Conversation Area */}
      <div
        className="kg-panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '480px',
          maxHeight: '680px',
          padding: '1.25rem',
        }}
      >
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            paddingRight: '0.5rem',
          }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: msg.sender === 'user' ? '80%' : '95%',
              }}
            >
              {msg.sender === 'copilot' && (
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(139,92,246,0.15)',
                    color: '#8b5cf6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Bot size={18} />
                </div>
              )}

              <div
                style={{
                  background: msg.sender === 'user' ? 'var(--primary)' : 'var(--bg-card)',
                  border: msg.sender === 'user' ? 'none' : '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '0.9rem',
                  color: msg.sender === 'user' ? '#fff' : 'var(--text-primary)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: msg.sender === 'user' ? '#fff' : '#8b5cf6' }}>
                    {msg.sender === 'user' ? 'Municipal Officer' : 'SevaSaathi Copilot'}
                  </span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{msg.timestamp}</span>
                </div>

                <div style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>
                  {msg.text}
                </div>

                {/* Structured Copilot Answer Cards */}
                {msg.answer && (
                  <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Key Findings */}
                    {msg.answer.keyFindings?.length > 0 && (
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem', borderRadius: '6px', borderLeft: '2px solid #8b5cf6' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#8b5cf6', marginBottom: '0.3rem' }}>
                          Key Findings:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          {msg.answer.keyFindings.map((kf, i) => (
                            <li key={i}>{kf}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recommended Focus */}
                    {msg.answer.recommendedFocus && (
                      <div style={{ background: 'rgba(16,185,129,0.06)', padding: '0.6rem', borderRadius: '6px', borderLeft: '2px solid #10b981' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981', marginBottom: '0.2rem' }}>
                          Recommended Operational Focus:
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                          {msg.answer.recommendedFocus}
                        </div>
                      </div>
                    )}

                    {/* Next Officer Review */}
                    {msg.answer.nextOfficerReview && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <strong>Next Step in Console:</strong> {msg.answer.nextOfficerReview}
                      </div>
                    )}

                    {/* Evidence & References Chips */}
                    {msg.answer.references && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ledger References:</span>
                        {msg.answer.references.incidentIds?.map((id, i) => (
                          <span key={`inc-${i}`} className="kg-badge kg-badge-type" style={{ fontSize: '0.68rem' }}>
                            {id}
                          </span>
                        ))}
                        {msg.answer.references.riskIds?.map((id, i) => (
                          <span key={`risk-${i}`} className="kg-badge" style={{ fontSize: '0.68rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                            {id}
                          </span>
                        ))}
                        {msg.answer.references.planIds?.map((id, i) => (
                          <span key={`plan-${i}`} className="kg-badge kg-badge-resolved" style={{ fontSize: '0.68rem' }}>
                            {id}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {msg.sender === 'user' && (
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(59,130,246,0.15)',
                    color: '#3b82f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <User size={18} />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(139,92,246,0.15)',
                  color: '#8b5cf6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bot size={18} />
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sparkles size={14} className="spin text-primary" />
                <span>Synthesizing municipal intelligence across 20 stages...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
          <input
            type="text"
            className="kg-notes-input"
            style={{
              flex: 1,
              background: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '0.7rem 1rem',
              color: 'var(--text-primary)',
              fontSize: '0.88rem',
            }}
            placeholder="Ask about incidents, root causes, what-if scenarios, or preventive plans..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            className="kg-btn-primary"
            onClick={() => handleSend()}
            disabled={isLoading || !inputQuery.trim()}
            style={{
              padding: '0 1.2rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: '#8b5cf6',
            }}
          >
            <Send size={16} />
            <span>Send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
