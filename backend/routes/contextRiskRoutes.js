/**
 * SevaSaathi AI - Stage 20: Context-Aware Civic Risk Routes
 */

const express = require('express');
const router = express.Router();
const { evaluateAllContextRisks, getContextRiskByAreaId } = require('../services/contextRiskService');

/**
 * GET /api/context-risk
 * Retrieve context risk assessment across all monitored municipal corridors
 */
router.get('/', async (req, res) => {
  try {
    const report = await evaluateAllContextRisks();
    return res.json({
      success: true,
      ...report,
    });
  } catch (error) {
    console.error('[Context Risk Route] Error fetching context risk:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve context risk intelligence',
    });
  }
});

/**
 * GET /api/context-risk/:areaId
 * Retrieve contextual risk for specific corridor
 */
router.get('/:areaId', async (req, res) => {
  const { areaId } = req.params;
  try {
    const corridor = await getContextRiskByAreaId(areaId);
    return res.json({
      success: true,
      corridor,
    });
  } catch (error) {
    console.error(`[Context Risk Route] Error fetching corridor ${areaId}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Corridor contextual assessment failed',
    });
  }
});

module.exports = router;
