import React, { useState, useEffect, useCallback } from 'react';
import {
  Sliders,
  RefreshCw,
  Award,
} from 'lucide-react';
import { fetchSimulationScenarios } from '../../services/aiService';

export default function WhatIfSimulatorPage() {
  const [selectedIncidentId, setSelectedIncidentId] = useState('cluster_drainage_school_road');
  const [simulationData, setSimulationData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSimulation = useCallback(async (incId) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSimulationScenarios(incId);
      if (data?.simulation) {
        setSimulationData(data.simulation);
      }
    } catch (err) {
      console.error('Failed to load simulation data:', err);
      setError('Unable to evaluate municipal simulation scenarios.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchSimulationScenarios(selectedIncidentId)
      .then((data) => {
        if (isMounted && data?.simulation) {
          setSimulationData(data.simulation);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load simulation data:', err);
          setError('Unable to evaluate municipal simulation scenarios.');
          setIsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [selectedIncidentId]);

  const incidentList = [
    { id: 'cluster_drainage_school_road', label: 'School Road Drainage Corridor (Drainage)', priority: 'CRITICAL' },
    { id: 'cluster_roads_mg_road', label: 'MG Road Commercial Junction (Roads)', priority: 'HIGH' },
    { id: 'cluster_water_civil_hospital', label: 'Civil Hospital Health Corridor (Water)', priority: 'HIGH' },
  ];

  const teamComp = simulationData?.teamComparison;
  const delayAnalysis = simulationData?.delayAnalysis;
  const prevComp = simulationData?.preventiveComparison;

  return (
    <div className="municipal-page-container">
      {/* Simulation Disclaimer Trust Banner */}
      <div className="kg-trust-banner">
        <div className="kg-trust-content">
          <span className="kg-trust-badge" style={{ background: '#f59e0b' }}>STAGE 19 WHAT-IF SIMULATOR</span>
          <span className="kg-trust-text">
            SIMULATION ONLY &middot; NOT A FORECAST &middot; NOT A GUARANTEE &middot; OFFICER AUTHORIZATION MANDATORY
          </span>
        </div>
        <button
          className="kg-btn-secondary"
          onClick={() => loadSimulation(selectedIncidentId)}
          disabled={isLoading}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
        >
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          <span>Re-Simulate</span>
        </button>
      </div>

      {/* Header */}
      <div className="municipal-page-header">
        <div>
          <h1 className="page-title">Municipal What-If Simulator</h1>
          <p className="page-subtitle">
            Simulate operational dispatch decisions, team proximity tradeoffs, response delay escalations, and preventive ROI before taking action.
          </p>
        </div>
      </div>

      {error && <div className="kg-error-alert">{error}</div>}

      {/* Incident Switcher */}
      <div className="kg-node-filters" style={{ marginBottom: '1.25rem' }}>
        {incidentList.map((inc) => (
          <button
            key={inc.id}
            className={`kg-filter-chip ${selectedIncidentId === inc.id ? 'active' : ''}`}
            onClick={() => setSelectedIncidentId(inc.id)}
          >
            <Sliders size={14} />
            <span style={{ fontWeight: 600 }}>{inc.label}</span>
            <span className="kg-badge kg-badge-type" style={{ marginLeft: '0.4rem', fontSize: '0.7rem' }}>
              {inc.priority}
            </span>
          </button>
        ))}
      </div>

      {simulationData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* SECTION 1: Team Selection Simulation (Scenario A vs Scenario B) */}
          <div className="kg-panel">
            <div className="kg-panel-header" style={{ marginBottom: '1rem' }}>
              <div>
                <span className="kg-badge kg-badge-type">DISPATCH SIMULATION</span>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                  Response Team Allocation: Scenario A vs Scenario B
                </h2>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Target: {simulationData.incident?.areaName}
              </div>
            </div>

            {/* Comparison Cards Side-by-Side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              {/* Scenario A */}
              {teamComp?.scenarioA && (
                <div
                  className="kg-node-card selected"
                  style={{
                    padding: '1.2rem',
                    background: 'rgba(16,185,129,0.04)',
                    borderColor: 'rgba(16,185,129,0.3)',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <span className="kg-badge kg-badge-resolved" style={{ marginBottom: '0.3rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Award size={12} /> RECOMMENDED SCENARIO A
                      </span>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {teamComp.scenarioA.teamName}
                      </h3>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {teamComp.scenarioA.department}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>
                        {teamComp.scenarioA.scores.compositeScore}
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/100</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Simulation Score</div>
                    </div>
                  </div>

                  {/* Core Metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', margin: '0.8rem 0', background: 'rgba(255,255,255,0.02)', padding: '0.6rem', borderRadius: '6px' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Distance</div>
                      <div style={{ fontSize: '1rem', fontWeight: 600 }}>{teamComp.scenarioA.distanceKm} km</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Est. Response</div>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#10b981' }}>{teamComp.scenarioA.estimatedResponseTimeMin} min</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Workload</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{teamComp.scenarioA.currentWorkload}</div>
                    </div>
                  </div>

                  {/* Strengths */}
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <strong>Key Advantages:</strong>
                    <ul style={{ margin: '0.2rem 0', paddingLeft: '1.2rem' }}>
                      {teamComp.scenarioA.keyStrengths.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Scenario B */}
              {teamComp?.scenarioB && (
                <div
                  className="kg-node-card"
                  style={{
                    padding: '1.2rem',
                    background: 'rgba(234,179,8,0.04)',
                    borderColor: 'rgba(234,179,8,0.2)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <span className="kg-badge kg-badge-active" style={{ marginBottom: '0.3rem', display: 'inline-block' }}>
                        ALTERNATIVE SCENARIO B
                      </span>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {teamComp.scenarioB.teamName}
                      </h3>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {teamComp.scenarioB.department}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#eab308' }}>
                        {teamComp.scenarioB.scores.compositeScore}
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/100</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Simulation Score</div>
                    </div>
                  </div>

                  {/* Core Metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', margin: '0.8rem 0', background: 'rgba(255,255,255,0.02)', padding: '0.6rem', borderRadius: '6px' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Distance</div>
                      <div style={{ fontSize: '1rem', fontWeight: 600 }}>{teamComp.scenarioB.distanceKm} km</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Est. Response</div>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#eab308' }}>{teamComp.scenarioB.estimatedResponseTimeMin} min</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Workload</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{teamComp.scenarioB.currentWorkload}</div>
                    </div>
                  </div>

                  {/* Tradeoffs */}
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <strong>Operational Considerations:</strong>
                    <ul style={{ margin: '0.2rem 0', paddingLeft: '1.2rem' }}>
                      {teamComp.scenarioB.operationalTradeoffs.map((t, idx) => (
                        <li key={idx}>{t}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Verdict Callout */}
            <div style={{ background: 'rgba(255,255,255,0.02)', borderLeft: '3px solid #10b981', padding: '0.75rem', borderRadius: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <strong>Simulation Verdict:</strong> {teamComp?.comparisonVerdict}
              <div style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Under this simulated scenario based on available historical records. The municipal officer retains complete dispatch authority.
              </div>
            </div>
          </div>

          {/* SECTION 2: Response Delay Escalation Curve */}
          <div className="kg-panel">
            <div className="kg-panel-header" style={{ marginBottom: '0.75rem' }}>
              <div>
                <span className="kg-badge kg-badge-type">DELAY IMPACT SIMULATION</span>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                  Consequences of Response Dispatch Latency
                </h2>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '0.75rem' }}>
              {delayAnalysis?.scenarios?.map((ds) => (
                <div key={ds.scenarioId} className="kg-node-card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span className="kg-badge" style={{ background: ds.delayMinutes === 0 ? 'rgba(16,185,129,0.15)' : ds.delayMinutes <= 30 ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)', color: ds.delayMinutes === 0 ? '#10b981' : ds.delayMinutes <= 30 ? '#eab308' : '#ef4444' }}>
                      {ds.delayLabel}
                    </span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      Risk: {ds.simulatedPostDelayRiskScore}/100
                    </span>
                  </div>

                  <div style={{ fontSize: '0.8rem', margin: '0.4rem 0', color: 'var(--text-secondary)' }}>
                    <div><strong>Citizen Exposure:</strong> ~{ds.projectedAffectedCitizens} people affected</div>
                    <div><strong>Cost Escalation:</strong> {ds.costEscalationMultiplier}x baseline expenditure</div>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px', minHeight: '50px' }}>
                    {ds.estimatedSecondaryImpact}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <strong>Takeaway:</strong> {delayAnalysis?.keyTakeaway}
            </div>
          </div>

          {/* SECTION 3: Preventive Strategy vs Reactive Status Quo */}
          {prevComp && (
            <div className="kg-panel">
              <div className="kg-panel-header" style={{ marginBottom: '0.75rem' }}>
                <div>
                  <span className="kg-badge kg-badge-type">CAPITAL STRATEGY SIMULATION</span>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                    Lifecycle ROI: Reactive Emergency Fixing vs Tri-Horizon Preventive Strategy
                  </h2>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                {/* Reactive Model */}
                <div className="kg-node-card" style={{ padding: '1rem', borderLeft: '3px solid #ef4444' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ef4444', marginBottom: '0.4rem' }}>
                    {prevComp.reactiveModel.strategyName}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div><strong>Projected Incidents/Year:</strong> {prevComp.reactiveModel.projectedAnnualIncidents} recurring floods</div>
                    <div><strong>Recurrence Probability:</strong> {Math.round(prevComp.reactiveModel.recurrenceProbability * 100)}%</div>
                    <div><strong>5-Year Municipal Cost:</strong> {prevComp.reactiveModel.projected5YearMunicipalCost}</div>
                    <div><strong>Asset Usable Life:</strong> {prevComp.reactiveModel.predictedAssetLifespanYears} years</div>
                    <div><strong>Citizen Sentiment:</strong> {prevComp.reactiveModel.citizenSatisfactionRating}</div>
                  </div>
                </div>

                {/* Preventive Model */}
                <div className="kg-node-card" style={{ padding: '1rem', borderLeft: '3px solid #10b981' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#10b981', marginBottom: '0.4rem' }}>
                    {prevComp.preventiveModel.strategyName}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div><strong>Projected Incidents/Year:</strong> {prevComp.preventiveModel.projectedAnnualIncidents} isolated events</div>
                    <div><strong>Recurrence Probability:</strong> {Math.round(prevComp.preventiveModel.recurrenceProbability * 100)}% ({prevComp.preventiveModel.riskReductionDelta})</div>
                    <div><strong>5-Year Municipal Cost:</strong> {prevComp.preventiveModel.projected5YearMunicipalCost}</div>
                    <div><strong>Net Taxpayer Savings:</strong> <span style={{ color: '#10b981', fontWeight: 600 }}>{prevComp.preventiveModel.costSavingsEstimated}</span></div>
                    <div><strong>Asset Usable Life:</strong> {prevComp.preventiveModel.predictedAssetLifespanYears} years</div>
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(16,185,129,0.06)', padding: '0.6rem', borderRadius: '4px', fontSize: '0.82rem', color: '#10b981' }}>
                <strong>Strategic Simulation Finding:</strong> {prevComp.conclusion}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
