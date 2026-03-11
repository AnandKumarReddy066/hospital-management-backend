/**
 * ai/reportAnalyser.js
 * AI-powered medical report analysis module.
 * Analyses lab/radiology reports and extracts key findings.
 */

const aiService = require('../services/aiService');
const MedicalReport = require('../models/MedicalReport');

const SYSTEM_PROMPT = `You are a medical report analysis AI.
Analyse medical reports (blood tests, imaging, lab results) and:
1. Summarise key findings in plain language
2. Flag abnormal values with explanation
3. Assess risk level (low / moderate / high)
4. Suggest follow-up actions

Respond in JSON with: { summary, findings (array), riskLevel, followUpActions (array), disclaimer }.
ALWAYS include a disclaimer that this is AI-assisted and not a clinical diagnosis.`;

/**
 * analyse — analyses a medical report using its text or metadata.
 * For images/PDFs, in production you would send the file as base64 to GPT-4o vision.
 */
exports.analyse = async (reportId, fileUrl) => {
  const userMessage = `Analyse the medical report at: ${fileUrl}.
  Provide a structured JSON analysis.`;

  const rawResult = await aiService.chat(SYSTEM_PROMPT, userMessage);

  let analysis;
  try {
    analysis = JSON.parse(rawResult);
  } catch {
    analysis = { summary: rawResult };
  }

  // Persist the AI analysis back to the MedicalReport document
  if (reportId) {
    await MedicalReport.findByIdAndUpdate(reportId, {
      aiAnalysis: {
        summary:    analysis.summary || '',
        findings:   analysis.findings || [],
        risk:       analysis.riskLevel?.toLowerCase() || 'low',
        analysedAt: new Date(),
      },
    });
  }

  return analysis;
};
