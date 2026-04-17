import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const INCIDENT_INTERVAL_MS = 25_000;

const INCIDENT_TYPES = [
  { type: 'crowd_surge', description: 'Crowd Surge Detected', severities: ['high', 'critical'] },
  { type: 'queue_overflow', description: 'Queue Capacity Reached', severities: ['medium', 'high'] },
  { type: 'temp_warning', description: 'Temperature Spiked', severities: ['low', 'medium'] },
  { type: 'security', description: 'Unauthorised Access', severities: ['high', 'critical'] },
];

const ZONES = ['North Gate', 'South Gate', 'East Wing', 'West Wing', 'Concession Stand 2', 'VIP Lounge'];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

class IncidentSimulator {
  constructor({ eventId = 'demo-event-001' } = {}) {
    this.eventId = eventId;
    this.intervalId = null;
  }

  async createIncident() {
    try {
      const db = getFirestore();
      const incidentInfo = randomElement(INCIDENT_TYPES);
      const severity = randomElement(incidentInfo.severities);
      const zone = randomElement(ZONES);

      const incidentDoc = {
        type: incidentInfo.type,
        description: `${incidentInfo.description} at ${zone}`,
        zone: zone,
        severity: severity,
        timestamp: FieldValue.serverTimestamp(),
        resolved: false
      };

      const ref = await db.collection('events').doc(this.eventId).collection('incidents').add(incidentDoc);
      console.log(`[IncidentSimulator] 🚨 Generated ${severity} incident: ${incidentDoc.description} (ID: ${ref.id})`);
    } catch (err) {
      console.error('[IncidentSimulator] ✗ Failed to generate incident:', err.message);
    }
  }

  start() {
    console.log(`[IncidentSimulator] ▶ Starting random incident generation for event "${this.eventId}" …`);
    this.intervalId = setInterval(() => this.createIncident(), INCIDENT_INTERVAL_MS);
  }

  stop() {
    console.log('[IncidentSimulator] ■ Stopping incident simulator.');
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export default IncidentSimulator;
