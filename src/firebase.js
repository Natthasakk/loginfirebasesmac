import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: "loginfirebasesmac.firebaseapp.com",
  projectId: "loginfirebasesmac",
  storageBucket: "loginfirebasesmac.firebasestorage.app",
  messagingSenderId: "981441935732",
  appId: "1:981441935732:web:d105a96938175b73ffd421",
  measurementId: "G-F3Q9F390WV"
};

let auth, db, storage;

try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  console.log("Firebase Connected Successfully!");
} catch (e) {
  console.error("Firebase Init Error:", e);
}

export { auth, db, storage, firebaseConfig };
