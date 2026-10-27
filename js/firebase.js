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
// الطلب + مستند التتبع العام (حالة الطلب فقط بلا بيانات شخصية) في عملية واحدة
export const createOrder   = o => {
    const b = writeBatch(db);
    b.set(doc(collection(db, 'orders')), { ...o, createdAt: serverTimestamp() });
    if (o.trackId) b.set(doc(db, 'tracking', o.trackId), {
        orderNo: o.orderNo, status: 'new', total: o.total,
        count: o.items.reduce((n, i) => n + i.qty, 0), items: o.items.map(i => ({ name: i.name, qty: i.qty })),
        createdAt: serverTimestamp()
    });
    return b.commit();
};
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

// ---- تتبع الطلب ----
export const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
export const watchTracking = (token, ok, err) => onSnapshot(doc(db, 'tracking', token), s => ok(s.exists() ? s.data() : null), err);
// تغيير حالة الطلب في اللوحة يُحدّث صفحة التتبع أيضاً
export const setOrderStatus = async (order, status) => {
    await updateDoc(doc(db, 'orders', order.id), { status });
    if (order.trackId) {
        try { await setDoc(doc(db, 'tracking', order.trackId), { status, updatedAt: serverTimestamp() }, { merge: true }); }
        catch (e) { console.warn('تعذّر تحديث صفحة التتبع:', e); }
    }
};
// للطلبات القديمة: إنشاء رابط تتبع عند أول طلب له
export const ensureTracking = async (order, status) => {
    const token = newToken(), b = writeBatch(db);
    b.set(doc(db, 'tracking', token), {
        orderNo: order.orderNo, status, total: order.total || 0,
        count: (order.items || []).reduce((n, i) => n + i.qty, 0), items: (order.items || []).map(i => ({ name: i.name, qty: i.qty })),
        createdAt: serverTimestamp()
    });
    b.update(doc(db, 'orders', order.id), { trackId: token });
    await b.commit();
    return token;
};
