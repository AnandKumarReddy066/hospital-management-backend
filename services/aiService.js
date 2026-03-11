/**
 * services/aiService.js
 * OpenAI integration helper — used across AI modules.
 */

const { OpenAI } = require('openai');
const logger = require('../utils/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'sk-dummy-key-for-local-dev-123' });

/**
 * Calls GPT-4 with a system prompt and user message.
 */
exports.chat = async (systemPrompt, userMessage, history = []) => {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    temperature: 0.3,
    max_tokens: 1024,
  });

  return response.choices[0].message.content;
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
    return JSON.parse(result);
  } catch {
    return { raw: result };
  }
};
