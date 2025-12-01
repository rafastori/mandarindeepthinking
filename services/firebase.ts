//services/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyC1nN7EwXgHjqLNK78LyxbfY4vmRzPNe0o",
    authDomain: "memorizatudo-53dd5.firebaseapp.com",
    projectId: "memorizatudo-53dd5",
    storageBucket: "memorizatudo-53dd5.firebasestorage.app",
    messagingSenderId: "850858066890",
    appId: "1:850858066890:web:ca411f090294c2f975c533",
    measurementId: "G-6F1G1TNDXD"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta as ferramentas de autenticação para usarmos no app
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);