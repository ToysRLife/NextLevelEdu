import type { CloudProvider } from "./cloud";
import { LocalCloudProvider } from "./cloud-local";
import { makeFirebaseProvider } from "./cloud-firebase";

// ⬇️ Paste your Firebase web app config here to switch on real cross-device
// cloud save. Leave apiKey empty to use the built-in local (offline) provider.
// (Firebase config values are NOT secrets — they're safe to ship client-side;
// security comes from Firestore rules. See cloud-firebase.ts.)
export const FIREBASE_CONFIG: Record<string, string> = {
  apiKey: "AIzaSyDcBYp4aSS6Qlsb1u77v3DjbVX2RGeooqo",
  authDomain: "nextlevel-edu.firebaseapp.com",
  projectId: "nextlevel-edu",
  storageBucket: "nextlevel-edu.firebasestorage.app",
  messagingSenderId: "628388726909",
  appId: "1:628388726909:web:446fb4acdcbfdcc78ac914",
  measurementId: "G-5LS0KCK21W",
};

export function getProvider(): CloudProvider {
  return FIREBASE_CONFIG.apiKey ? makeFirebaseProvider(FIREBASE_CONFIG) : new LocalCloudProvider();
}

/** True when running on the built-in local provider (no Firebase config yet). */
export const isCloudConfigured = (): boolean => !!FIREBASE_CONFIG.apiKey;
