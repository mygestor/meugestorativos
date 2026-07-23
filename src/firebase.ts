import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, type User } from "firebase/auth";
import { getDatabase, ref, get, set } from "firebase/database";
import { Capacitor } from "@capacitor/core";

const firebaseConfig = {
  apiKey: "AIzaSyBXPrvvSmG354MlN5T3mfbbK-DQGipXu8o",
  authDomain: "gestor-de-investimento-11394.firebaseapp.com",
  projectId: "gestor-de-investimento-11394",
  storageBucket: "gestor-de-investimento-11394.firebasestorage.app",
  messagingSenderId: "384515121918",
  appId: "1:384515121918:web:9e697a52b1647ed833bbaf",
  measurementId: "G-20PMQHGNF2",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

export function logoutFirebase() {
  signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function loginWithGoogle(): Promise<User> {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    // Use native Google Sign-In
    const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");
    await GoogleAuth.initialize({
      clientId: "384515121918-9e697a52b1647ed833bbaf.apps.googleusercontent.com",
      scopes: ["profile", "email"],
      grantOfflineAccess: false,
    });
    const googleUser = await GoogleAuth.signIn();
    const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
    const result = await signInWithCredential(auth, credential);
    return result.user;
  } else {
    // Web: use redirect
    const provider = new GoogleAuthProvider();
    const { signInWithRedirect, getRedirectResult } = await import("firebase/auth");
    await signInWithRedirect(auth, provider);
    throw new Error("Redirecting...");
  }
}

export async function handleRedirectResult(): Promise<User | null> {
  try {
    const { getRedirectResult } = await import("firebase/auth");
    const result = await getRedirectResult(auth);
    if (result) {
      return result.user;
    }
    return null;
  } catch (e) {
    console.error("Redirect result error:", e);
    return null;
  }
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function registerWithEmail(email: string, password: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function loadRemoteData(uid: string): Promise<any | null> {
  try {
    const snapshot = await get(ref(db, "users/" + uid));
    if (snapshot.exists()) {
      console.log("[RTDB] Dados carregados:", uid);
      return snapshot.val();
    }
    console.log("[RTDB] Nenhum dado para:", uid);
    return null;
  } catch (e) {
    console.error("[RTDB] Erro ao carregar:", e);
    return null;
  }
}

export async function saveRemoteData(uid: string, data: any): Promise<boolean> {
  try {
    await set(ref(db, "users/" + uid), { ...data, updatedAt: new Date().toISOString() });
    console.log("[RTDB] Dados salvos:", uid);
    return true;
  } catch (e) {
    console.error("[RTDB] Erro ao salvar:", e);
    return false;
  }
}
