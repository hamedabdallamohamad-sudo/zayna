// واجهة متجر زينة — المنتجات والطلبات من Firebase
import { WHATSAPP_NUMBER as DEF_WA, CATEGORIES as DEF_CATS, CURRENCY as DEF_CUR } from './config.js';
import * as db from './firebase.js';

// القيم الافتراضية من config.js، وتتغير من لوحة التحكم (إعدادات المتجر) دون لمس الكود
let WHATSAPP_NUMBER = DEF_WA, CURRENCY = DEF_CUR, CATEGORIES = { ...DEF_CATS };
const defaultCats = () => Object.entries(DEF_CATS).map(([id, name]) => ({ id, name }));
let catList = defaultCats();

/* ---------- أدوات ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const img = u => {
    u = String(u ?? '').trim();
    if (/^https?:\/\//i.test(u)) return esc(u);                                    // رابط كامل
    if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u)) return u;   // صورة مرفوعة من الجهاز
    if (/^[\w\-.]+\.(jpe?g|png|webp|gif|svg)$/i.test(u)) return 'images/' + esc(u); // اسم ملف فقط
    if (/^images\/[\w\-./]+$/i.test(u) && !u.includes('..')) return esc(u);       // images/اسم.jpg
    return 'images/placeholder.svg';
};
const MAX_IMAGES = 4;
let formImages = [];
const galleryOf = p => (Array.isArray(p.images) && p.images.length ? p.images : [p.image]).filter(Boolean);
const fmt = n => Number(n || 0).toLocaleString('en-US');   // 12000 ← 12,000
const money = n => `${fmt(n)} ${CURRENCY}`;
const ONERR = "this.onerror=null;this.src='images/placeholder.svg'";
const show = id => $(id)?.classList.remove('hidden');
const hide = id => $(id)?.classList.add('hidden');
const ADMIN_PAGE = document.body.dataset.page === 'admin';   // admin.html = لوحة التحكم، وغيره = المتجر

function toast(msg, error = false) {
    const t = document.createElement('div');
    t.className = `fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] px-6 py-3 rounded-full text-sm font-bold shadow-xl transition-opacity duration-300 opacity-0 ${error ? 'bg-red-700 text-white' : 'bg-stone-900 text-amber-300'}`;
    t.textContent = msg;
    document.body.append(t);
    requestAnimationFrame(() => t.classList.remove('opacity-0'));
    setTimeout(() => { t.classList.add('opacity-0'); setTimeout(() => t.remove(), 300); }, 2800);
}

/* ---------- الحالة ---------- */
const CART_KEY = 'zayna_cart_v2';
const loadCart = () => { try { const c = JSON.parse(localStorage.getItem(CART_KEY)); return Array.isArray(c) ? c : []; } catch { return []; } };
const state = { products: [], loaded: false, category: 'all', query: '', cart: loadCart(), isAdmin: false, orders: [], stopOrders: null };
const saveCart = () => { try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch {} };

/* ---------- المتجر ---------- */
const card = p => `
<div class="bg-white rounded-2xl overflow-hidden border border-stone-200/80 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group">
  <div class="relative overflow-hidden aspect-square cursor-pointer" onclick="openProductModal('${esc(p.id)}')">
    <button onclick="event.stopPropagation(); shareProduct('${esc(p.id)}')" title="مشاركة عبر واتساب" class="absolute top-3 left-3 z-10 w-9 h-9 rounded-full bg-white/90 hover:bg-green-600 hover:text-white text-green-600 shadow flex items-center justify-center transition"><i class="fa-brands fa-whatsapp"></i></button>
    <img src="${img(p.image)}" alt="${esc(p.name)}" loading="lazy" onerror="${ONERR}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
    ${p.rating ? `<span class="absolute top-3 right-3 bg-stone-900/80 text-amber-300 text-xs font-bold px-2.5 py-1 rounded-full">★ ${esc(p.rating)}</span>` : ''}
  </div>
  <div class="p-5 flex flex-col flex-grow justify-between">
    <div>
      <h3 class="font-bold text-stone-900 text-lg mb-1 hover:text-rose-700 transition cursor-pointer" onclick="openProductModal('${esc(p.id)}')">${esc(p.name)}</h3>
      <p class="text-xs text-stone-500 mb-3 line-clamp-1"><i class="fa-solid fa-gem text-rose-600 ml-1"></i>${esc(p.notes)}</p>
    </div>
    <div class="flex items-center justify-between pt-3 border-t border-stone-100">
      <span class="text-xl font-bold text-stone-900">${fmt(p.price)} <span class="text-xs text-stone-500 font-normal">${CURRENCY}</span></span>
      <button onclick="addToCart('${esc(p.id)}')" class="bg-stone-900 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 text-sm font-medium shadow-md"><i class="fa-solid fa-plus"></i> إضافة</button>
    </div>
  </div>
</div>`;

function renderStore() {
    if (!$('productsGrid')) return;
    const q = state.query.trim().toLowerCase();
    const list = state.products.filter(p =>
        (state.category === 'all' || p.category === state.category) &&
        (!q || `${p.name} ${p.notes}`.toLowerCase().includes(q)));
    $('noResults').classList.toggle('hidden', !state.loaded || list.length > 0);
    $('productsGrid').innerHTML = state.loaded
        ? list.map(card).join('')
        : '<p class="col-span-full text-center text-stone-400 py-16">جارٍ تحميل المنتجات...</p>';
}

function syncMobileNavigation() {
    const menu = $('mobileCategoryNav');
    if (!menu) return;
    const all = [['all', 'الكل'], ...catList.map(c => [c.id, c.name])];
    menu.innerHTML = all.map(([id, name]) => '<button type="button" data-category="' + esc(id) + '" class="' + (state.category === id ? 'active' : '') + '">' + esc(name) + '</button>').join('');
}
function initMobileNavigation() {
    const toggle = $('mobileMenuToggle'), menu = $('mobileCategoryNav');
    if (!toggle || !menu) return;
    toggle.addEventListener('click', () => {
        const opening = menu.classList.contains('hidden');
        menu.classList.toggle('hidden', !opening);
        toggle.setAttribute('aria-expanded', String(opening));
    });
    menu.addEventListener('click', e => {
        const b = e.target.closest('button[data-category]');
        if (!b) return;
        filterCategory(b.dataset.category);
        menu.classList.add('hidden');
        toggle.setAttribute('aria-expanded', 'false');
        $('products')?.scrollIntoView({ behavior: 'smooth' });
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { menu.classList.add('hidden'); toggle.setAttribute('aria-expanded', 'false'); } });
    syncMobileNavigation();
}

function filterCategory(cat) {
    state.category = cat;
    document.querySelectorAll('.category-btn').forEach(b => {
        const on = b.dataset.cat === cat;
        b.classList.toggle('bg-stone-900', on); b.classList.toggle('text-white', on);
        b.classList.toggle('bg-stone-200', !on); b.classList.toggle('text-stone-700', !on);
    });
    renderStore();
    syncMobileNavigation();
}
function handleSearch() { state.query = $('searchInput').value; renderStore(); }

