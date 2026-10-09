import React, { useState, useEffect, useCallback } from 'react';
import {
  CloudRain,
  Compass,
  School,
  RefreshCw,
} from 'lucide-react';
import { fetchContextRisks } from '../../services/aiService';

export default function ContextRiskPage() {
  const [contextData, setContextData] = useState(null);
  const [selectedCorridorId, setSelectedCorridorId] = useState('school-road');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchContextRisks();
      if (data?.corridors) {
        setContextData(data);
      }
    } catch (err) {
      console.error('Failed to load context risk data:', err);
      setError('Unable to fetch environmental context risks.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchContextRisks()
      .then((data) => {
        if (isMounted && data?.corridors) {
          setContextData(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load context risk data:', err);
          setError('Unable to fetch environmental context risks.');
          setIsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedCorridor =
    contextData?.corridors?.find((c) => c.corridorId === selectedCorridorId) ||
    contextData?.corridors?.[0];

  return (
    <div className="municipal-page-container">
      {/* Disclaimer Trust Banner */}
      <div className="kg-trust-banner">
        <div className="kg-trust-content">
          <span className="kg-trust-badge" style={{ background: '#3b82f6' }}>STAGE 20 CONTEXT RISK</span>
          <span className="kg-trust-text">
            {selectedCorridor?.currentContext?.providerStatus || 'DEMO CONTEXT — SIMULATED ENVIRONMENTAL TELEMETRY'} &middot; ADVISORY ONLY &middot; DOES NOT ALTER OFFICIAL CIVIC PRIORITY
          </span>
        </div>
        <button
          className="kg-btn-secondary"
          onClick={loadData}
          disabled={isLoading}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
        >
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          <span>Sync Context</span>
        </button>
      </div>

      {/* Header */}
      <div className="municipal-page-header">
        <div>
          <h1 className="page-title">Context-Aware Civic Risk Intelligence</h1>
          <p className="page-subtitle">
            Combines historical municipal memory and predictive risk with real-time environmental context, precipitation rates, and high-vulnerability sensitive assets (schools, hospitals).
          </p>
        </div>
      </div>

      {error && <div className="kg-error-alert">{error}</div>}

      {/* Corridor Switcher */}
      <div className="kg-node-filters" style={{ marginBottom: '1.25rem' }}>
        {contextData?.corridors?.map((corr) => (
          <button
            key={corr.corridorId}
            className={`kg-filter-chip ${selectedCorridor?.corridorId === corr.corridorId ? 'active' : ''}`}
            onClick={() => setSelectedCorridorId(corr.corridorId)}
          >
            <Compass size={14} />
            <span style={{ fontWeight: 600 }}>{corr.areaName}</span>
            <span
              className="kg-badge"
              style={{
                marginLeft: '0.4rem',
                fontSize: '0.7rem',
                background: corr.contextualAttention.attentionLevel.includes('CRITICAL') ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)',
                color: corr.contextualAttention.attentionLevel.includes('CRITICAL') ? '#ef4444' : '#3b82f6',
              }}
            >
              {corr.contextualAttention.attentionLevel.includes('CRITICAL') ? 'ELEVATED ATTENTION' : 'STANDARD'}
            </span>
          </button>
        ))}
      </div>

      {selectedCorridor && (
        <div className="kg-dashboard-grid">
          {/* Left Column: Context Telemetry & Sensitive Assets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Live Environmental Telemetry Card */}
            <div className="kg-panel">
              <div className="kg-panel-header" style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CloudRain size={18} className="text-primary" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Environmental & Weather Signals</h3>
                </div>
                <span className="kg-badge kg-badge-type">
                  {selectedCorridor.currentContext.isSimulated ? 'SIMULATED CONTEXT' : 'LIVE TELEMETRY'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.8rem' }}>
                <div className="kg-stat-card" style={{ padding: '0.6rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Weather</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#3b82f6' }}>
                    {selectedCorridor.currentContext.weatherCondition}
                  </div>
                </div>

                <div className="kg-stat-card" style={{ padding: '0.6rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Precipitation</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: selectedCorridor.currentContext.precipitationMmPerHour > 25 ? '#ef4444' : '#10b981' }}>
                    {selectedCorridor.currentContext.precipitationMmPerHour} mm/h
                  </div>
                </div>

                <div className="kg-stat-card" style={{ padding: '0.6rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Temperature</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                    {selectedCorridor.currentContext.temperatureC} °C
                  </div>
                </div>

                <div className="kg-stat-card" style={{ padding: '0.6rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Road Surface</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    {selectedCorridor.currentContext.roadSurfaceStatus}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', padding: '0.6rem', borderRadius: '4px' }}>
                <div><strong>Time Context:</strong> {selectedCorridor.currentContext.timeOfDay}</div>
                <div><strong>Season:</strong> {selectedCorridor.currentContext.seasonalPeriod}</div>
              </div>
            </div>

            {/* Sensitive Infrastructure POIs */}
            <div className="kg-panel">
              <div className="kg-panel-header" style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <School size={18} className="text-primary" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Nearby Sensitive Public Assets</h3>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  &lt; 500m Radius
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedCorridor.sensitiveLocations?.map((loc, idx) => (
                  <div key={idx} className="kg-node-card" style={{ padding: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {loc.name}
                      </div>
                      <span className="kg-badge kg-badge-type" style={{ fontSize: '0.7rem' }}>
                        {loc.distanceMeters}m away
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: loc.vulnerability.includes('CRITICAL') || loc.vulnerability.includes('HIGH') ? '#ef4444' : 'var(--text-muted)' }}>
                      <strong>Vulnerability:</strong> {loc.vulnerability}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Contextual Attention & Action Advisory */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Attention Card */}
            <div
              className="kg-panel"
              style={{
                borderColor: selectedCorridor.contextualAttention.attentionLevel.includes('CRITICAL') ? 'rgba(239,68,68,0.3)' : 'var(--border-color)',
                background: selectedCorridor.contextualAttention.attentionLevel.includes('CRITICAL') ? 'rgba(239,68,68,0.03)' : 'var(--bg-card)',
              }}
            >
              <div className="kg-panel-header" style={{ marginBottom: '0.75rem' }}>
                <div>
                  <span className="kg-badge" style={{ background: selectedCorridor.contextualAttention.attentionLevel.includes('CRITICAL') ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)', color: selectedCorridor.contextualAttention.attentionLevel.includes('CRITICAL') ? '#ef4444' : '#3b82f6', marginBottom: '0.3rem', display: 'inline-block' }}>
                    {selectedCorridor.contextualAttention.attentionLevel}
                  </span>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Contextual Attention Advisory
                  </h3>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: selectedCorridor.contextualAttention.attentionScore >= 80 ? '#ef4444' : '#3b82f6' }}>
                    {selectedCorridor.contextualAttention.attentionScore}/100
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Context Score</div>
                </div>
              </div>

              {/* Advisory Statement */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '6px', borderLeft: '3px solid #ef4444', marginBottom: '0.8rem', fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {selectedCorridor.contextualAttention.advisoryStatement}
              </div>

              {/* Alert Signals */}
              <div style={{ marginBottom: '0.8rem' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Active Contextual Triggers:
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {selectedCorridor.contextualAttention.alertSignals?.map((sig, idx) => (
                    <li key={idx}>{sig}</li>
                  ))}
                </ul>
              </div>

              {/* Historical vs Contextual Comparison Table */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.6rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Baseline Historical Risk</div>
                  <div style={{ fontWeight: 600 }}>{selectedCorridor.historicalRisk.riskScore}/100 ({selectedCorridor.historicalRisk.riskLevel})</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{selectedCorridor.historicalRisk.reportCount} reports</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Contextual Multiplier</div>
                  <div style={{ fontWeight: 600, color: '#ef4444' }}>Elevated Attention Required</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Rainfall + School Zone Sensitivity</div>
                </div>
              </div>

              <div style={{ marginTop: '0.8rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {selectedCorridor.trustAndSafety.disclaimer}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
