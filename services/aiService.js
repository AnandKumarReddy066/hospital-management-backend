/**
 * services/aiService.js
 * Google Gemini integration helper — used across AI modules.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

/**
 * Calls Gemini with a system prompt and user message.
 * History is mapped to the Gemini multi-turn format (role: 'user' | 'model').
 */
exports.chat = async (systemPrompt, userMessage, history = []) => {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
  });

  // Map OpenAI-style history to Gemini format
  const geminiHistory = history.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const chat = model.startChat({ history: geminiHistory });

  // Prepend system prompt to the user message for compatibility
  const fullMessage = `${systemPrompt}\n\n${userMessage}`;
  const result = await chat.sendMessage(fullMessage);
  return result.response.text();
};

/**
 * Drug interaction checker.
 */
exports.checkDrugInteraction = async (drugs) => {
  const prompt = `You are a clinical pharmacologist AI. 
  Analyse the following drugs for dangerous interactions: ${drugs.join(', ')}.
  Respond in JSON with: { interactions: [...], severity: 'low|moderate|high', recommendations: [...] }`;

  const result = await exports.chat('You are a medical AI assistant.', prompt);
  try {
    const cleaned = result.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { raw: result };
  }
};
