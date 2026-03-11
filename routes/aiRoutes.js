/**
 * routes/aiRoutes.js
 * AI-powered features: symptom checker, report analysis, chatbot.
 */

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const aiService = require('../services/aiService');
const aiDiagnostics = require('../ai/diagnostics');
const aiChatbot     = require('../ai/chatbot');
const aiReportAnalyser = require('../ai/reportAnalyser');

router.use(protect);

// Symptom-based preliminary diagnosis
router.post('/symptoms', async (req, res, next) => {
  try {
    const result = await aiDiagnostics.analyseSymptoms(req.body.symptoms);
    res.json({ success: true, data: result });
  } catch(err) { next(err); }
});

// Medical report analysis (image / PDF)
router.post('/analyse-report', async (req, res, next) => {
  try {
    const result = await aiReportAnalyser.analyse(req.body.reportId, req.body.fileUrl);
    res.json({ success: true, data: result });
  } catch(err) { next(err); }
});

// AI Chatbot for healthcare Q&A
router.post('/chat', async (req, res, next) => {
  try {
    const reply = await aiChatbot.chat(req.user._id, req.body.message, req.body.history);
    res.json({ success: true, data: { reply } });
  } catch(err) { next(err); }
});

// Drug interaction checker
router.post('/drug-interaction', async (req, res, next) => {
  try {
    const result = await aiService.checkDrugInteraction(req.body.drugs);
    res.json({ success: true, data: result });
  } catch(err) { next(err); }
});

module.exports = router;
