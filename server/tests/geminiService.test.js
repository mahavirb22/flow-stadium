/**
 * geminiService.test.js
 * ─────────────────────
 * Tests for the Gemini response parser and nudge decision generator.
 */

import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

// ─── Mock @google/generative-ai ─────────────────────────────────

const mockGenerateContent = jest.fn();

jest.unstable_mockModule('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  },
}));

// ─── Import after mocks ────────────────────────────────────────

let parseGeminiResponse;
let generateNudgeDecision;

beforeAll(async () => {
  // Set API key before import so the module initializes
  process.env.GEMINI_API_KEY = 'test-key';
  const mod = await import('../services/geminiService.js');
  parseGeminiResponse = mod.parseGeminiResponse;
  generateNudgeDecision = mod.generateNudgeDecision;
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// parseGeminiResponse
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('parseGeminiResponse', () => {
  it('parses a valid JSON nudge response correctly', () => {
    const raw = JSON.stringify({
      send: true,
      title: 'Head to Stand 3!',
      body: 'Only 2 min wait right now.',
      action: 'navigate',
      deeplink: 'flow://navigate?dest=stand_3',
    });

    const result = parseGeminiResponse(raw);

    expect(result).not.toBeNull();
    expect(result.send).toBe(true);
    expect(result.title).toBe('Head to Stand 3!');
    expect(result.body).toBe('Only 2 min wait right now.');
    expect(result.action).toBe('navigate');
    expect(result.deeplink).toBe('flow://navigate?dest=stand_3');
  });

  it('strips markdown ```json fences and parses correctly', () => {
    const raw = '```json\n{"send": true, "title": "Go now", "body": "Stand 1 is empty", "action": "navigate", "deeplink": "flow://stand_1"}\n```';

    const result = parseGeminiResponse(raw);

    expect(result).not.toBeNull();
    expect(result.send).toBe(true);
    expect(result.title).toBe('Go now');
    expect(result.body).toBe('Stand 1 is empty');
  });

  it('strips plain ``` fences (without json tag) and parses', () => {
    const raw = '```\n{"send": false}\n```';

    const result = parseGeminiResponse(raw);

    expect(result).not.toBeNull();
    expect(result.send).toBe(false);
  });

  it('returns null for malformed JSON without throwing', () => {
    const raw = 'Sure! Here is the nudge: {broken json';

    const result = parseGeminiResponse(raw);

    expect(result).toBeNull();
  });

  it('returns null for completely empty input', () => {
    expect(parseGeminiResponse('')).toBeNull();
    expect(parseGeminiResponse(null)).toBeNull();
    expect(parseGeminiResponse(undefined)).toBeNull();
  });

  it('returns null when "send" field is missing', () => {
    const raw = JSON.stringify({ title: 'Test', body: 'Test' });

    const result = parseGeminiResponse(raw);

    expect(result).toBeNull();
  });

  it('returns null when send=true but title/body are missing', () => {
    const raw = JSON.stringify({ send: true, action: 'info' });

    const result = parseGeminiResponse(raw);

    expect(result).toBeNull();
  });

  it('{\"send\": false} correctly returns object with send=false', () => {
    const raw = '{"send": false}';

    const result = parseGeminiResponse(raw);

    expect(result).not.toBeNull();
    expect(result.send).toBe(false);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// generateNudgeDecision
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('generateNudgeDecision', () => {
  it('returns parsed decision from Gemini', async () => {
    const geminiOutput = JSON.stringify({
      send: true,
      title: 'Halftime approaching',
      body: 'Stand 5 — only 3 min wait',
      action: 'navigate',
      deeplink: 'flow://navigate?dest=stand_5',
    });

    mockGenerateContent.mockResolvedValue({
      response: { text: () => geminiOutput },
    });

    const result = await generateNudgeDecision(
      { uid: 'u1', section: 'A', prefs: ['food'] },
      { isHalftimeApproaching: true, fastestQueue: { standId: 'stand_5', waitMins: 3 } }
    );

    expect(result).not.toBeNull();
    expect(result.send).toBe(true);
    expect(result.title).toBe('Halftime approaching');
  });

  it('returns null when Gemini API throws', async () => {
    mockGenerateContent.mockRejectedValue(new Error('API quota exceeded'));

    const result = await generateNudgeDecision(
      { uid: 'u1', section: 'B', prefs: [] },
      { isHalftimeApproaching: false }
    );

    expect(result).toBeNull();
  });

  it('returns null for malformed Gemini output', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => 'I would recommend sending a nudge about...' },
    });

    const result = await generateNudgeDecision(
      { uid: 'u1', section: 'C', prefs: [] },
      {}
    );

    expect(result).toBeNull();
  });
});
