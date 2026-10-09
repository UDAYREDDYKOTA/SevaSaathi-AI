/**
 * SevaSaathi AI - Stage 18: Preventive Action Planner Routes
 */

const express = require('express');
const router = express.Router();
const {
  getAllPreventiveActionPlans,
  getPreventiveActionPlanById,
  buildPreventiveActionPlan,
  updatePlanOfficerStatus,
} = require('../services/preventiveActionPlannerService');

/**
 * GET /api/preventive-planner
 * Retrieve all preventive action plans
 */
router.get('/', async (req, res) => {
  try {
    const plans = await getAllPreventiveActionPlans();
    return res.json({
      success: true,
      count: plans.length,
      plans,
      disclaimer: 'AI advisory based on available municipal records. Officer review required.',
    });
  } catch (error) {
    console.error('[Preventive Planner Route] Error listing plans:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve preventive action plans',
    });
  }
});

/**
 * GET /api/preventive-planner/:planId
 * Retrieve specific plan by ID
 */
router.get('/:planId', async (req, res) => {
  const { planId } = req.params;
  try {
    const plan = await getPreventiveActionPlanById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: `Plan ${planId} not found`,
      });
    }
    return res.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error(`[Preventive Planner Route] Error fetching plan ${planId}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve plan',
    });
  }
});

/**
 * POST /api/preventive-planner/generate
 * Trigger deterministic plan generation for an incident / area
 */
router.post('/generate', async (req, res) => {
  try {
    const { incidentId, areaName, category, riskAssessment } = req.body;
    const plan = await buildPreventiveActionPlan({
      incidentId,
      areaName,
      category,
      riskAssessment,
    });
    return res.json({
      success: true,
      plan,
      message: 'Preventive Action Plan generated successfully and queued for Officer Review.',
    });
  } catch (error) {
    console.error('[Preventive Planner Route] Error generating plan:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate preventive action plan',
    });
  }
});

/**
 * POST /api/preventive-planner/:planId/status
 * Officer decision update (ACKNOWLEDGED, APPROVED, REJECTED, COMPLETED)
 */
router.post('/:planId/status', async (req, res) => {
  const { planId } = req.params;
  const { status, approvedBy, notes } = req.body;
  try {
    const updatedPlan = await updatePlanOfficerStatus(planId, {
      status,
      approvedBy,
      notes,
    });
    return res.json({
      success: true,
      plan: updatedPlan,
      message: `Plan status updated to ${status}.`,
    });
  } catch (error) {
    console.error(`[Preventive Planner Route] Error updating status for ${planId}:`, error.message);
    return res.status(400).json({
      success: false,
      error: error.message || 'Failed to update plan status',
    });
  }
});

module.exports = router;
