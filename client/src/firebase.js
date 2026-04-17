import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA3AHLWJ31t8UbsR31Of6_vHKwyavtJh0E",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "annapurna-hackathon.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "annapurna-hackathon",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "annapurna-hackathon.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "573789609630",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:573789609630:web:f8df21299b6d194697258f",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
