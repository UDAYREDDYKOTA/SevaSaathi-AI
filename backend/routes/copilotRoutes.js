/**
 * SevaSaathi AI - Stage 21: Municipal AI Copilot Routes
 */

const express = require('express');
const router = express.Router();
const { queryMunicipalCopilot, SUGGESTED_QUESTIONS } = require('../services/municipalCopilotService');

/**
 * GET /api/copilot/suggested-questions
 * Retrieve suggested questions for the officer
 */
router.get('/suggested-questions', (req, res) => {
  return res.json({
    success: true,
    questions: SUGGESTED_QUESTIONS,
  });
});

/**
 * POST /api/copilot/query
 * Process officer question through the grounded Municipal Copilot
 */
router.post('/query', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Question is required and must be a non-empty string.',
      });
    }

    const answer = await queryMunicipalCopilot(question);
    return res.json({
      success: true,
      answer,
    });
  } catch (error) {
    console.error('[Copilot Route] Error processing question:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Municipal Copilot failed to process request.',
    });
  }
});

module.exports = router;
