/**
 * geminiService.js
 * ----------------
 * Integrates with Gemini 1.5 Flash to make per-attendee nudge decisions
 * based on live venue telemetry.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// ─── Init ───────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-1.5-flash';

let model = null;

function getModel() {
  if (!model) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('[GeminiService] GEMINI_API_KEY is not set.');
    const genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  }
  return model;
}

// ─── System Prompt ──────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the intelligence layer of Flow, a stadium ambient AI. You decide whether an attendee needs a nudge RIGHT NOW based on live venue data. Be selective — only nudge when genuinely useful. Never send generic messages. Be specific with stand names and wait times.`;

// ─── Nudge Decision ─────────────────────────────────────────────

/**
 * Asks Gemini whether a specific attendee should receive a nudge right now.
 *
 * @param {object} attendee  – { uid, section, prefs[] }
 * @param {object} context   – { hotZones, quietZones, fastestQueue, queues, phase, currentMinute, isHalftimeApproaching }
 * @returns {Promise<{send: boolean, title?: string, body?: string, action?: string, deeplink?: string} | null>}
 */
export async function generateNudgeDecision(attendee, context) {
  try {
    const gemini = getModel();

    const userPrompt = `Here is the current venue state and attendee profile. Decide whether to nudge this attendee.

ATTENDEE:
${JSON.stringify(attendee, null, 2)}

LIVE VENUE CONTEXT:
${JSON.stringify(context, null, 2)}

Respond ONLY with valid JSON in one of two forms:

If nudge should be sent:
{"send": true, "title": "...", "body": "...", "action": "navigate|info|group", "deeplink": "flow://navigate?dest=STAND_ID"}

If no nudge needed:
{"send": false}

No markdown. No explanation. Just JSON.`;

    const result = await gemini.generateContent({
      contents: [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + userPrompt }] },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 256,
        responseMimeType: 'application/json',
      },
    });

    const response = result.response;
    const text = response.text();

    return parseGeminiResponse(text);
  } catch (err) {
    console.error(`[GeminiService] Error generating nudge for ${attendee?.uid}:`, err.message);
    return null;
  }
}

// ─── Response Parser ────────────────────────────────────────────

/**
 * Safely extracts JSON from a Gemini response, handling markdown fences
 * and other artefacts that the model sometimes wraps around JSON.
 *
 * @param {string} raw  – raw model output
 * @returns {object|null}
 */
export function parseGeminiResponse(raw) {
  if (!raw || typeof raw !== 'string') return null;

  try {
    // Strip markdown code fences:  ```json ... ``` or ``` ... ```
    let cleaned = raw.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
    cleaned = cleaned.replace(/\n?\s*```$/i, '');
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);

    // Validate minimal shape
    if (typeof parsed.send !== 'boolean') {
      console.warn('[GeminiService] Response missing "send" field:', cleaned);
      return null;
    }

    // If send === true, ensure required fields exist
    if (parsed.send === true) {
      if (!parsed.title || !parsed.body) {
        console.warn('[GeminiService] send=true but missing title/body:', cleaned);
        return null;
      }
    }

    return parsed;
  } catch (err) {
    console.error('[GeminiService] Failed to parse Gemini response:', err.message, '| raw:', raw);
    return null;
  }
}

export default { generateNudgeDecision, parseGeminiResponse };