function openProductModal(id) {
    const p = state.products.find(x => x.id === id); if (!p) return;
    const imgs = galleryOf(p);
    const gallery = `<div class="w-full md:w-1/2 bg-stone-50">
      <div class="h-64 md:h-80"><img id="modalMainImg" src="${img(imgs[0])}" alt="${esc(p.name)}" onerror="${ONERR}" class="w-full h-full object-cover"></div>
      ${imgs.length > 1 ? `<div class="flex gap-2 p-2 overflow-x-auto">${imgs.map(s => `<img src="${img(s)}" alt="" onclick="document.getElementById('modalMainImg').src=this.src" class="w-14 h-14 rounded-lg object-cover cursor-pointer border border-stone-200 hover:border-rose-500">`).join('')}</div>` : ''}
    </div>`;
    const rows = [['اللون', p.color], ['المقاس / الأبعاد', p.size], ['العناية', p.care]].filter(r => r[1])
        .map(([k, v]) => `<div class="flex justify-between gap-3 text-xs py-1.5 border-b border-stone-100"><span class="font-bold text-stone-700">${k}</span><span class="text-stone-500">${esc(v)}</span></div>`).join('');
    $('modalContent').innerHTML = `
    ${gallery}
    <div class="w-full md:w-1/2 p-6 flex flex-col justify-between">
      <div>
        <span class="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200/60 inline-block mb-2">${esc(CATEGORIES[p.category] || 'إكسسوار')}</span>
        <h3 class="text-2xl font-bold text-stone-900">${esc(p.name)}</h3>
        <p class="text-rose-800 font-bold text-2xl mt-2">${fmt(p.price)} <span class="text-sm text-stone-500 font-normal">${CURRENCY}</span></p>
        <p class="text-stone-600 text-sm mt-4 leading-relaxed">${esc(p.description)}</p>
        <div class="mt-4 p-3 bg-stone-50 rounded-xl border border-stone-100">
          <span class="text-xs font-bold text-stone-700 block mb-1">الخامة والمواد:</span>
          <span class="text-xs text-stone-500">${esc(p.notes)}</span>
        </div>
        ${rows ? `<div class="mt-3">${rows}</div>` : ''}
      </div>
      <div class="mt-6 space-y-2">
        <button onclick="addToCart('${esc(p.id)}'); closeProductModal();" class="w-full bg-stone-900 hover:bg-rose-700 text-white font-bold py-3.5 rounded-xl transition shadow-lg">إضافة إلى الحقيبة</button>
        <div class="flex gap-2">
          <button onclick="shareProduct('${esc(p.id)}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2"><i class="fa-brands fa-whatsapp text-lg"></i> مشاركة عبر واتساب</button>
          <button onclick="copyProductLink('${esc(p.id)}')" title="نسخ الرابط" class="px-4 border border-stone-300 hover:bg-stone-100 rounded-xl text-stone-600 transition"><i class="fa-regular fa-copy"></i></button>
        </div>
      </div>
    </div>`;
    show('productModal');
}
// رابط مباشر للمنتج: يفتح نافذته تلقائياً عند الدخول
const productUrl = id => `${location.origin}${location.pathname}?p=${encodeURIComponent(id)}`;
function shareProduct(id) {
    const p = state.products.find(x => x.id === id); if (!p) return;
    const text = `✨ ${p.name}\nالسعر: ${money(p.price)}\nمن ${state.settings?.storeName || 'زينة'}\n${productUrl(id)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}
async function copyProductLink(id) {
    const url = productUrl(id);
    try { await navigator.clipboard.writeText(url); toast('تم نسخ رابط المنتج ✓'); }
    catch { window.prompt('انسخي رابط المنتج:', url); }
}
const closeProductModal = () => hide('productModal');
const openQuiz = () => show('quizModal');
const closeQuiz = () => hide('quizModal');
function recommendProduct(cat) { closeQuiz(); switchView('store'); filterCategory(cat); $('products').scrollIntoView({ behavior: 'smooth' }); }

/* ---------- السلة ---------- */
const cartItems = () => state.cart.map(c => { const p = state.products.find(x => x.id === c.id); return p && { ...p, qty: c.qty }; }).filter(Boolean);

function addToCart(id) {
    const c = state.cart.find(x => x.id === id);
    c ? c.qty++ : state.cart.push({ id, qty: 1 });
    renderCart();
    const p = state.products.find(x => x.id === id);
    toast(`تمت إضافة «${p?.name || 'القطعة'}» إلى الحقيبة ✓`);
    $('cartCount')?.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.6)' }, { transform: 'scale(1)' }], { duration: 350 });
}
function changeQuantity(id, d) {
    const c = state.cart.find(x => x.id === id); if (!c) return;
    c.qty += d;
    if (c.qty <= 0) state.cart = state.cart.filter(x => x.id !== id);
    renderCart();
}
function removeFromCart(id) { state.cart = state.cart.filter(x => x.id !== id); renderCart(); }

function renderCart() {
    if (!$('cartItems')) return;
    saveCart();
    const items = cartItems();
    $('cartCount').textContent = items.reduce((s, i) => s + i.qty, 0);
    $('cartTotal').textContent = money(items.reduce((s, i) => s + i.price * i.qty, 0));
    if ($('cartBar')) {
        const n = items.reduce((s, i) => s + i.qty, 0);
        $('cartBar').classList.toggle('hidden', !n);
        $('cartBarInfo').textContent = `${n} قطعة — ${money(items.reduce((s, i) => s + i.price * i.qty, 0))}`;
    }
    $('cartItems').innerHTML = items.length ? items.map(i => `
    <div class="flex items-center gap-4 bg-stone-50 p-3 rounded-xl border border-stone-200">
      <img src="${img(i.image)}" alt="${esc(i.name)}" onerror="${ONERR}" class="w-16 h-16 rounded-lg object-cover">
      <div class="flex-grow">
        <h4 class="font-bold text-stone-900 text-sm">${esc(i.name)}</h4>
        <span class="text-rose-800 font-bold text-sm">${money(i.price)}</span>
        <div class="flex items-center gap-2 mt-2">
          <button onclick="changeQuantity('${esc(i.id)}',-1)" class="w-6 h-6 rounded bg-stone-200 hover:bg-stone-300 text-xs font-bold">-</button>
          <span class="text-xs font-bold px-1">${i.qty}</span>
          <button onclick="changeQuantity('${esc(i.id)}',1)" class="w-6 h-6 rounded bg-stone-200 hover:bg-stone-300 text-xs font-bold">+</button>
        </div>
      </div>
      <button onclick="removeFromCart('${esc(i.id)}')" class="text-stone-400 hover:text-red-500 p-2 transition"><i class="fa-solid fa-trash-can"></i></button>
    </div>`).join('') : `
    <div class="text-center py-16 text-stone-400"><i class="fa-solid fa-bag-shopping text-5xl mb-3"></i>
    <p class="font-medium text-stone-500">الحقيبة فارغة حالياً</p><p class="text-xs mt-1">تصفحي القطع وأضيفيها للحقيبة</p></div>`;
}

function toggleCart(open = null) {
    const drawer = $('cartDrawer');
    const opening = open ?? drawer.classList.contains('invisible');
    if (opening) {
        drawer.classList.remove('invisible');
        setTimeout(() => { $('cartBackdrop').classList.remove('opacity-0'); $('cartPanel').classList.remove('-translate-x-full'); }, 10);
    } else {
        $('cartBackdrop').classList.add('opacity-0'); $('cartPanel').classList.add('-translate-x-full');
        setTimeout(() => drawer.classList.add('invisible'), 300);
    }
}

const CUSTOMER_KEY = 'zayna_customer';
const COUNTRY_CODE = '249'; // رمز الدولة لتحويل الأرقام المحلية (السودان)
const intlPhone = p => { let d = String(p).replace(/\D/g, ''); if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = COUNTRY_CODE + d.slice(1); return d; };

function checkoutViaWhatsApp() {
    const items = cartItems();
    if (!items.length) return toast('الحقيبة فارغة! أضيفي قطعاً أولاً.', true);
    let saved = {}; try { saved = JSON.parse(localStorage.getItem(CUSTOMER_KEY)) || {}; } catch {}
    ['Name', 'Phone', 'City', 'Address'].forEach(k => $('cust' + k).value = saved[k.toLowerCase()] || '');
    $('custNotes').value = '';
    $('checkoutSummary').textContent = `${items.reduce((n, i) => n + i.qty, 0)} قطعة — المجموع: ${money(items.reduce((t, i) => t + i.price * i.qty, 0))}`;
    show('checkoutModal');
}
const closeCheckout = () => hide('checkoutModal');

function confirmOrder(e) {
    e.preventDefault();
    const items = cartItems();
    if (!items.length) { closeCheckout(); return toast('الحقيبة فارغة', true); }
    const customer = {
        name: $('custName').value.trim(), phone: $('custPhone').value.trim(), city: $('custCity').value.trim(),
        address: $('custAddress').value.trim(), notes: $('custNotes').value.trim()
    };
    const digits = intlPhone(customer.phone);
    if (digits.length < 8 || digits.length > 15) return toast('رقم الجوال غير صحيح', true);
    try { localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name: customer.name, phone: customer.phone, city: customer.city, address: customer.address })); } catch {}
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    const orderNo = 'Z-' + Date.now().toString(36).toUpperCase();
    const lines = items.map(i => `• ${i.name} ×${i.qty} = ${money(i.price * i.qty)}`);
    const greet = state.settings?.orderGreeting?.trim() || `مرحباً ${state.settings?.storeName || 'زينة'} 👋`;
    const text = `${greet}\nأرغب بإتمام الطلب رقم ${orderNo}:\n${lines.join('\n')}\n\nالمجموع: ${money(total)}\n\n` +
        `بيانات العميل:\nالاسم: ${customer.name}\nالجوال: ${customer.phone}\nالمدينة: ${customer.city}\nالعنوان: ${customer.address}` +
        (customer.notes ? `\nملاحظات: ${customer.notes}` : '');
    // حفظ الطلب في Firestore (لا نمنع واتساب إن فشل الحفظ)
    db.createOrder({ orderNo, total, customer, items: items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })) })
        .catch(e => console.warn('تعذّر حفظ الطلب:', e));
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, '_blank');
    state.cart = []; renderCart(); closeCheckout(); toggleCart(false);
    toast('تم تجهيز طلبك — أرسليه من واتساب لإتمامه ✨');
}

// شريط عائم يظهر عند وجود قطع في الحقيبة: عرض السلة أو إتمام الطلب متى انتهى الزائر من التسوق
function initCartBar() {
    document.body.insertAdjacentHTML('beforeend', `
    <div id="cartBar" class="hidden fixed bottom-4 inset-x-4 z-40 max-w-xl mx-auto bg-stone-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center justify-between gap-3 border border-amber-400/30">
      <div class="flex items-center gap-3 min-w-0"><i class="fa-solid fa-bag-shopping text-amber-400 text-lg"></i>
        <div class="min-w-0"><div class="text-[11px] text-stone-400">حقيبتك</div><div id="cartBarInfo" class="text-sm font-bold truncate"></div></div></div>
      <div class="flex gap-2 shrink-0">
        <button onclick="toggleCart(true)" class="px-3.5 py-2 rounded-xl border border-stone-600 hover:bg-stone-800 text-xs font-bold transition">عرض السلة</button>
        <button onclick="checkoutViaWhatsApp()" class="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-xs font-bold transition">إتمام الطلب</button>
      </div>
    </div>`);
}

function initCheckoutUI() {
    const inp = 'w-full px-3 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none';
    const f = (id, label, attrs = '') => `<div><label class="block text-xs font-bold text-stone-700 mb-1">${label}</label><input id="${id}" ${attrs} class="${inp}"></div>`;
    document.body.insertAdjacentHTML('beforeend', `
    <div id="checkoutModal" class="fixed inset-0 z-[55] hidden items-center justify-center p-4 bg-black/60 backdrop-blur-sm flex">
      <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button type="button" onclick="closeCheckout()" class="absolute top-4 left-4 text-stone-400 hover:text-stone-600"><i class="fa-solid fa-xmark"></i></button>
        <h3 class="text-xl font-bold text-stone-900">بيانات التوصيل</h3>
        <p id="checkoutSummary" class="text-xs text-rose-700 font-bold mt-1 mb-4"></p>
        <form onsubmit="confirmOrder(event)" class="space-y-3">
          ${f('custName', 'الاسم', 'required maxlength="80" autocomplete="name"')}
          ${f('custPhone', 'رقم الجوال (واتساب)', 'type="tel" required maxlength="20" autocomplete="tel" dir="ltr" placeholder="09XXXXXXXX"')}
          ${f('custCity', 'المدينة', 'required maxlength="60"')}
          ${f('custAddress', 'العنوان', 'required maxlength="200" placeholder="الحي، الشارع، أقرب معلم"')}
          <div><label class="block text-xs font-bold text-stone-700 mb-1">ملاحظات <span class="font-normal text-stone-400">(اختياري)</span></label>
            <textarea id="custNotes" rows="2" maxlength="300" class="${inp}"></textarea></div>
          <button type="submit" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2">
            <i class="fa-brands fa-whatsapp text-xl"></i> إرسال الطلب عبر واتساب</button>
        </form>
      </div>
    </div>`);
    // عمود العميل في جدول الطلبات
    $('adminOrdersTable')?.closest('table')?.querySelector('thead tr')?.insertAdjacentHTML('beforeend', '<th class="p-4">العميل</th>');
}

/* ---------- الإدارة ---------- */
function switchView(v) {
    if (v === 'admin' && !state.isAdmin) return openAdminModal();
    $('storeView')?.classList.toggle('hidden', v === 'admin');
    $('adminView')?.classList.toggle('hidden', v !== 'admin');
    window.scrollTo(0, 0);
}
function openAdminModal() { state.isAdmin ? switchView('admin') : show('adminAuthModal'); }
const closeAdminAuthModal = () => hide('adminAuthModal');

async function adminLogin() {
    const email = $('adminEmailInput').value.trim(), pass = $('adminPasswordInput').value;
    if (!email || !pass) return toast('أدخلي البريد وكلمة المرور', true);
    try {
        await db.login(email, pass);
        $('adminPasswordInput').value = '';
        closeAdminAuthModal(); state.isAdmin = true; switchView('admin');
    } catch { toast('بيانات الدخول غير صحيحة', true); }
}
async function adminLogout() { await db.logout(); switchView('store'); }

function switchAdminTab(tab) {
    const panes = { products: 'adminProductsTab', orders: 'adminOrdersTab', settings: 'adminSettingsTab', backup: 'adminBackupTab' };
    const btns = { products: 'tabBtnProducts', orders: 'tabBtnOrders', settings: 'tabBtnSettings', backup: 'tabBtnBackup' };
    Object.keys(panes).forEach(k => {
        $(panes[k])?.classList.toggle('hidden', k !== tab);
        const b = $(btns[k]); if (!b) return;
        const on = k === tab;
        b.classList.toggle('border-rose-600', on); b.classList.toggle('text-rose-800', on);
        b.classList.toggle('border-transparent', !on); b.classList.toggle('text-stone-500', !on);
    });
    if (tab === 'backup') renderBackupInfo();
}

function renderAdmin() {
    if (!ADMIN_PAGE) return;
    renderBackupBanner();
    $('statTotalProducts').textContent = state.products.length;
    $('statTotalOrders').textContent = state.orders.length;
    $('statTotalSales').textContent = money(state.orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.total || 0), 0));
    $('adminProductsTable').innerHTML = state.products.length ? state.products.map(p => `
    <tr><td class="p-4 font-bold text-stone-900">${esc(p.name)}</td>
    <td class="p-4">${esc(CATEGORIES[p.category] || p.category)}</td>
    <td class="p-4">${money(p.price)}</td><td class="p-4">${p.rating ? '★ ' + esc(p.rating) : '—'}</td>
    <td class="p-4 text-center whitespace-nowrap">
      <button onclick="editProduct('${esc(p.id)}')" class="text-blue-600 hover:text-blue-800 px-2" title="تعديل"><i class="fa-solid fa-pen"></i></button>
      <button onclick="deleteProduct('${esc(p.id)}')" class="text-red-500 hover:text-red-700 px-2" title="حذف"><i class="fa-solid fa-trash-can"></i></button>
    </td></tr>`).join('') : `<tr><td colspan="5" class="p-8 text-center text-stone-500">لا توجد منتجات بعد.
      <button onclick="seedDemo()" class="text-rose-700 font-bold underline">إضافة منتجات تجريبية</button></td></tr>`;
}

// تصغير الصورة في المتصفح قبل حفظها (حتى 800px) لتبقى خفيفة
function compressImage(file, max = 700, quality = 0.75) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const im = new Image();
        im.onload = () => {
            const r = Math.min(1, max / Math.max(im.width, im.height));
            const c = document.createElement('canvas');
            c.width = Math.round(im.width * r); c.height = Math.round(im.height * r);
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(im, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);
            let q = quality, out = c.toDataURL('image/jpeg', q);
            while (out.length > 170000 && q > 0.4) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
            out.length > 230000 ? reject(new Error('big')) : resolve(out);
        };
        im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad')); };
        im.src = url;
    });
}
async function handleImageFile(input) {
    for (const f of [...input.files]) {
        if (formImages.length >= MAX_IMAGES) { toast(`الحد الأقصى ${MAX_IMAGES} صور`, true); break; }
        try { formImages.push(await compressImage(f)); }
        catch { toast('تعذّرت معالجة إحدى الصور، جرّبي JPG أو PNG', true); }
    }
    input.value = ''; renderFormImages();
}
function renderFormImages() {
    $('formImagesList').innerHTML = formImages.map((src, i) => `
    <div class="relative w-20 h-20">
      <img src="${img(src)}" alt="" class="w-20 h-20 rounded-xl object-cover border ${i === 0 ? 'border-rose-500 ring-2 ring-rose-200' : 'border-stone-200'}">
      ${i === 0 ? '<span class="absolute bottom-0 inset-x-0 bg-rose-600 text-white text-[10px] text-center rounded-b-xl">الرئيسية</span>'
                : `<button type="button" onclick="makeMainImage(${i})" class="absolute bottom-0 inset-x-0 bg-stone-900/70 text-white text-[10px] rounded-b-xl">رئيسية</button>`}
      <button type="button" onclick="removeFormImage(${i})" class="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-red-600 text-white text-xs leading-5">×</button>
    </div>`).join('') || '<p class="text-xs text-stone-400">لم تُضف صور بعد</p>';
}
function makeMainImage(i) { formImages.unshift(...formImages.splice(i, 1)); renderFormImages(); }
function removeFormImage(i) { formImages.splice(i, 1); renderFormImages(); }

// يبني واجهة الصور المتعددة وحقول التفاصيل داخل النموذج الموجود في index.html
function initFormUI() {
    const box = $('formImage')?.parentElement; if (!box) return;
    const inp = 'w-full px-3 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none';
    box.innerHTML = `<label class="block text-xs font-bold text-stone-700 mb-1">صور القطعة (حتى ${MAX_IMAGES})</label>
      <div id="formImagesList" class="flex flex-wrap gap-3 mb-3"></div>
      <input type="file" id="formImageFile" accept="image/*" multiple onchange="handleImageFile(this)"
        class="block w-full text-xs text-stone-600 file:ml-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-rose-50 file:text-rose-700 file:font-bold hover:file:bg-rose-100">
      <p class="text-[11px] text-stone-400 mt-1">الأولى هي الرئيسية، وتُصغَّر الصور تلقائياً</p>`;
    const extra = document.createElement('div');
    extra.className = 'grid grid-cols-1 sm:grid-cols-3 gap-3';
    extra.innerHTML = [['formColor', 'اللون', 'ذهبي، فضي...'], ['formSize', 'المقاس / الأبعاد', 'طول السلسلة 45 سم'], ['formCare', 'العناية', 'تجنّبي الماء والعطور']]
        .map(([id, l, ph]) => `<div><label class="block text-xs font-bold text-stone-700 mb-1">${l} <span class="font-normal text-stone-400">(اختياري)</span></label><input type="text" id="${id}" placeholder="${ph}" class="${inp}"></div>`).join('');
    $('formDescription').parentElement.after(extra);
}

function openProductFormModal(p = null) {
    $('productForm').reset();
    $('editProductId').value = p?.id || '';
    $('formModalTitle').textContent = p ? 'تعديل القطعة' : 'إضافة قطعة جديدة';
    formImages = p ? galleryOf(p) : []; renderFormImages();
    if (p) {
        $('formName').value = p.name; $('formCategory').value = p.category; $('formPrice').value = p.price;
        $('formNotes').value = p.notes; $('formDescription').value = p.description;
        $('formColor').value = p.color || ''; $('formSize').value = p.size || ''; $('formCare').value = p.care || '';
    }
    show('productFormModal');
}
const closeProductFormModal = () => hide('productFormModal');
const editProduct = id => openProductFormModal(state.products.find(p => p.id === id));

async function handleSaveProduct(e) {
    e.preventDefault();
    const data = {
        name: $('formName').value.trim(), category: $('formCategory').value, price: Number($('formPrice').value),
        image: formImages[0] || '', images: formImages, color: $('formColor').value.trim(), size: $('formSize').value.trim(), care: $('formCare').value.trim(), notes: $('formNotes').value.trim(), description: $('formDescription').value.trim()
    };
    if (!data.image) return toast('اختاري صورة واحدة على الأقل', true);
    if (formImages.join('').length > 900000) return toast('حجم الصور كبير، احذفي صورة أو اختاري أصغر', true);
    try {
        await db.saveProduct($('editProductId').value || null, data);
        closeProductFormModal(); toast('تم حفظ القطعة ✨');
    } catch { toast('تعذّر الحفظ — تأكدي من تسجيل الدخول وقواعد Firestore', true); }
}
async function deleteProduct(id) {
    if (!confirm('هل تريدين حذف هذه القطعة نهائياً؟')) return;
    try { await db.removeProduct(id); toast('تم الحذف'); } catch { toast('تعذّر الحذف', true); }
}
async function seedDemo() {
    const mk = (name, category, price, notes, description) => ({ name, category, price, image: '', notes, description });
    try {
        await db.seedProducts([
            mk('سلسلة لؤلؤ كلاسيكية', 'jewelry', 120, 'مطلية بالذهب 18، لؤلؤ طبيعي', 'سلسلة أنيقة تناسب الإطلالات اليومية والمناسبات.'),
            mk('قلادة القلب الذهبي', 'jewelry', 95, 'ستانلس ستيل مطلي بالذهب', 'قلادة رقيقة بتصميم قلب ناعم.'),
            mk('أقراط زركون لامعة', 'rings', 80, 'فضة عيار 925، زركون', 'أقراط براقة تمنحك إطلالة مميزة.'),
            mk('خاتم الورد الفضي', 'rings', 70, 'فضة عيار 925', 'خاتم بتصميم وردة قابل للتعديل.'),
            mk('ساعة روز جولد', 'watches', 260, 'ستانلس ستيل، زجاج معدني', 'ساعة نسائية فاخرة بسوار ناعم.'),
            mk('ساعة كلاسيك بسوار جلد', 'watches', 220, 'جلد طبيعي، مينا بيضاء', 'ساعة كلاسيكية أنيقة لكل المناسبات.')
        ]);
        toast('تمت إضافة منتجات تجريبية — عدّلي صورها من لوحة التحكم');
    } catch { toast('تعذّرت الإضافة', true); }
}

/* ---------- إعدادات المتجر: الشعار والاسم والبنرات ---------- */
function compress(file, { max = 700, mime = 'image/jpeg', limit = 170000 } = {}) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file), im = new Image();
        im.onload = () => {
            URL.revokeObjectURL(url);
            for (let m = max, t = 0; t < 6; t++, m *= 0.8) {
                const r = Math.min(1, m / Math.max(im.width, im.height));
                const c = document.createElement('canvas');
                c.width = Math.round(im.width * r); c.height = Math.round(im.height * r);
                const x = c.getContext('2d');
                if (mime === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
                x.drawImage(im, 0, 0, c.width, c.height);
                const out = c.toDataURL(mime, 0.8);
                if (out.length <= limit) return resolve(out);
            }
            reject(new Error('big'));
        };
        im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad')); };
        im.src = url;
    });
}

const SOCIALS = {   // [أيقونة، الاسم، لون الخلفية، لون الأيقونة]
    instagram: ['fa-brands fa-instagram', 'إنستغرام', '#E1306C', '#fff'],
    tiktok:    ['fa-brands fa-tiktok', 'تيك توك', '#000', '#fff'],
    snapchat:  ['fa-brands fa-snapchat', 'سناب شات', '#FFFC00', '#000'],
    facebook:  ['fa-brands fa-facebook-f', 'فيسبوك', '#1877F2', '#fff'],
    x:         ['fa-brands fa-x-twitter', 'X (تويتر)', '#000', '#fff']
};
let sLogo = '', sBanners = [], setDirty = false, bannerTimer;
const markDirty = () => { setDirty = true; };

// يجهّز أماكن الشعار والاسم والبنر في المتجر إن لم تكن موجودة في index.html
function initSiteUI() {
    // نسخة أحدث من Font Awesome لتتوفر أيقونة X وبقية الأيقونات
    if (!$('fa65')) document.head.insertAdjacentHTML('beforeend', '<link id="fa65" rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">');
    if (!$('siteLogo')) {
        const circle = document.querySelector('header .w-11.h-11.rounded-full');
        if (circle) {
            circle.id = 'logoFallback';
            circle.insertAdjacentHTML('beforebegin', '<img id="siteLogo" alt="" class="hidden w-11 h-11 rounded-full object-cover shadow-lg ring-2 ring-amber-400/60">');
        }
    }
    if (!$('socialLinks')) $('whatsappFooterLink')?.insertAdjacentHTML('afterend', '<div id="socialLinks" class="flex flex-wrap gap-2 mt-3 justify-center md:justify-start"></div>');
    const ensure = (ids, sel) => { if (!ids.some($)) document.querySelector(sel)?.setAttribute('id', ids[0]); };
    ensure(['heroTitle'], '#storeView section h1'); ensure(['heroDescription'], '#storeView section h1 + p'); ensure(['heroImage'], '#storeView section img');
    ensure(['storeTaglineText', 'siteTagline'], 'header span.text-xs.text-rose-700'); ensure(['footerStoreDescription', 'footerDesc'], 'footer p');
    if (!$('siteName')) document.querySelector('header span.text-2xl.font-extrabold')?.setAttribute('id', 'siteName');
    if (!$('bannerSection')) $('products')?.insertAdjacentHTML('beforebegin', '<section id="bannerSection" class="hidden w-full m-0 p-0"></section>');
}

// عرض الإعدادات في المتجر
function renderSite(c = {}) {
    const logo = $('siteLogo'), fb = $('logoFallback');
    if (logo) {
        if (c.logo) { logo.src = img(c.logo); logo.classList.remove('hidden'); fb?.classList.add('hidden'); }
        else { logo.classList.add('hidden'); fb?.classList.remove('hidden'); }
    }
    if ($('siteName') && c.storeName) $('siteName').textContent = c.storeName;
    if ($('socialLinks')) $('socialLinks').innerHTML = Object.entries(SOCIALS).filter(([k]) => /^https:\/\//i.test(c.social?.[k] || '')).map(([k, [icon, label, bg, fg]]) =>
        `<a href="${esc(c.social[k])}" target="_blank" rel="noopener" title="${label}" style="background:${bg};color:${fg}" class="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold border border-white/20 hover:opacity-85 transition"><i class="${icon} text-base"></i><span>${label}</span></a>`).join('');
    // نصوص الواجهة (إن تُركت فارغة تعود القيمة الأصلية في الصفحة)
    const pick = (...ids) => ids.map($).find(Boolean);
    const setText = (el, v) => { if (!el) return; el.dataset.def ??= el.textContent; el.textContent = v || el.dataset.def; };
    setText(pick('storeTaglineText', 'siteTagline'), c.tagline);
    setText(pick('heroTitle'), c.heroTitle);
    setText(pick('heroDescription'), c.heroDescription);
    setText(pick('footerStoreDescription', 'footerDesc'), c.footerDescription);
    const hi = pick('heroImage'); if (hi) { hi.dataset.def ??= hi.getAttribute('src'); hi.src = c.heroImage ? img(c.heroImage) : hi.dataset.def; }
    const fn = $('footerStoreName');
    if (fn && c.storeName) { const t = [...fn.childNodes].reverse().find(n => n.nodeType === 3 && n.textContent.trim()); if (t) t.textContent = ' ' + c.storeName + ' '; }
    const sec = $('bannerSection'); if (!sec) return;
    const list = Array.isArray(c.banners) ? c.banners : [];
    clearInterval(bannerTimer);
    sec.classList.toggle('hidden', !list.length);
    sec.innerHTML = list.length ? `<div class="relative w-full overflow-hidden shadow-lg bg-stone-100 aspect-[16/7] min-h-[220px] sm:min-h-[300px] lg:min-h-[420px]">${list.map((b, i) =>
        `<img src="${img(b)}" alt="بنر متجر زينة" class="banner-slide absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${i ? 'opacity-0' : ''}">`).join('')}</div>` : '';
    if (list.length > 1) {
        const slides = [...sec.querySelectorAll('.banner-slide')]; let n = 0;
        const wrap = sec.firstElementChild;
        wrap.insertAdjacentHTML('beforeend', '<div class="zayna-banner-controls"><button type="button" class="zayna-banner-prev" aria-label="البنر السابق">‹</button><div class="zayna-banner-dots" aria-label="اختيار البنر"></div><button type="button" class="zayna-banner-next" aria-label="البنر التالي">›</button></div>');
        const dots = wrap.querySelector('.zayna-banner-dots');
        dots.innerHTML = slides.map((_, i) => '<button type="button" aria-label="عرض البنر ' + (i + 1) + '" data-slide="' + i + '"></button>').join('');
        const go = index => {
            slides[n].classList.add('opacity-0');
            n = (index + slides.length) % slides.length;
            slides[n].classList.remove('opacity-0');
            dots.querySelectorAll('button').forEach((b, i) => b.classList.toggle('active', i === n));
        };
        const restart = () => { clearInterval(bannerTimer); if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) bannerTimer = setInterval(() => go(n + 1), 5000); };
        wrap.querySelector('.zayna-banner-prev').addEventListener('click', () => { go(n - 1); restart(); });
        wrap.querySelector('.zayna-banner-next').addEventListener('click', () => { go(n + 1); restart(); });
        dots.addEventListener('click', e => { const b = e.target.closest('[data-slide]'); if (b) { go(Number(b.dataset.slide)); restart(); } });
        wrap.addEventListener('mouseenter', () => clearInterval(bannerTimer));
        wrap.addEventListener('mouseleave', restart);
        wrap.addEventListener('focusin', () => clearInterval(bannerTimer));
        wrap.addEventListener('focusout', e => { if (!wrap.contains(e.relatedTarget)) restart(); });
        go(0); restart();
    }
}

// تطبيق القيم المحفوظة: رقم الواتساب والعملة والفئات
function applyConfig(c = {}) {
    WHATSAPP_NUMBER = String(c.whatsapp || '').replace(/\D/g, '') || DEF_WA;
    CURRENCY = (c.currency || '').trim() || DEF_CUR;
    catList = Array.isArray(c.categories) && c.categories.length ? c.categories.filter(x => x && x.id && x.name) : defaultCats();
    CATEGORIES = Object.fromEntries(catList.map(x => [x.id, x.name]));
    const wa = $('whatsappFooterLink'); if (wa) wa.href = `https://wa.me/${WHATSAPP_NUMBER}`;
}

