/**
 * SevaSaathi AI - Stage 19: Municipal What-If Simulator Routes
 */

const express = require('express');
const router = express.Router();
const { evaluateIncidentScenarios } = require('../services/municipalSimulationService');

/**
 * GET /api/simulator/scenarios/:incidentId
 * Retrieve pre-evaluated simulation scenarios for an incident
 */
router.get('/scenarios/:incidentId', async (req, res) => {
  const { incidentId } = req.params;
  try {
    const simulationResult = await evaluateIncidentScenarios(incidentId);
    return res.json({
      success: true,
      simulation: simulationResult,
    });
  } catch (error) {
    console.error(`[Simulator Route] Error evaluating incident ${incidentId}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute municipal simulation',
    });
  }
});

/**
 * POST /api/simulator/evaluate
 * Evaluate scenario on-demand with custom parameters
 */
router.post('/evaluate', async (req, res) => {
  try {
    const { incidentId = 'cluster_drainage_school_road' } = req.body;
    const simulationResult = await evaluateIncidentScenarios(incidentId);
    return res.json({
      success: true,
      simulation: simulationResult,
    });
  } catch (error) {
    console.error('[Simulator Route] Error in on-demand evaluation:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Simulation execution failed',
    });
  }
});

module.exports = router;
