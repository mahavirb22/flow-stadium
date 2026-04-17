/**
 * calendarService.js
 * ------------------
 * Fetches the next match schedule from Google Calendar.
 * Falls back to a hardcoded mock when the Calendar API is unavailable
 * (e.g. no credentials during a hackathon demo).
 */

import { google } from 'googleapis';
import path from 'node:path';

// ─── Mock Schedule (demo fallback) ──────────────────────────────

function getMockSchedule() {
  const now = new Date();
  const kickoff     = new Date(now.getTime() + 5 * 60_000);          // +5 min
  const halftime    = new Date(kickoff.getTime() + 45 * 60_000);     // +45 min
  const fullTime    = new Date(kickoff.getTime() + 95 * 60_000);     // +95 min

  return {
    matchName:         'Demo FC vs. Hackathon United',
    kickoffTime:       kickoff.toISOString(),
    halftimeExpected:  halftime.toISOString(),
    fullTimeExpected:  fullTime.toISOString(),
  };
}

// ─── Google Calendar Fetch ──────────────────────────────────────

/**
 * Returns the next match schedule from a Google Calendar.
 *
 * @param {string} calendarId  Calendar ID (e.g. 'primary' or a shared ID)
 * @returns {Promise<{matchName: string, kickoffTime: string, halftimeExpected: string, fullTimeExpected: string}>}
 */
export async function getMatchSchedule(calendarId = 'primary') {
  // If no service account path is configured, return mock
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!saPath) {
    console.warn('[Calendar] No service account configured — using mock schedule.');
    return getMockSchedule();
  }

  try {
    // Authenticate with service account
    const auth = new google.auth.GoogleAuth({
      keyFile: path.resolve(saPath),
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    // Fetch upcoming events (next 24 hours)
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60_000);

    const response = await calendar.events.list({
      calendarId,
      timeMin: now.toISOString(),
      timeMax: tomorrow.toISOString(),
      maxResults: 1,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items;
    if (!events || events.length === 0) {
      console.warn('[Calendar] No upcoming events found — using mock schedule.');
      return getMockSchedule();
    }

    const event = events[0];
    const kickoffTime = event.start.dateTime || event.start.date;
    const kickoff = new Date(kickoffTime);

    return {
      matchName:         event.summary || 'Scheduled Match',
      kickoffTime:       kickoff.toISOString(),
      halftimeExpected:  new Date(kickoff.getTime() + 45 * 60_000).toISOString(),
      fullTimeExpected:  new Date(kickoff.getTime() + 95 * 60_000).toISOString(),
    };
  } catch (err) {
    console.error('[Calendar] API error — falling back to mock schedule:', err.message);
    return getMockSchedule();
  }
}

export default { getMatchSchedule };
