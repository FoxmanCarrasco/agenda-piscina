import { initializeApp, getApp, getApps } from "firebase/app";

const firebaseConfig = {
  "projectId": "reservaciones-8rd0e",
  "appId": "1:1089337582681:web:3cc19b9b57d3c7c73bfd48",
  "storageBucket": "reservaciones-8rd0e.firebasestorage.app",
  "apiKey": "AIzaSyBGVA1v9mGwpu-_D_clcF-jCI3w9sEWm3M",
  "authDomain": "reservaciones-8rd0e.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "1089337582681"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export default app;
