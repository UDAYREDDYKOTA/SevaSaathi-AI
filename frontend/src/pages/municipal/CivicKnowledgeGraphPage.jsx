import React, { useState, useEffect, useCallback } from 'react';
import {
  Network,
  BrainCircuit,
  TrendingUp,
  Layers,
  ShieldAlert,
  Sparkles,
  RotateCcw,
  FileText,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Users2,
  Activity,
  Flame,
  ChevronRight,
  ShieldCheck,
  Search,
  Filter,
  Info,
} from 'lucide-react';
import {
  fetchCivicKnowledgeGraph,
  rebuildCivicKnowledgeGraph,
  fetchIncidentIntelligence,
  requestAiGraphInterpretation,
} from '../../services/aiService';

// Node Type Color Badges
const NODE_TYPE_STYLES = {
  INCIDENT: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: AlertTriangle },
  REPORT: { color: '#475569', bg: '#f1f5f9', border: '#cbd5e1', icon: FileText },
  LOCATION: { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', icon: MapPin },
  CIVIC_PROBLEM: { color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: Activity },
  ROOT_CAUSE: { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: BrainCircuit },
  DEPARTMENT: { color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', icon: Layers },
  RESPONSE_TEAM: { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', icon: Users2 },
  RESOLUTION: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: CheckCircle2 },
  PREDICTIVE_RISK: { color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', icon: Flame },
  RECURRENCE_PATTERN: { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', icon: TrendingUp },
};

export default function CivicKnowledgeGraphPage() {
  const [graphData, setGraphData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [error, setError] = useState(null);

  // Filter & Search
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);

  // Incident Intelligence & Causal Path
  const [selectedIncidentId, setSelectedIncidentId] = useState('cluster_drainage_school_road');
  const [incidentIntelligence, setIncidentIntelligence] = useState(null);
  const [isIntelLoading, setIsIntelLoading] = useState(false);

  // AI Graph Narrative
  const [aiStory, setAiStory] = useState(null);
  const [isAiSynthesizing, setIsAiSynthesizing] = useState(false);

  // Load Graph Data
  const loadGraph = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCivicKnowledgeGraph();
      if (data?.nodes) {
        setGraphData(data);
        // Find default selected incident node
        const defaultInc =
          data.nodes.find((n) => n.nodeType === 'INCIDENT' && n.label.toLowerCase().includes('drainage')) ||
          data.nodes.find((n) => n.nodeType === 'INCIDENT');
        if (defaultInc) {
          setSelectedNode(defaultInc);
          setSelectedIncidentId(defaultInc.nodeId);
        }
      }
    } catch (err) {
      console.error('Failed to load civic knowledge graph:', err);
      setError('Unable to load civic knowledge graph. Ensure backend service is operational.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const data = await fetchCivicKnowledgeGraph();
        if (isMounted && data?.nodes) {
          setGraphData(data);
          const defaultInc =
            data.nodes.find((n) => n.nodeType === 'INCIDENT' && n.label.toLowerCase().includes('drainage')) ||
            data.nodes.find((n) => n.nodeType === 'INCIDENT');
          if (defaultInc) {
            setSelectedNode(defaultInc);
            setSelectedIncidentId(defaultInc.nodeId);
          }
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to init civic knowledge graph:', err);
          setError('Unable to load civic knowledge graph. Ensure backend service is operational.');
          setIsLoading(false);
        }
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load Incident Intelligence when selectedIncidentId changes
  const loadIncidentIntel = useCallback(async (incId) => {
    if (!incId) return;
    setIsIntelLoading(true);
    setAiStory(null);
    try {
      const intel = await fetchIncidentIntelligence(incId);
      if (intel?.chain) {
        setIncidentIntelligence(intel.chain);
      }
    } catch (err) {
      console.warn('Failed to load incident intelligence chain:', err);
    } finally {
      setIsIntelLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (selectedIncidentId) {
      fetchIncidentIntelligence(selectedIncidentId)
        .then((intel) => {
          if (isMounted && intel?.chain) {
            setIncidentIntelligence(intel.chain);
            setIsIntelLoading(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.warn('Failed to load incident intelligence chain:', err);
            setIsIntelLoading(false);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [selectedIncidentId]);

  // Trigger Rebuild
  const handleRebuild = async () => {
    setIsRebuilding(true);
    try {
      const data = await rebuildCivicKnowledgeGraph();
      if (data?.nodes) {
        setGraphData(data);
        if (selectedIncidentId) {
          loadIncidentIntel(selectedIncidentId);
        }
      }
    } catch (err) {
      console.error('Failed to rebuild knowledge graph:', err);
      setError('Failed to rebuild graph from source ledgers.');
    } finally {
      setIsRebuilding(false);
    }
  };

  // Trigger AI Graph Interpretation
  const handleSynthesizeAiStory = async () => {
    if (!selectedIncidentId) return;
    setIsAiSynthesizing(true);
    try {
      const res = await requestAiGraphInterpretation(selectedIncidentId);
      if (res?.aiInterpretation) {
        setAiStory(res.aiInterpretation);
      }
    } catch (err) {
      console.error('Failed to synthesize AI graph story:', err);
    } finally {
      setIsAiSynthesizing(false);
    }
  };

  // Handle Node Selection
  const handleSelectNode = (node) => {
    setSelectedNode(node);
    if (node.nodeType === 'INCIDENT') {
      setSelectedIncidentId(node.nodeId);
    } else if (node.nodeType === 'REPORT') {
      // Find parent incident
      const edge = graphData?.edges?.find(
        (e) => e.sourceNodeId === node.nodeId && e.relationship === 'RELATED_TO'
      );
      if (edge) {
        setSelectedIncidentId(edge.targetNodeId);
      }
    }
  };

  // Filtered nodes
  const filteredNodes = (graphData?.nodes || []).filter((n) => {
    const matchesType = selectedTypeFilter === 'ALL' || n.nodeType === selectedTypeFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.nodeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.nodeType.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Connected edges for selected node
  const connectedEdges = selectedNode
    ? (graphData?.edges || []).filter(
        (e) => e.sourceNodeId === selectedNode.nodeId || e.targetNodeId === selectedNode.nodeId
      )
    : [];

  const stats = graphData?.statistics || {};

  return (
    <div className="municipal-page animate-fade-in">
      {/* Simulation Watermark Banner */}
      <div className="demo-sim-alert-banner">
        <ShieldAlert size={16} />
        <span>DEMO ENVIRONMENT — SIMULATED MUNICIPAL DATA</span>
      </div>

      {/* Module Header */}
      <div className="module-header">
        <div className="module-title-wrap">
          <div className="module-pretitle">
            <Network size={16} />
            <span>Civic Intelligence Network &middot; Stage 17</span>
          </div>
          <h1 className="module-title">CIVIC KNOWLEDGE GRAPH</h1>
          <p className="module-description">
            Deterministic relational graph connecting citizen reports, incident clusters, locations, root causes, departments, response teams, resolutions, recurrence patterns, and predictive risk.
          </p>
        </div>

        <div className="module-actions-row">
          <button
            type="button"
            onClick={handleRebuild}
            disabled={isRebuilding || isLoading}
            className="btn btn-secondary"
            title="Rebuild derived graph topology from active Firestore ledgers"
          >
            <RotateCcw size={15} className={isRebuilding ? 'animate-spin' : ''} />
            <span>{isRebuilding ? 'Rebuilding…' : 'Rebuild Graph'}</span>
          </button>

          <button
            type="button"
            onClick={handleSynthesizeAiStory}
            disabled={isAiSynthesizing || isIntelLoading}
            className="btn btn-primary"
            title="Synthesize AI narrative interpretation strictly from graph topology"
          >
            <Sparkles size={15} className={isAiSynthesizing ? 'animate-spin' : ''} />
            <span>{isAiSynthesizing ? 'Synthesizing…' : 'AI Narrative Synthesis'}</span>
          </button>
        </div>
      </div>

      {/* THREE CONNECTED INTELLIGENCE LAYERS BANNER */}
      <div className="kg-pipeline-strip">
        <div className="pipeline-item">
          <div className="pipeline-dot memory">1</div>
          <div className="pipeline-info">
            <span className="pipeline-tag">STAGE 13: CIVIC MEMORY</span>
            <strong>What happened repeatedly?</strong>
            <span className="pipeline-sub">Chronic historical defect catalogs</span>
          </div>
        </div>

        <ChevronRight size={18} color="var(--navy-400)" />

        <div className="pipeline-item active">
          <div className="pipeline-dot kg">2</div>
          <div className="pipeline-info">
            <span className="pipeline-tag">STAGE 17: KNOWLEDGE GRAPH</span>
            <strong>How are entities connected?</strong>
            <span className="pipeline-sub">Deterministic relational topology</span>
          </div>
        </div>

        <ChevronRight size={18} color="var(--navy-400)" />

        <div className="pipeline-item">
          <div className="pipeline-dot risk">3</div>
          <div className="pipeline-info">
            <span className="pipeline-tag">STAGE 16: PREDICTIVE RISK</span>
            <strong>Where will failures recur?</strong>
            <span className="pipeline-sub">Deterministic forward risk forecasting</span>
          </div>
        </div>
      </div>

      {/* TOP STATISTICS METRICS BAR */}
      <div className="kg-stats-grid">
        <div className="kg-stat-card">
          <div className="stat-card-icon network">
            <Network size={20} />
          </div>
          <div className="stat-card-body">
            <span className="kg-stat-label">Graph Topology</span>
            <strong className="kg-stat-val">
              {stats.totalNodes || 0} Nodes &middot; {stats.totalRelationships || 0} Edges
            </strong>
            <span className="kg-stat-sub">100% deterministic relationships</span>
          </div>
        </div>

        <div className="kg-stat-card">
          <div className="stat-card-icon area">
            <MapPin size={20} />
          </div>
          <div className="stat-card-body">
            <span className="kg-stat-label">Most Connected Area</span>
            <strong className="kg-stat-val text-truncate">{stats.mostConnectedArea || 'Loading…'}</strong>
            <span className="kg-stat-sub">Highest degree centrality</span>
          </div>
        </div>

        <div className="kg-stat-card">
          <div className="stat-card-icon department">
            <Layers size={20} />
          </div>
          <div className="stat-card-body">
            <span className="kg-stat-label">Most Impacted Dept</span>
            <strong className="kg-stat-val text-truncate">{stats.mostAffectedDepartment || 'Loading…'}</strong>
            <span className="kg-stat-sub">Team: {stats.mostReusedTeam || 'Rapid Response'}</span>
          </div>
        </div>

        <div className="kg-stat-card">
          <div className="stat-card-icon risk">
            <Flame size={20} />
          </div>
          <div className="stat-card-body">
            <span className="kg-stat-label">Highest-Risk Corridor</span>
            <strong className="kg-stat-val text-truncate">{stats.highestRiskArea || 'Loading…'}</strong>
            <span className="kg-stat-sub">Predictive Risk: 95/100 CRITICAL</span>
          </div>
        </div>
      </div>

      {/* MAIN KNOWLEDGE GRAPH WORKSPACE: SPLIT CONSOLE */}
      {isLoading ? (
        <div className="worker-empty-card">
          <Activity size={28} className="animate-spin" color="var(--civic-blue)" />
          <p>Compiling deterministic civic knowledge graph topology from municipal ledgers…</p>
        </div>
      ) : error ? (
        <div className="worker-empty-card error">
          <AlertTriangle size={28} color="#dc2626" />
          <p>{error}</p>
          <button type="button" onClick={loadGraph} className="btn btn-secondary">
            Retry Connection
          </button>
        </div>
      ) : (
        <div className="kg-console-grid">
          {/* LEFT PANEL: NODE EXPLORER & RELATIONSHIP TOPOLOGY */}
          <section className="kg-explorer-panel" aria-label="Knowledge Graph Explorer">
            {/* Explorer Controls: Type Pills & Search */}
            <div className="kg-controls-bar">
              <div className="kg-search-wrap">
                <Search size={15} color="var(--navy-400)" />
                <input
                  type="text"
                  placeholder="Filter nodes by ID, label, or category…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="kg-search-input"
                  id="kg-search-input"
                />
              </div>

              {/* Node Type Filter Tabs */}
              <div className="kg-type-filter-tabs">
                {[
                  { key: 'ALL', label: 'All Nodes' },
                  { key: 'INCIDENT', label: 'Incidents' },
                  { key: 'REPORT', label: 'Reports' },
                  { key: 'LOCATION', label: 'Locations' },
                  { key: 'CIVIC_PROBLEM', label: 'Problems' },
                  { key: 'ROOT_CAUSE', label: 'Causes' },
                  { key: 'DEPARTMENT', label: 'Depts' },
                  { key: 'RESPONSE_TEAM', label: 'Teams' },
                  { key: 'RESOLUTION', label: 'Resolutions' },
                  { key: 'RECURRENCE_PATTERN', label: 'Recurrence' },
                  { key: 'PREDICTIVE_RISK', label: 'Risks' },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setSelectedTypeFilter(t.key)}
                    className={`kg-type-tab-btn ${selectedTypeFilter === t.key ? 'active' : ''}`}
                  >
                    <span>{t.label}</span>
                    <span className="type-count-badge">
                      {t.key === 'ALL'
                        ? graphData?.nodes?.length || 0
                        : stats.nodeBreakdown?.[t.key] || 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Topology Matrix / Node Cards */}
            <div className="kg-nodes-matrix">
              <div className="matrix-header-row">
                <span className="matrix-title">
                  <Filter size={13} />
                  <span>
                    Indexed Entities ({filteredNodes.length} of {graphData?.nodes?.length || 0})
                  </span>
                </span>
                <span className="matrix-hint">Click any entity to inspect causal connections</span>
              </div>

              <div className="kg-nodes-cards-container">
                {filteredNodes.map((node) => {
                  const style = NODE_TYPE_STYLES[node.nodeType] || NODE_TYPE_STYLES.INCIDENT;
                  const Icon = style.icon;
                  const isSelected = selectedNode?.nodeId === node.nodeId;

                  return (
                    <div
                      key={node.nodeId}
                      className={`kg-node-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectNode(node)}
                    >
                      <div className="node-card-top">
                        <span
                          className="node-type-pill"
                          style={{
                            color: style.color,
                            backgroundColor: style.bg,
                            borderColor: style.border,
                          }}
                        >
                          <Icon size={12} />
                          <span>{node.nodeType.replace('_', ' ')}</span>
                        </span>
                        <span className="node-id-mono">{node.nodeId}</span>
                      </div>

                      <strong className="node-label">{node.label}</strong>

                      {/* Node Metadata Badges */}
                      <div className="node-properties-row">
                        {node.properties?.status && (
                          <span className="prop-chip status">{node.properties.status}</span>
                        )}
                        {node.properties?.priority && (
                          <span className={`prop-chip priority ${node.properties.priority.toLowerCase()}`}>
                            {node.properties.priority}
                          </span>
                        )}
                        {node.properties?.category && (
                          <span className="prop-chip category">{node.properties.category}</span>
                        )}
                        {node.properties?.riskScore && (
                          <span className="prop-chip risk">
                            Risk: {node.properties.riskScore}/100
                          </span>
                        )}
                        {node.properties?.confidence && (
                          <span className="prop-chip confidence">
                            Conf: {Math.round(node.properties.confidence * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SELECTED NODE RELATIONSHIPS / EDGES INSPECTOR */}
            {selectedNode && (
              <div className="kg-edge-inspector-box">
                <div className="inspector-header">
                  <div className="inspector-title-wrap">
                    <Network size={16} color="var(--civic-blue)" />
                    <h4>
                      Connected Edges for: <strong>{selectedNode.label}</strong>
                    </h4>
                  </div>
                  <span className="edge-count-tag">{connectedEdges.length} Active Relationships</span>
                </div>

                <div className="inspector-edges-list">
                  {connectedEdges.length === 0 ? (
                    <p className="no-edges-text">No active edges attached to this entity.</p>
                  ) : (
                    connectedEdges.map((edge) => {
                      const isOutgoing = edge.sourceNodeId === selectedNode.nodeId;
                      const otherNodeId = isOutgoing ? edge.targetNodeId : edge.sourceNodeId;
                      const otherNode = graphData?.nodes?.find((n) => n.nodeId === otherNodeId);
                      const otherStyle = NODE_TYPE_STYLES[otherNode?.nodeType] || NODE_TYPE_STYLES.INCIDENT;

                      return (
                        <div key={edge.edgeId} className="kg-edge-row">
                          <div className="edge-direction-badge">
                            <span className="direction-arrow">{isOutgoing ? '➔' : '⬅'}</span>
                            <span className="rel-tag">{edge.relationship.replace(/_/g, ' ')}</span>
                          </div>

                          <div className="edge-target-node">
                            <span
                              className="target-type-badge"
                              style={{
                                color: otherStyle.color,
                                backgroundColor: otherStyle.bg,
                                borderColor: otherStyle.border,
                              }}
                            >
                              {otherNode?.nodeType || 'ENTITY'}
                            </span>
                            <span className="target-label">
                              {otherNode?.label || otherNodeId}
                            </span>
                          </div>

                          <div className="edge-confidence-badge">
                            <span>{Math.round(edge.confidence * 100)}% Conf</span>
                          </div>

                          {/* Edge Audited Evidence */}
                          {edge.evidence && edge.evidence.length > 0 && (
                            <div className="edge-evidence-snippet">
                              <span className="ev-source">Source: {edge.source}</span>
                              <span className="ev-text">&middot; {edge.evidence[0]}</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </section>

          {/* RIGHT PANEL: INCIDENT INTELLIGENCE & EXPLAINABLE CAUSAL CHAIN */}
          <aside className="kg-intelligence-panel" aria-label="Incident Intelligence Story">
            <div className="intel-panel-header">
              <div className="intel-header-top">
                <BrainCircuit size={18} color="var(--ai-cyan)" />
                <span className="intel-pretitle">INCIDENT INTELLIGENCE</span>
              </div>
              <h3 className="intel-main-title">
                {incidentIntelligence?.incident?.label || 'Incident Intelligence Console'}
              </h3>
              <p className="intel-subtext">
                Traversed causal path explaining root cause, department routing, field resolution, repeat recurrence, and elevated risk.
              </p>
            </div>

            {isIntelLoading ? (
              <div className="worker-empty-card mini">
                <Activity size={22} className="animate-spin" color="var(--civic-blue)" />
                <p>Traversing causal graph chain for selected incident…</p>
              </div>
            ) : !incidentIntelligence ? (
              <div className="worker-empty-card mini">
                <Info size={22} color="var(--navy-500)" />
                <p>Select an incident in the left matrix to review its causal intelligence chain.</p>
              </div>
            ) : (
              <div className="intel-content-scroll">
                {/* 1. INCIDENT OVERVIEW CARD */}
                <div className="intel-card incident-card">
                  <div className="intel-card-top">
                    <span className="incident-id-badge">
                      {incidentIntelligence.incident.properties?.incidentId || incidentIntelligence.incident.nodeId}
                    </span>
                    <span className="incident-status-tag">
                      {incidentIntelligence.incident.properties?.status || 'Active'}
                    </span>
                  </div>

                  <div className="intel-key-value-grid">
                    <div className="kv-item">
                      <span className="kv-lbl">Location:</span>
                      <strong className="kv-val">{incidentIntelligence.location?.label || 'School Road'}</strong>
                    </div>
                    <div className="kv-item">
                      <span className="kv-lbl">Problem:</span>
                      <span className="kv-val">{incidentIntelligence.problem?.label || 'Waterlogging'}</span>
                    </div>
                    <div className="kv-item">
                      <span className="kv-lbl">Connected Reports:</span>
                      <span className="kv-val highlight">
                        {incidentIntelligence.connectedReports?.length || 0} Fused Reports
                      </span>
                    </div>
                    <div className="kv-item">
                      <span className="kv-lbl">Assigned Team:</span>
                      <span className="kv-val">{incidentIntelligence.team?.label || 'Rapid Response Unit'}</span>
                    </div>
                  </div>

                  {/* Connected Reports Chips */}
                  <div className="fused-reports-chips-wrap">
                    <span className="chips-label">Fused Report IDs:</span>
                    <div className="chips-row">
                      {incidentIntelligence.connectedReports?.map((r, i) => (
                        <span key={i} className="fused-id-chip">
                          {r.reportId}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. PROBABLE ROOT CAUSE CARD */}
                <div className="intel-card root-cause-card">
                  <div className="card-sub-header">
                    <BrainCircuit size={15} color="#7c3aed" />
                    <h4>Probable Root Cause</h4>
                    <span className="conf-pill">
                      {Math.round((incidentIntelligence.rootCause?.properties?.confidence || 0.92) * 100)}% Conf
                    </span>
                  </div>
                  <p className="cause-text">{incidentIntelligence.rootCause?.label}</p>
                </div>

                {/* 3. RESOLUTION & RECURRENCE EVIDENCE */}
                <div className="intel-card resolution-card">
                  <div className="card-sub-header">
                    <CheckCircle2 size={15} color="#059669" />
                    <h4>Resolution & Repeat Recurrence</h4>
                  </div>
                  <div className="res-flow-line">
                    <strong>Past Field Action:</strong> {incidentIntelligence.resolution?.label}
                  </div>
                  <div className="rec-flow-line">
                    <AlertTriangle size={14} color="#ea580c" />
                    <span>
                      <strong>Recurred Despite Resolution:</strong>{' '}
                      {incidentIntelligence.recurrence?.label || 'Repeated waterlogging recurred over 3 months.'}
                    </span>
                  </div>
                </div>

                {/* 4. PREDICTIVE CIVIC RISK ELEVATION */}
                {incidentIntelligence.predictiveRisk && (
                  <div className="intel-card risk-card">
                    <div className="card-sub-header">
                      <Flame size={15} color="#dc2626" />
                      <h4>Elevated Predictive Civic Risk</h4>
                      <span className="risk-level-badge">
                        {incidentIntelligence.predictiveRisk.properties?.riskLevel || 'CRITICAL'} &middot;{' '}
                        {incidentIntelligence.predictiveRisk.properties?.riskScore || 95}/100
                      </span>
                    </div>
                    <p className="risk-statement">
                      Chronic recurrence pattern across 3 months elevated this corridor to{' '}
                      <strong>{incidentIntelligence.predictiveRisk.properties?.riskLevel || 'CRITICAL'} Future Risk</strong>.
                    </p>
                  </div>
                )}

                {/* 5. 8-STEP EXPLAINABLE CAUSAL CHAIN */}
                <div className="intel-causal-chain-box">
                  <div className="chain-title-row">
                    <Layers size={15} color="var(--civic-blue)" />
                    <h4>Deterministic 8-Step Causal Chain</h4>
                  </div>

                  <div className="chain-steps-list">
                    {incidentIntelligence.chainNarrative?.map((step) => (
                      <div key={step.step} className="chain-step-row">
                        <div className="chain-num">{step.step}</div>
                        <div className="chain-step-body">
                          <strong className="chain-step-title">{step.title}</strong>
                          <p className="chain-step-desc">{step.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 6. AI GRAPH INTERPRETATION NARRATIVE */}
                <div className="intel-card ai-story-card">
                  <div className="card-sub-header">
                    <Sparkles size={16} color="var(--ai-cyan)" />
                    <h4>AI Graph Story & Officer Advisory</h4>
                    <span className="ai-badge">Gemini Advisory</span>
                  </div>

                  {isAiSynthesizing ? (
                    <div className="ai-loading-box">
                      <Sparkles size={18} className="animate-spin" color="var(--ai-cyan)" />
                      <span>Synthesizing connected narrative from graph nodes…</span>
                    </div>
                  ) : aiStory ? (
                    <div className="ai-story-content">
                      <p className="ai-story-summary">{aiStory.summary}</p>

                      <div className="ai-story-section">
                        <span className="ai-section-title">Why it recurred after resolution:</span>
                        <p className="ai-section-text">{aiStory.recurrenceExplanation}</p>
                      </div>

                      <div className="ai-story-section">
                        <span className="ai-section-title">Forward Risk Explanation:</span>
                        <p className="ai-section-text">{aiStory.riskExplanation}</p>
                      </div>

                      <div className="ai-story-section highlight">
                        <span className="ai-section-title">Recommended Officer Focus:</span>
                        <p className="ai-section-text">{aiStory.recommendedOfficerFocus}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="ai-prompt-box">
                      <p>Click below to generate Gemini AI narrative analysis of this causal chain:</p>
                      <button
                        type="button"
                        onClick={handleSynthesizeAiStory}
                        className="btn btn-secondary btn-sm"
                      >
                        <Sparkles size={14} />
                        <span>Synthesize AI Narrative</span>
                      </button>
                    </div>
                  )}

                  <div className="card-disclaimer-note">
                    <ShieldCheck size={13} />
                    <span>AI interpretation grounded strictly in audited graph evidence.</span>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Mandatory Advisory Notice */}
      <div className="kg-bottom-disclaimer">
        <ShieldAlert size={15} />
        <span>
          <strong>Municipal Trust Notice:</strong> AI-assisted civic relationship analysis based on available municipal records. Not an official government knowledge base. Demonstrates derived causal topologies across Stages 1–17.
        </span>
      </div>
    </div>
  );
}
