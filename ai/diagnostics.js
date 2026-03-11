/**
 * ai/diagnostics.js
 * AI-powered symptom analysis, NLP disease suggestion, and department routing.
 */

const aiService = require('../services/aiService');

const SYSTEM_PROMPT = `You are an expert clinical triage AI assistant.
IMPORTANT: You are NOT a substitute for a real doctor.
Your job is to analyse the patient's symptoms (provided as text extracted from voice or typing) using NLP.
You must provide your analysis in STRICT JSON format with exactly these four keys:
1. "condition": (string) The single most likely medical condition or disease based on the symptoms.
2. "urgency": (string) Must be one of: "emergency", "urgent", or "non-urgent".
3. "recommendedDepartment": (string) The exact recommended hospital department. Choose the MOST APPROPRIATE one from this list: "Cardiology", "Neurology", "Orthopedics", "General Medicine", "Pediatrics", "Gynecology", "Dermatology", "Psychiatry", "ENT", "Ophthalmology", "Emergency", or "Other".
4. "advice": (string) Actionable advice or self-care tips while the patient waits for a doctor.

Example JSON output:
{
  "condition": "Migraine",
  "urgency": "non-urgent",
  "recommendedDepartment": "Neurology",
  "advice": "Rest in a quiet, dark room. Apply a cold compress to your forehead and stay hydrated."
}`;

/**
 * analyseSymptoms — Takes a symptom description string and returns AI analysis.
 * @param {string} symptoms
 */
exports.analyseSymptoms = async (symptoms) => {
  if (!symptoms || symptoms.trim() === '') {
    throw new Error('Symptom description is required');
  }

  const userMessage = `Patient symptoms: "${symptoms}"`;

  const rawResponse = await aiService.chat(SYSTEM_PROMPT, userMessage);

  try {
    // Clean potential markdown formatting (e.g. ```json \n {...} \n ```)
    const jsonStr = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(jsonStr);
    
    // Ensure fallback defaults if the AI missed something
    return {
      condition: result.condition || 'Unknown Condition',
      urgency: result.urgency || 'non-urgent',
      recommendedDepartment: result.recommendedDepartment || 'General Medicine',
      advice: result.advice || 'Please consult a doctor for a proper evaluation.'
    };
  } catch (err) {
    // Fallback if parsing completely fails
    return { 
      condition: 'Analysis Pending', 
      urgency: 'non-urgent',
      recommendedDepartment: 'General Medicine',
      advice: rawResponse 
    };
  }
};