// بناء كل أماكن عرض الفئات من القائمة المحفوظة (المتجر)
function renderCategories() {
    const list = catList, all = [['all', 'الكل'], ...list.map(c => [c.id, c.name])];
    const nav = $('storeNav');
    if (nav) {
        const quiz = [...nav.querySelectorAll('button')].find(b => /openQuiz/.test(b.getAttribute('onclick') || ''));
        nav.querySelectorAll('button').forEach(b => { if (b !== quiz) b.remove(); });
        const html = all.map(([id, n]) => `<button onclick="filterCategory('${esc(id)}')" class="hover:text-rose-700 transition py-1 border-b-2 border-transparent hover:border-rose-600">${esc(n)}</button>`).join('');
        quiz ? quiz.insertAdjacentHTML('beforebegin', html) : nav.insertAdjacentHTML('beforeend', html);
    }
    const first = document.querySelector('.category-btn');
    if (first) first.parentElement.innerHTML = all.map(([id, n]) => `<button onclick="filterCategory('${esc(id)}')" class="category-btn bg-stone-200 text-stone-700 hover:bg-stone-300 px-4 py-2 rounded-full font-medium transition" data-cat="${esc(id)}">${esc(n)}</button>`).join('');
    const ul = document.querySelector('footer ul');
    if (ul) ul.innerHTML = all.map(([id, n]) => `<li><a href="#products" onclick="filterCategory('${esc(id)}')" class="hover:text-rose-400 transition">${esc(n)}</a></li>`).join('');
    const quizBtns = [...document.querySelectorAll('#quizModal button[onclick^="recommendProduct"]')];
    if (quizBtns.length) {
        const host = quizBtns[0].parentElement; quizBtns.forEach(b => b.remove());
        host.insertAdjacentHTML('beforeend', list.map(c => `<button onclick="recommendProduct('${esc(c.id)}')" class="w-full text-right p-4 rounded-xl border border-stone-200 hover:border-rose-500 hover:bg-rose-50/50 transition flex items-center justify-between group"><span class="font-medium text-stone-800">${esc(c.name)}</span><i class="fa-solid fa-angle-left text-stone-400 group-hover:text-rose-600 transition"></i></button>`).join(''));
    }
    if (!list.some(c => c.id === state.category)) state.category = 'all';
    filterCategory(state.category);
    syncMobileNavigation();
}
// قائمة الفئات في نموذج المنتج (لوحة التحكم)
function renderFormCategories() {
    const sel = $('formCategory'); if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = catList.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
}

