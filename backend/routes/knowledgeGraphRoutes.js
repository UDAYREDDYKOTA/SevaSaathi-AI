/**
 * SevaSaathi AI - Stage 17: Civic Knowledge Graph Routes
 * Exposes knowledge graph query, path traversal, rebuild, and AI interpretation endpoints.
 */

const express = require('express');
const router = express.Router();
const {
  getCivicKnowledgeGraph,
  buildCivicKnowledgeGraph,
  getExplainableIncidentChain,
  interpretGraphStoryWithGemini,
} = require('../services/civicKnowledgeGraphService');

/**
 * GET /api/knowledge-graph
 * Fetches the complete derived Civic Knowledge Graph (nodes, edges, statistics)
 */
router.get('/', async (req, res) => {
  try {
    console.log('[Knowledge Graph Route] Fetching civic knowledge graph...');
    const graph = await getCivicKnowledgeGraph();
    return res.json({
      success: true,
      ...graph,
    });
  } catch (error) {
    console.error('[Knowledge Graph Route] Error fetching graph:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve civic knowledge graph',
    });
  }
});

/**
 * POST /api/knowledge-graph/rebuild
 * Recomputes all deterministic nodes & edges from current municipal ledgers and persists to Firestore
 */
router.post('/rebuild', async (req, res) => {
  try {
    console.log('[Knowledge Graph Route] Rebuilding civic knowledge graph from live ledgers...');
    const graph = await buildCivicKnowledgeGraph();
    return res.json({
      success: true,
      ...graph,
    });
  } catch (error) {
    console.error('[Knowledge Graph Route] Error rebuilding graph:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to rebuild civic knowledge graph',
    });
  }
});

/**
 * GET /api/knowledge-graph/incident/:incidentId
 * Retrieves detailed incident intelligence and deterministic causal path
 */
router.get('/incident/:incidentId', async (req, res) => {
  const { incidentId } = req.params;
  try {
    const graph = await getCivicKnowledgeGraph();
    const chain = getExplainableIncidentChain(graph, incidentId);

    if (!chain) {
      return res.status(404).json({
        success: false,
        error: `Incident node ${incidentId} not found in knowledge graph`,
      });
    }

    return res.json({
      success: true,
      chain,
    });
  } catch (error) {
    console.error(`[Knowledge Graph Route] Error querying incident ${incidentId}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to query incident intelligence',
    });
  }
});

/**
 * GET /api/knowledge-graph/area/:areaId
 * Retrieves subgraph focused on a specific geographic area
 */
router.get('/area/:areaId', async (req, res) => {
  const { areaId } = req.params;
  try {
    const graph = await getCivicKnowledgeGraph();
    const targetArea = (areaId || '').toLowerCase();

    // Filter nodes matching area or connected to area
    const areaNode = graph.nodes.find(
      (n) => n.nodeId.toLowerCase().includes(targetArea) || n.label.toLowerCase().includes(targetArea)
    );

    if (!areaNode) {
      return res.status(404).json({
        success: false,
        error: `Area ${areaId} not found in knowledge graph`,
      });
    }

    // Find edges connected to area
    const connectedEdges = graph.edges.filter(
      (e) => e.sourceNodeId === areaNode.nodeId || e.targetNodeId === areaNode.nodeId
    );
    const connectedNodeIds = new Set([
      areaNode.nodeId,
      ...connectedEdges.map((e) => e.sourceNodeId),
      ...connectedEdges.map((e) => e.targetNodeId),
    ]);

    const filteredNodes = graph.nodes.filter((n) => connectedNodeIds.has(n.nodeId));

    return res.json({
      success: true,
      areaNode,
      nodes: filteredNodes,
      edges: connectedEdges,
    });
  } catch (error) {
    console.error(`[Knowledge Graph Route] Error querying area ${areaId}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to query area subgraph',
    });
  }
});

/**
 * GET /api/knowledge-graph/:nodeId
 * Retrieves single node and its immediate 1-hop neighborhood
 */
router.get('/:nodeId', async (req, res) => {
  const { nodeId } = req.params;
  try {
    const graph = await getCivicKnowledgeGraph();
    const targetNode = graph.nodes.find((n) => n.nodeId === nodeId);

    if (!targetNode) {
      return res.status(404).json({
        success: false,
        error: `Node ${nodeId} not found in knowledge graph`,
      });
    }

    const connectedEdges = graph.edges.filter(
      (e) => e.sourceNodeId === nodeId || e.targetNodeId === nodeId
    );
    const neighborIds = new Set([
      ...connectedEdges.map((e) => e.sourceNodeId),
      ...connectedEdges.map((e) => e.targetNodeId),
    ]);
    const neighborNodes = graph.nodes.filter((n) => neighborIds.has(n.nodeId));

    return res.json({
      success: true,
      node: targetNode,
      neighbors: neighborNodes,
      edges: connectedEdges,
    });
  } catch (error) {
    console.error(`[Knowledge Graph Route] Error querying node ${nodeId}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to query node',
    });
  }
});

/**
 * POST /api/knowledge-graph/interpret
 * AI Graph Interpretation with Gemini for a selected incident chain
 */
router.post('/interpret', async (req, res) => {
  const { incidentId } = req.body;
  try {
    console.log(`[Knowledge Graph Route] Running AI graph interpretation for: ${incidentId || 'default'}`);
    const graph = await getCivicKnowledgeGraph();
    const chain = getExplainableIncidentChain(graph, incidentId);

    if (!chain) {
      return res.status(404).json({
        success: false,
        error: 'Unable to traverse causal path for requested incident',
      });
    }

    const aiResult = await interpretGraphStoryWithGemini(chain);

    return res.json({
      success: true,
      incidentId: chain.incident.properties?.incidentId || chain.incident.nodeId,
      chain,
      aiInterpretation: aiResult,
    });
  } catch (error) {
    console.error('[Knowledge Graph Route] Error in AI graph interpretation:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate AI graph interpretation',
    });
  }
});

module.exports = router;
