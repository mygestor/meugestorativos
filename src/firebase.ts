import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, type User } from "firebase/auth";

const firebaseConfig = {
  apiKey: "PLACEHOLDER_API_KEY",
  authDomain: "PLACEHOLDER.firebaseapp.com",
  projectId: "PLACEHOLDER_PROJECT_ID",
  storageBucket: "PLACEHOLDER.appspot.com",
  messagingSenderId: "PLACEHOLDER_SENDER_ID",
  appId: "PLACEHOLDER_APP_ID",
};

let app: ReturnType<typeof initializeApp> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;

function getFirebase() {
  if (!app) {
    const config = getFirebaseConfig();
    if (!config) return null;
    app = initializeApp(config);
    auth = getAuth(app);
  }
  return { app, auth: auth! };
}

function getFirebaseConfig() {
  const raw = localStorage.getItem("gestor-firebase-config");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isFirebaseConfigured(): boolean {
  return getFirebaseConfig() !== null;
}

export function saveFirebaseConfig(config: any) {
  localStorage.setItem("gestor-firebase-config", JSON.stringify(config));
  app = null;
  auth = null;
}

export function logoutFirebase() {
  const fb = getFirebase();
  if (fb) signOut(fb.auth);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  const fb = getFirebase();
  if (!fb) { callback(null); return () => {}; }
  return onAuthStateChanged(fb.auth, callback);
}

export async function loginWithGoogle(): Promise<User> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase não configurado");
  const result = await signInWithPopup(fb.auth, new GoogleAuthProvider());
  return result.user;
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase não configurado");
  const result = await signInWithEmailAndPassword(fb.auth, email, password);
  return result.user;
}

export async function registerWithEmail(email: string, password: string): Promise<User> {
  const fb = getFirebase();
  if (!fb) throw new Error("Firebase não configurado");
  const result = await createUserWithEmailAndPassword(fb.auth, email, password);
  return result.user;
}
