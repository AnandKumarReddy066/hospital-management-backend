/**
 * ai/chatbot.js
 * Healthcare-aware AI chatbot with conversation memory.
 */

const aiService = require('../services/aiService');

const SYSTEM_PROMPT = `You are HealthBot, an empathetic AI healthcare assistant.
You help patients with:
- General health questions
- Explaining medical terms and procedures
- Appointment and medication reminders guidance
- Mental health support and wellness tips

Rules:
- Always recommend consulting a doctor for serious concerns
- Do not diagnose or prescribe medications
- Be compassionate and clear in your responses
- Keep responses concise (under 300 words)`;

// Simple in-memory conversation store (replace with Redis for production)
const sessions = new Map();

/**
 * chat — Maintains context across multiple turns for a user session.
 * @param {string} userId
 * @param {string} message
 * @param {Array}  history  - Optional history array from client
 */
exports.chat = async (userId, message, history = []) => {
  // Retrieve or create session history
  if (!sessions.has(userId)) {
    sessions.set(userId, []);
  }
  const sessionHistory = sessions.get(userId);

  // Add incoming message
  sessionHistory.push({ role: 'user', content: message });

  // Keep last 10 turns to manage token length
  const trimmedHistory = sessionHistory.slice(-20);

  const reply = await aiService.chat(SYSTEM_PROMPT, message, trimmedHistory.slice(0, -1));

  // Store assistant reply
  sessionHistory.push({ role: 'assistant', content: reply });
  sessions.set(userId, sessionHistory.slice(-40));

  return reply;
};

/**
 * clearSession — Resets conversation history for a user.
 */
exports.clearSession = (userId) => {
  sessions.delete(userId);
};