// تبويب «إعدادات المتجر» داخل لوحة التحكم
function initSettingsUI() {
    const tabBtn = $('tabBtnOrders'), after = $('adminOrdersTab'); if (!tabBtn || !after) return;
    const file = 'text-xs file:ml-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-rose-50 file:text-rose-700 file:font-bold hover:file:bg-rose-100';
    const inp = 'w-full px-3 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none';
    const lbl = (t, hint = '') => `<label class="block text-xs font-bold text-stone-700 mb-1">${t}${hint ? ` <span class="font-normal text-stone-400">${hint}</span>` : ''}</label>`;
    const fld = (id, t, ph = '', hint = '', extra = '') => `<div>${lbl(t, hint)}<input id="${id}" oninput="markDirty()" ${extra} placeholder="${ph}" class="${inp}"></div>`;
    const area = (id, t, rows, ph = '') => `<div>${lbl(t)}<textarea id="${id}" rows="${rows}" oninput="markDirty()" placeholder="${ph}" class="${inp}"></textarea></div>`;
    const sec = (t, body) => `<section class="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-5"><h4 class="font-extrabold text-stone-900 border-b border-stone-100 pb-2">${t}</h4>${body}</section>`;
    tabBtn.insertAdjacentHTML('afterend', `<button id="tabBtnSettings" onclick="switchAdminTab('settings')" class="${tabBtn.className}">إعدادات المتجر</button>`);
    after.insertAdjacentHTML('afterend', `
    <div id="adminSettingsTab" class="hidden space-y-6 max-w-3xl">
      <p class="text-xs text-stone-500">اترك أي خانة نصية فارغة لتعود القيمة الأصلية في الموقع. ثم اضغط «حفظ الإعدادات» في الأسفل.</p>
      ${sec('الهوية', `
        ${fld('setName', 'اسم المتجر', 'Zayna | زينة')}
        ${fld('setTagline', 'الجملة تحت الاسم', 'عالم الأناقة والإكسسوارات')}
        <div>${lbl('الشعار', '(يفضّل مربّعاً بخلفية شفافة PNG)')}<div id="setLogoBox" class="flex items-center gap-3 mb-2"></div><input type="file" accept="image/*" onchange="handleLogo(this)" class="${file}"></div>
        <div>${lbl('البنرات', '(حتى 3 — تتبدّل تلقائياً، مقاس مقترح 1200×500)')}<div id="setBannerBox" class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2"></div><input type="file" accept="image/*" multiple onchange="handleBanners(this)" class="${file}"></div>
        <div>${lbl('وسائل التواصل', '(رابط كامل يبدأ بـ https:// — اتركي الفارغ لإخفائه)')}<div class="space-y-2">${Object.entries(SOCIALS).map(([k, [icon, l]]) => `<div class="flex items-center gap-2"><i class="${icon} w-6 text-center text-stone-500"></i><input id="soc_${k}" oninput="markDirty()" dir="ltr" placeholder="https://... (${l})" class="${inp}"></div>`).join('')}</div></div>`)}
      ${sec('الواجهة الرئيسية', `
        ${fld('setHeroTitle', 'العنوان الكبير', 'بريقٌ يكمّل إطلالتكِ الساحرة')}
        ${area('setHeroDesc', 'وصف الواجهة', 3)}
        <div>${lbl('صورة الواجهة', '(اختياري)')}<div id="setHeroBox" class="flex items-center gap-3 mb-2"></div><input type="file" accept="image/*" onchange="handleHero(this)" class="${file}"></div>
        ${area('setFooterDesc', 'وصف المتجر في أسفل الموقع', 2)}`)}
      ${sec('الطلب والتواصل', `
        ${fld('setWhatsapp', 'رقم واتساب المتجر', '249XXXXXXXXX', '(مع رمز الدولة وبدون + أو 00)', 'dir="ltr" inputmode="numeric"')}
        ${fld('setCurrency', 'رمز العملة', 'ج.س', '(يظهر بجانب كل سعر)', 'maxlength="10"')}
        ${fld('setGreeting', 'سطر الترحيب في رسالة الطلب', 'مرحباً زينة 👋', '(أول سطر في رسالة واتساب)', 'maxlength="80"')}`)}
      ${sec('الفاتورة', `
        ${fld('setInvTag', 'الجملة تحت اسم المتجر في الفاتورة', 'إكسسوارات نسائية أنيقة', '', 'maxlength="80"')}
        ${fld('setInvThanks', 'عبارة الشكر في أسفل الفاتورة', 'شكراً لثقتكم بنا — يسعدنا خدمتكم دائماً 💎', '', 'maxlength="120"')}`)}
      ${sec('الفئات', `<p class="text-xs text-stone-500 -mt-2">أضيفي فئة أو غيّري اسمها أو رتّبيها بالأسهم. لا يمكن حذف فئة فيها منتجات.</p>
        <div id="setCatBox" class="space-y-2"></div>
        <button type="button" onclick="addCat()" class="text-sm font-bold text-rose-700 hover:text-rose-900"><i class="fa-solid fa-plus ml-1"></i> إضافة فئة</button>`)}
      <button onclick="saveSettings()" class="bg-stone-900 hover:bg-rose-700 text-white font-bold px-8 py-3.5 rounded-xl transition shadow-lg">حفظ الإعدادات</button>
    </div>`);
}
let sHero = '', sCats = [];
function renderSettingsImages() {
    if (!$('setLogoBox')) return;
    $('setLogoBox').innerHTML = sLogo
        ? `<img src="${img(sLogo)}" alt="" class="w-16 h-16 rounded-full object-cover border border-stone-200 bg-stone-50"><button type="button" onclick="removeLogo()" class="text-xs text-red-600 underline">حذف الشعار</button>`
        : '<p class="text-xs text-stone-400">لا يوجد شعار</p>';
    $('setHeroBox').innerHTML = sHero
        ? `<img src="${img(sHero)}" alt="" class="w-24 h-24 rounded-xl object-cover border border-stone-200"><button type="button" onclick="removeHero()" class="text-xs text-red-600 underline">حذف الصورة (تعود الأصلية)</button>`
        : '<p class="text-xs text-stone-400">الصورة الأصلية في الموقع</p>';
    $('setBannerBox').innerHTML = sBanners.map((b, i) => `<div class="relative"><img src="${img(b)}" alt="" class="w-full aspect-[16/7] object-cover rounded-xl border border-stone-200">
      <button type="button" onclick="removeBanner(${i})" class="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-red-600 text-white text-xs leading-5">×</button></div>`).join('')
        || '<p class="text-xs text-stone-400">لا توجد بنرات</p>';
}
function renderCatEditor() {
    const box = $('setCatBox'); if (!box) return;
    const b = 'w-9 h-9 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-600 text-sm';
    box.innerHTML = sCats.map((c, i) => `<div class="flex items-center gap-2">
      <input value="${esc(c.name)}" oninput="renameCat(${i}, this.value)" maxlength="30" placeholder="اسم الفئة" class="flex-1 px-3 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none">
      <button type="button" onclick="moveCat(${i},-1)" class="${b}" title="أعلى"><i class="fa-solid fa-arrow-up"></i></button>
      <button type="button" onclick="moveCat(${i},1)" class="${b}" title="أسفل"><i class="fa-solid fa-arrow-down"></i></button>
      <button type="button" onclick="removeCat(${i})" class="${b} text-red-600" title="حذف"><i class="fa-solid fa-trash-can"></i></button></div>`).join('');
}
const addCat = () => { sCats.push({ id: 'cat_' + Date.now().toString(36), name: '' }); markDirty(); renderCatEditor(); $('setCatBox').lastElementChild?.querySelector('input')?.focus(); };
const renameCat = (i, v) => { sCats[i].name = v; markDirty(); };
const moveCat = (i, d) => { const j = i + d; if (j < 0 || j >= sCats.length) return; [sCats[i], sCats[j]] = [sCats[j], sCats[i]]; markDirty(); renderCatEditor(); };
function removeCat(i) {
    const c = sCats[i], n = state.products.filter(p => p.category === c.id).length;
    if (n) return toast(`لا يمكن حذف «${c.name || 'الفئة'}» لأن فيها ${n} منتج. انقليها لفئة أخرى أولاً`, true);
    sCats.splice(i, 1); markDirty(); renderCatEditor();
}
function fillSettings() {
    const c = state.settings || {};
    if (!$('setName')) return;
    const val = (id, v) => { const e = $(id); if (e) e.value = v || ''; };
    val('setName', c.storeName); val('setTagline', c.tagline); val('setHeroTitle', c.heroTitle); val('setHeroDesc', c.heroDescription);
    val('setFooterDesc', c.footerDescription); val('setWhatsapp', c.whatsapp); val('setCurrency', c.currency); val('setGreeting', c.orderGreeting);
    val('setInvTag', c.invoiceTagline); val('setInvThanks', c.invoiceThanks);
    sLogo = c.logo || ''; sHero = c.heroImage || ''; sBanners = Array.isArray(c.banners) ? [...c.banners] : [];
    sCats = (Array.isArray(c.categories) && c.categories.length ? c.categories : defaultCats()).map(x => ({ ...x }));
    Object.keys(SOCIALS).forEach(k => { const i = $('soc_' + k); if (i) i.value = c.social?.[k] || ''; });
    renderSettingsImages(); renderCatEditor();
}
async function handleLogo(input) {
    const f = input.files[0]; if (!f) return;
    try { sLogo = await compress(f, { max: 300, mime: 'image/png', limit: 120000 }); markDirty(); renderSettingsImages(); }
    catch { toast('تعذّرت معالجة الشعار، جرّبي صورة أخرى', true); }
    input.value = '';
}
async function handleHero(input) {
    const f = input.files[0]; if (!f) return;
    try { sHero = await compress(f, { max: 900, limit: 150000 }); markDirty(); renderSettingsImages(); }
    catch { toast('تعذّرت معالجة الصورة، جرّبي صورة أخرى', true); }
    input.value = '';
}
async function handleBanners(input) {
    for (const f of [...input.files]) {
        if (sBanners.length >= 3) { toast('الحد الأقصى 3 بنرات', true); break; }
        try { sBanners.push(await compress(f, { max: 1200, limit: 200000 })); markDirty(); }
        catch { toast('تعذّرت معالجة إحدى الصور', true); }
    }
    input.value = ''; renderSettingsImages();
}
const removeLogo = () => { sLogo = ''; markDirty(); renderSettingsImages(); };
const removeHero = () => { sHero = ''; markDirty(); renderSettingsImages(); };
const removeBanner = i => { sBanners.splice(i, 1); markDirty(); renderSettingsImages(); };
async function saveSettings() {
    const g = id => ($(id)?.value || '').trim();
    if ((sLogo + sHero + sBanners.join('')).length > 900000) return toast('حجم الصور كبير، احذفي بنراً أو صورة', true);
    const social = {};
    for (const k of Object.keys(SOCIALS)) {
        const v = g('soc_' + k);
        if (v && !/^https:\/\//i.test(v)) return toast(`رابط ${SOCIALS[k][1]} يجب أن يبدأ بـ https://`, true);
        social[k] = v;
    }
    const whatsapp = g('setWhatsapp').replace(/\D/g, '');
    if (whatsapp && !/^\d{8,15}$/.test(whatsapp)) return toast('رقم واتساب غير صحيح — اكتبيه مع رمز الدولة', true);
    if (!sCats.length) return toast('يجب أن تبقى فئة واحدة على الأقل', true);
    if (sCats.some(c => !c.name.trim())) return toast('اكتبي اسماً لكل فئة أو احذفي الفارغة', true);
    try {
        await db.saveSettings({
            storeName: g('setName'), tagline: g('setTagline'), logo: sLogo, banners: sBanners, social,
            heroTitle: g('setHeroTitle'), heroDescription: g('setHeroDesc'), heroImage: sHero, footerDescription: g('setFooterDesc'),
            whatsapp, currency: g('setCurrency'), orderGreeting: g('setGreeting'), invoiceTagline: g('setInvTag'), invoiceThanks: g('setInvThanks'),
            categories: sCats.map(c => ({ id: c.id, name: c.name.trim() }))
        });
        setDirty = false; toast('تم حفظ الإعدادات ✨');
    } catch { toast('تعذّر الحفظ — تأكدي من نشر قواعد Firestore ومن حجم الصور', true); }
}

/* ---------- إدارة الطلبات ---------- */
const STATUS = {
    new: ['جديد', 'bg-rose-100 text-rose-700'], confirmed: ['مؤكد', 'bg-blue-100 text-blue-700'],
    shipped: ['قيد الشحن', 'bg-amber-100 text-amber-800'], delivered: ['تم التسليم', 'bg-green-100 text-green-700'],
    cancelled: ['ملغي', 'bg-stone-200 text-stone-600']
};
const stOf = o => STATUS[o.status] ? o.status : 'new';
let orderFilter = 'all', ordersReady = false;
const waLink = o => `https://wa.me/${intlPhone(o.customer?.phone || '')}?text=${encodeURIComponent(`مرحباً ${o.customer?.name || ''} 👋\nطلبك رقم ${o.orderNo} حالته الآن: ${STATUS[stOf(o)][0]}`)}`;

function initOrdersUI() {
    const tab = $('adminOrdersTab'); if (!tab) return;
    tab.className = 'hidden';   // الكروت لها خلفيتها الخاصة بدل إطار الجدول القديم
    tab.innerHTML = '<div id="orderFilters" class="flex flex-wrap gap-2 mb-4"></div><div id="ordersList" class="space-y-4"></div>';
}
function orderCard(o) {
    const st = stOf(o), c = o.customer;
    return `<div class="bg-white rounded-2xl border ${st === 'new' ? 'border-rose-300 ring-1 ring-rose-100' : 'border-stone-200'} p-5">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
      <div><span class="font-extrabold">${esc(o.orderNo)}</span> <span class="text-xs text-stone-500 mr-2">${o.createdAt ? o.createdAt.toDate().toLocaleString('ar') : ''}</span></div>
      <div class="flex items-center gap-2"><span class="text-xs font-bold px-2.5 py-1 rounded-full ${STATUS[st][1]}">${STATUS[st][0]}</span>
        <select onchange="setStatus('${esc(o.id)}', this.value)" class="text-xs border border-stone-300 rounded-lg px-2 py-1.5">
          ${Object.entries(STATUS).map(([k, [l]]) => `<option value="${k}" ${k === st ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    </div>
    <div class="grid md:grid-cols-2 gap-4 text-sm">
      <div class="bg-stone-50 rounded-xl p-3">${c ? `<p class="font-bold">${esc(c.name)}</p>
        <a href="https://wa.me/${intlPhone(c.phone)}" target="_blank" rel="noopener" dir="ltr" class="text-green-700 underline text-xs">${esc(c.phone)}</a>
        <p class="text-xs text-stone-600 mt-1">${esc(c.city)} — ${esc(c.address)}</p>${c.notes ? `<p class="text-xs text-amber-700 mt-1">📝 ${esc(c.notes)}</p>` : ''}`
        : '<p class="text-xs text-stone-400">بدون بيانات عميل (طلب قديم)</p>'}</div>
      <div>${(o.items || []).map(i => `<div class="flex justify-between text-xs py-1 border-b border-stone-100"><span>${esc(i.name)} ×${esc(i.qty)}</span><span>${money(i.price * i.qty)}</span></div>`).join('')}
        <div class="flex justify-between font-extrabold mt-2"><span>المجموع</span><span>${money(o.total)}</span></div></div>
    </div>
    <div class="flex flex-wrap gap-2 mt-4">
      <button onclick="printInvoice('${esc(o.id)}')" class="inline-flex items-center gap-1.5 bg-stone-900 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"><i class="fa-solid fa-file-invoice"></i> فاتورة / طباعة</button>
      ${c ? `<a href="${waLink(o)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"><i class="fa-brands fa-whatsapp"></i> مراسلة العميل</a>` : ''}
    </div>
    </div>`;
}
function renderOrders() {
    if (!$('ordersList')) return;
    const nNew = state.orders.filter(o => stOf(o) === 'new').length;
    if (!$('newBadge')) $('tabBtnOrders')?.insertAdjacentHTML('beforeend', ' <span id="newBadge" class="hidden bg-rose-600 text-white text-xs rounded-full px-2 py-0.5 mr-1"></span>');
    if ($('newBadge')) { $('newBadge').textContent = nNew; $('newBadge').classList.toggle('hidden', !nNew); }
    document.title = (nNew ? `(${nNew}) ` : '') + document.title.replace(/^\(\d+\)\s*/, '');
    const f = (k, l) => `<button onclick="setOrderFilter('${k}')" class="text-xs font-bold px-3.5 py-2 rounded-full ${orderFilter === k ? 'bg-stone-900 text-white' : 'bg-white border border-stone-300 text-stone-700'}">${l} (${k === 'all' ? state.orders.length : state.orders.filter(o => stOf(o) === k).length})</button>`;
    $('orderFilters').innerHTML = f('all', 'الكل') + Object.entries(STATUS).map(([k, [l]]) => f(k, l)).join('');
    const list = state.orders.filter(o => orderFilter === 'all' || stOf(o) === orderFilter);
    $('ordersList').innerHTML = list.map(orderCard).join('') || '<p class="text-center text-stone-500 py-12">لا توجد طلبات.</p>';
}
function printInvoice(id) {
    const o = state.orders.find(x => x.id === id); if (!o) return;
    const st = state.settings || {}, c = o.customer || {}, name = esc(st.storeName || 'زينة');
    const date = o.createdAt ? o.createdAt.toDate().toLocaleDateString('ar') : '';
    const phone = `+${esc(WHATSAPP_NUMBER)}`;
    const rows = (o.items || []).map((i, n) => `<tr><td>${n + 1}</td><td class="n">${esc(i.name)}</td><td>${esc(i.qty)}</td><td>${money(i.price)}</td><td>${money(i.price * i.qty)}</td></tr>`).join('');
    const w = window.open('', '_blank');
    if (!w) return toast('اسمحي بالنوافذ المنبثقة في المتصفح لطباعة الفاتورة', true);
    w.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>فاتورة ${esc(o.orderNo)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet"><style>
      @page{size:A4;margin:12mm}*{box-sizing:border-box}
      body{margin:0;font-family:'Tajawal',Tahoma,Arial,sans-serif;color:#1c1917;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .wm{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:0;pointer-events:none}
      .wm img{width:62%;max-height:70%;object-fit:contain;opacity:.07}
      .wm span{font-size:110px;font-weight:800;opacity:.05;transform:rotate(-25deg);white-space:nowrap}
      .page{position:relative;z-index:1;max-width:780px;margin:auto;padding:26px 34px;min-height:262mm;display:flex;flex-direction:column}
      .bar{height:6px;border-radius:6px;background:linear-gradient(90deg,#be123c,#d4af37,#be123c);margin-bottom:22px}
      .head{display:flex;justify-content:space-between;align-items:center;gap:16px}
      .brand{display:flex;align-items:center;gap:14px}
      .brand img{height:70px;width:70px;object-fit:cover;border-radius:50%;border:2px solid #d4af37}
      .brand h1{margin:0;font-size:26px}.brand small{color:#be123c;font-weight:700}
      .title{text-align:left}.title h2{margin:0;font-size:30px;color:#be123c;letter-spacing:2px}.title p{margin:2px 0 0;color:#78716c;font-size:12px}
      .cards{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:24px 0}
      .card{border:1px solid #e7e5e4;border-right:4px solid #d4af37;border-radius:10px;padding:12px 16px;font-size:13.5px;line-height:1.95;background:rgba(250,250,249,.85)}
      .card b.t{display:block;color:#be123c;font-size:13px}
      table{width:100%;border-collapse:collapse;font-size:14px}
      thead th{background:#1c1917;color:#fff;padding:10px;font-weight:700}
      tbody td{padding:10px;border-bottom:1px solid #e7e5e4;text-align:center}
      tbody tr:nth-child(even) td{background:rgba(250,250,249,.8)}td.n{text-align:right;font-weight:700}
      .tot{margin:18px auto 0 0;width:290px}.tot div{display:flex;justify-content:space-between;padding:6px 14px;font-size:14px}
      .tot .grand{background:linear-gradient(90deg,#be123c,#9f1239);color:#fff;border-radius:10px;font-weight:800;font-size:17px;margin-top:6px;padding:10px 14px}
      .foot{margin-top:auto;padding-top:14px;border-top:2px solid #d4af37;text-align:center;font-size:13px;color:#57534e}
      .foot .ph{display:block;margin-top:6px;font-size:18px;font-weight:800;color:#1c1917;direction:ltr;unicode-bidi:isolate}
    </style></head><body>
      <div class="wm">${st.logo ? `<img src="${img(st.logo)}" alt="">` : `<span>${name}</span>`}</div>
      <div class="page">
        <div class="bar"></div>
        <div class="head">
          <div class="brand">${st.logo ? `<img src="${img(st.logo)}" alt="">` : ''}<div><h1>${name}</h1><small>${esc(st.invoiceTagline || 'إكسسوارات نسائية أنيقة')}</small></div></div>
          <div class="title"><h2>فاتورة</h2><p>INVOICE</p></div>
        </div>
        <div class="cards">
          <div class="card"><b class="t">بيانات العميل</b>الاسم: ${esc(c.name || '—')}<br>الجوال: <span dir="ltr">${esc(c.phone || '—')}</span><br>العنوان: ${esc(c.city || '')} ${esc(c.address || '')}${c.notes ? `<br>ملاحظات: ${esc(c.notes)}` : ''}</div>
          <div class="card"><b class="t">تفاصيل الفاتورة</b>رقم الفاتورة: <b>${esc(o.orderNo)}</b><br>التاريخ: ${date}<br>حالة الطلب: ${STATUS[stOf(o)][0]}</div>
        </div>
        <table><thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="tot"><div class="grand"><span>المجموع الكلي</span><span>${money(o.total)}</span></div></div>
        <div class="foot">${esc(st.invoiceThanks || 'شكراً لثقتكم بنا — يسعدنا خدمتكم دائماً 💎')}<span>للتواصل والاستفسار</span><span class="ph">${phone}</span></div>
      </div></body></html>`);
    w.document.close();
    (w.document.fonts?.ready || Promise.resolve()).then(() => setTimeout(() => w.print(), 400));
}
const setOrderFilter = k => { orderFilter = k; renderOrders(); };
async function setStatus(id, status) {
    try { await db.updateOrder(id, { status }); toast('تم تحديث حالة الطلب'); }
    catch { toast('تعذّر تحديث الحالة', true); }
}

/* ---------- النسخة الاحتياطية ---------- */
const BK_KEY = 'zayna_last_backup';
const lastBackup = () => { try { return Number(localStorage.getItem(BK_KEY)) || 0; } catch { return 0; } };
const today = () => new Date().toISOString().slice(0, 10);
const fmtSize = n => n > 1048576 ? `${(n / 1048576).toFixed(1)} ميغابايت` : `${Math.max(1, Math.round(n / 1024))} كيلوبايت`;
const tsISO = t => t?.toDate ? t.toDate().toISOString() : (t ?? null);

function saveFile(content, name, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function backupJSON(withImages) {
    const data = {
        app: 'zayna-store', version: 1, exportedAt: new Date().toISOString(), includesImages: withImages,
        settings: state.settings || {},
        products: state.products.map(p => ({ ...p, createdAt: tsISO(p.createdAt) })),
        orders: state.orders.map(o => ({ ...o, createdAt: tsISO(o.createdAt) }))
    };
    // بدون الصور: تُحذف الصور المخزّنة داخل القاعدة (الشعار والبنرات وصور المنتجات)، وتبقى الروابط وأسماء الملفات
    return JSON.stringify(data, (k, v) => (!withImages && typeof v === 'string' && v.startsWith('data:image/')) ? '' : v, 1);
}
function downloadBackup() {
    const withImages = $('bkImages')?.checked !== false;
    saveFile(backupJSON(withImages), `zayna-backup-${today()}.json`, 'application/json');
    try { localStorage.setItem(BK_KEY, String(Date.now())); } catch {}
    renderBackupBanner(); toast('تم تنزيل النسخة الاحتياطية — احفظيها خارج مجلد المشروع');
}
const csvCell = (v, raw = false) => {
    let s = String(v ?? '').replace(/\r?\n/g, ' ');
    if (!raw && /^[=+\-@]/.test(s)) s = "'" + s;   // حماية من تنفيذ صيغ Excel
    return `"${s.replace(/"/g, '""')}"`;
};
function downloadOrdersCsv() {
    if (!state.orders.length) return toast('لا توجد طلبات لتصديرها', true);
    const head = ['رقم الطلب', 'التاريخ', 'الحالة', 'الاسم', 'الجوال', 'المدينة', 'العنوان', 'ملاحظات', 'المنتجات', 'المجموع'];
    const rows = state.orders.map(o => {
        const c = o.customer || {}, phone = String(c.phone || '').replace(/[^\d+]/g, '');
        return [csvCell(o.orderNo), csvCell(o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString('en-GB') : ''), csvCell(STATUS[stOf(o)][0]),
            csvCell(c.name), phone ? csvCell(`="${phone}"`, true) : '""', csvCell(c.city), csvCell(c.address), csvCell(c.notes),
            csvCell((o.items || []).map(i => `${i.name} ×${i.qty}`).join(' | ')), csvCell(o.total, true)];
    });
    saveFile('\ufeff' + [head.map(h => csvCell(h)), ...rows].map(r => r.join(',')).join('\r\n'), `zayna-orders-${today()}.csv`, 'text/csv;charset=utf-8');
    toast('تم تنزيل ملف الطلبات (يفتح في Excel)');
}
function renderBackupInfo() {
    const el = $('bkInfo'); if (!el) return;
    el.textContent = `${state.products.length} منتج • ${state.orders.length} طلب • الحجم التقريبي: مع الصور ${fmtSize(backupJSON(true).length)}، بدون الصور ${fmtSize(backupJSON(false).length)}`;
    renderBackupBanner();
}
function renderBackupBanner() {
    const t = lastBackup(), days = t ? Math.floor((Date.now() - t) / 864e5) : null, due = days === null || days >= 7;
    if ($('backupBanner')) {
        $('backupBanner').classList.toggle('hidden', !due);
        if (due) $('backupBannerText').textContent = days === null ? 'لم تنزّلي نسخة احتياطية من متجرك بعد' : `آخر نسخة احتياطية كانت قبل ${days} يوم`;
    }
    if ($('bkLast')) $('bkLast').textContent = t ? `آخر نسخة: ${new Date(t).toLocaleString('ar')}` : 'لم تُنزَّل نسخة بعد';
}
function initBackupUI() {
    const prev = $('tabBtnSettings') || $('tabBtnOrders'), after = $('adminSettingsTab') || $('adminOrdersTab'); if (!prev || !after) return;
    prev.insertAdjacentHTML('afterend', `<button id="tabBtnBackup" onclick="switchAdminTab('backup')" class="${$('tabBtnOrders').className}">نسخة احتياطية</button>`);
    const btn = 'font-bold px-6 py-3 rounded-xl transition text-sm';
    after.insertAdjacentHTML('afterend', `
    <div id="adminBackupTab" class="hidden space-y-5 max-w-3xl">
      <div class="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm leading-relaxed"><b>تنبيه خصوصية:</b> الملف يحتوي أسماء الزبونات وجوالاتهن وعناوينهن. احفظيه على جهازك أو في مكان خاص، <b>ولا ترفعيه إلى GitHub أبداً</b>.</div>
      <section class="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-4">
        <h4 class="font-extrabold text-stone-900">نسخة كاملة للمتجر</h4>
        <p class="text-sm text-stone-600">ملف واحد فيه المنتجات والطلبات وإعدادات المتجر (الشعار والبنرات والفئات ووسائل التواصل).</p>
        <label class="flex items-center gap-2 text-sm font-bold"><input id="bkImages" type="checkbox" checked class="w-4 h-4"> تضمين الصور (يكبر الملف، وإلغاؤه ينتج نسخة خفيفة)</label>
        <p id="bkInfo" class="text-xs text-stone-500"></p>
        <p id="bkLast" class="text-xs font-bold text-rose-700"></p>
        <button onclick="downloadBackup()" class="${btn} bg-stone-900 hover:bg-rose-700 text-white"><i class="fa-solid fa-download ml-1"></i> تنزيل نسخة كاملة</button>
      </section>
      <section class="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-3">
        <h4 class="font-extrabold text-stone-900">الطلبات لـ Excel</h4>
        <p class="text-sm text-stone-600">ملف يفتح مباشرة في Excel، فيه رقم الطلب والتاريخ والحالة وبيانات العميلة والمنتجات والمجموع، للمحاسبة.</p>
        <button onclick="downloadOrdersCsv()" class="${btn} bg-green-600 hover:bg-green-700 text-white"><i class="fa-solid fa-file-excel ml-1"></i> تنزيل الطلبات (Excel)</button>
      </section>
    </div>`);
    $('adminView')?.insertAdjacentHTML('afterbegin', `
    <div id="backupBanner" class="hidden mb-5 bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
      <span><i class="fa-solid fa-triangle-exclamation ml-1"></i><span id="backupBannerText"></span> — يُنصح بنسخة أسبوعية.</span>
      <button onclick="switchAdminTab('backup')" class="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-1.5 rounded-lg text-xs">نسخة الآن</button>
    </div>`);
    renderBackupBanner();
}

/* ---------- التشغيل ---------- */
document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    (ADMIN_PAGE ? ['productFormModal'] : ['productModal', 'quizModal', 'checkoutModal']).forEach(hide);
    if ($('cartDrawer') && !$('cartDrawer').classList.contains('invisible')) toggleCart(false);
});

db.watchProducts(list => {
    state.products = list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    state.loaded = true; renderStore(); renderCart(); renderAdmin();
    if (!state.deepLinked && !ADMIN_PAGE && state.products.length) {
        state.deepLinked = true;
        const pid = new URLSearchParams(location.search).get('p');
        if (pid && state.products.some(x => x.id === pid)) openProductModal(pid);
    }
}, () => { state.loaded = true; renderStore(); toast('تعذّر تحميل المنتجات — راجعي إعدادات Firebase', true); });

db.watchSettings(c => {
    state.settings = c; applyConfig(c); renderSite(c);
    if (Array.isArray(c.categories) && c.categories.length) renderCategories();   // الفئات المخصّصة فقط، وإلا تبقى فئات الصفحة كما هي
    renderFormCategories(); renderStore(); renderCart(); renderAdmin(); renderOrders();
    if (!setDirty) fillSettings();
}, () => {});

db.onAuth(user => {
    if (!ADMIN_PAGE) return;   // المتجر لا يتعامل مع الدخول إطلاقاً
    if (user) { hide('adminAuthModal'); show('adminView'); } else { hide('adminView'); show('adminAuthModal'); }
    state.isAdmin = !!user;
    state.stopOrders?.(); state.stopOrders = null;
    if (user) state.stopOrders = db.watchOrders(o => {
        if (ordersReady && o.length > state.orders.length) toast('📦 وصل طلب جديد!');
        state.orders = o; ordersReady = true; renderAdmin(); renderOrders();
    }, () => toast('لا صلاحية لقراءة الطلبات', true));
    else { state.orders = []; ordersReady = false; renderAdmin(); renderOrders(); }
});

const wa = $('whatsappFooterLink');
if (wa) wa.href = `https://wa.me/${WHATSAPP_NUMBER}`;   // تُحدَّث لاحقاً من الإعدادات
if (ADMIN_PAGE) { initFormUI(); initOrdersUI(); initSettingsUI(); initBackupUI(); }
else {
    // المتجر للزبائن فقط: نزيل أي أثر للوحة التحكم من الصفحة
    ['adminView', 'adminAuthModal', 'productFormModal'].forEach(id => $(id)?.remove());
    document.querySelectorAll('[onclick*="openAdminModal"]').forEach(e => e.remove());
    initCheckoutUI(); initSiteUI(); initCartBar(); initMobileNavigation();
    $('productModal')?.firstElementChild?.classList.add('max-h-[90vh]', 'overflow-y-auto');   // نافذة المنتج قابلة للتمرير على الجوال
}
filterCategory('all'); renderCart();

// index.html يستدعي الدوال عبر onclick، فنعرضها عالمياً
Object.assign(window, { switchView, filterCategory, handleSearch, openProductModal, closeProductModal, openQuiz, closeQuiz,
    recommendProduct, addToCart, changeQuantity, removeFromCart, toggleCart, checkoutViaWhatsApp, openAdminModal,
    closeAdminAuthModal, adminLogin, adminLogout, switchAdminTab, openProductFormModal, closeProductFormModal,
    editProduct, handleSaveProduct, deleteProduct, seedDemo, handleImageFile, makeMainImage, removeFormImage, confirmOrder, closeCheckout,
    shareProduct, copyProductLink, downloadBackup, downloadOrdersCsv, addCat, renameCat, moveCat, removeCat, handleHero, removeHero, markDirty, handleLogo, handleBanners, removeLogo, removeBanner, saveSettings, setStatus, setOrderFilter, printInvoice });
