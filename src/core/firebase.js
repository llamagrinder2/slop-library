import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyB8vcEb3IvLNqT2R6xS_ax_cm0WFV1fRC8",
    authDomain: "slop-library.firebaseapp.com",
    projectId: "slop-library",
    storageBucket: "slop-library.firebasestorage.app",
    messagingSenderId: "730801831303",
    appId: "1:730801831303:web:be74d9cb6d8b21de7f2722"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

export {
    app,
    db,
    auth,
    storage,
    provider,
    doc,
    getDoc,
    setDoc,
    collection,
    getDocs,
    onSnapshot,
    writeBatch,
    signInWithPopup,
    onAuthStateChanged,
    signOut,
    ref,
    uploadBytes,
    getDownloadURL
};
