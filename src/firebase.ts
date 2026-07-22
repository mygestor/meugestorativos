import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, type User } from "firebase/auth";

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
const auth = getAuth(app);

export function logoutFirebase() {
  signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  return result.user;
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function registerWithEmail(email: string, password: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
}
