// Firebase configuration
// In production (Vercel), these can be replaced by environment variables
const firebaseConfig = {
  apiKey: window.ENV?.FIREBASE_API_KEY || "AIzaSyDRpTju0OPgNSIx2HloFVJYYjEX8LebtMw",
  authDomain: window.ENV?.FIREBASE_AUTH_DOMAIN || "anonix-e1c47.firebaseapp.com",
  databaseURL: window.ENV?.FIREBASE_DATABASE_URL || "https://anonix-e1c47-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: window.ENV?.FIREBASE_PROJECT_ID || "anonix-e1c47",
  storageBucket: window.ENV?.FIREBASE_STORAGE_BUCKET || "anonix-e1c47.firebasestorage.app",
  messagingSenderId: window.ENV?.FIREBASE_MESSAGING_SENDER_ID || "673033656424",
  appId: window.ENV?.FIREBASE_APP_ID || "1:673033656424:web:61a339fdcd949f2d1943dd"
};

// Initialize Firebase
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
  window.db = firebase.database();
} else {
  console.error('Firebase script not loaded');
}
