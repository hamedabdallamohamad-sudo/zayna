// طبقة البيانات: كل التعامل مع Firebase هنا فقط
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, updateDoc, onSnapshot,
         query, orderBy, serverTimestamp, writeBatch }
    from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
    from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { firebaseConfig } from './config.js';

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);
const rows = s => s.docs.map(d => ({ id: d.id, ...d.data() }));

export const watchProducts = (ok, err) => onSnapshot(collection(db, 'products'), s => ok(rows(s)), err);
export const watchOrders   = (ok, err) => onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), s => ok(rows(s)), err);
export const saveProduct   = (id, data) => id
    ? setDoc(doc(db, 'products', id), data, { merge: true })
    : addDoc(collection(db, 'products'), { ...data, createdAt: serverTimestamp() });
export const removeProduct = id => deleteDoc(doc(db, 'products', id));
export const createOrder   = o => addDoc(collection(db, 'orders'), { ...o, createdAt: serverTimestamp() });
export const seedProducts  = list => {
    const b = writeBatch(db);
    list.forEach(p => b.set(doc(collection(db, 'products')), { ...p, createdAt: serverTimestamp() }));
    return b.commit();
};
export const login  = (email, pass) => signInWithEmailAndPassword(auth, email, pass);
export const logout = () => signOut(auth);
export const onAuth = cb => onAuthStateChanged(auth, cb);

export const updateOrder   = (id, data) => updateDoc(doc(db, 'orders', id), data);
export const watchSettings = (ok, err) => onSnapshot(doc(db, 'settings', 'site'), s => ok(s.exists() ? s.data() : {}), err);
export const saveSettings  = data => setDoc(doc(db, 'settings', 'site'), data, { merge: true });