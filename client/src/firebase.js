import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA3AHLWJ31t8UbsR31Of6_vHKwyavtJh0E",
  authDomain: "annapurna-hackathon.firebaseapp.com",
  projectId: "annapurna-hackathon",
  storageBucket: "annapurna-hackathon.firebasestorage.app",
  messagingSenderId: "573789609630",
  appId: "1:573789609630:web:f8df21299b6d194697258f",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
