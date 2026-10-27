// صفحة تتبع الطلب: تعرض حالة الطلب فقط (بلا أي بيانات شخصية)
import { WHATSAPP_NUMBER, CURRENCY } from './config.js';
import { watchTracking, watchSettings } from './firebase.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n || 0).toLocaleString('en-US');
const safeImg = u => /^(https:\/\/|data:image\/(jpeg|png|webp);base64,)/i.test(u || '') ? esc(u) : '';

const STEPS = [
    ['new', 'تم استلام طلبك', 'نراجع طلبك ونتواصل معك لتأكيده'],
    ['confirmed', 'تم تأكيد الطلب', 'نجهّز قطعك بعناية'],
    ['shipped', 'قيد الشحن', 'طلبك في الطريق إليك'],
    ['delivered', 'تم التسليم', 'نتمنى أن تنال القطع إعجابك 💎']
];
const token = (new URLSearchParams(location.search).get('t') || '').trim();
let wa = WHATSAPP_NUMBER, cur = CURRENCY, order, loaded = false;

function render() {
    const v = $('view');
    if (!token || (loaded && !order)) {
        v.innerHTML = `<div class="bg-white rounded-2xl border border-stone-200 p-8 text-center"><i class="fa-solid fa-magnifying-glass text-4xl text-stone-300 mb-3"></i>
        <h1 class="font-bold text-lg text-stone-800">لم نجد هذا الطلب</h1><p class="text-sm text-stone-500 mt-1">تأكدي من الرابط كاملاً كما وصلكِ، أو تواصلي معنا.</p>${contactBtn('')}</div>`;
        return;
    }
    if (!order) return;
    const st = order.status || 'new', idx = STEPS.findIndex(s => s[0] === st), cancelled = st === 'cancelled';
    const steps = STEPS.map(([k, t, d], i) => {
        const done = !cancelled && i <= idx, now = !cancelled && i === idx;
        return `<li class="flex gap-4 relative ${i < STEPS.length - 1 ? 'pb-7' : ''}">
          ${i < STEPS.length - 1 ? `<span class="absolute top-8 bottom-0 right-[15px] w-0.5 ${!cancelled && i < idx ? 'bg-rose-600' : 'bg-stone-200'}"></span>` : ''}
          <span class="relative z-10 w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm ${done ? 'bg-rose-600 text-white' : 'bg-stone-200 text-stone-400'} ${now ? 'ring-4 ring-rose-100' : ''}">${done ? '<i class="fa-solid fa-check"></i>' : i + 1}</span>
          <div><p class="font-bold ${done ? 'text-stone-900' : 'text-stone-400'}">${t}</p>${now ? `<p class="text-xs text-rose-700 mt-0.5">${d}</p>` : ''}</div></li>`;
    }).join('');
    v.innerHTML = `
    <div class="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
      <p class="text-xs text-stone-500">رقم الطلب</p><h1 class="text-2xl font-extrabold text-stone-900 mb-5" dir="ltr">${esc(order.orderNo)}</h1>
      ${cancelled ? `<div class="bg-stone-100 text-stone-700 rounded-xl p-4 text-sm font-bold"><i class="fa-solid fa-circle-xmark text-stone-500 ml-1"></i> تم إلغاء هذا الطلب. للاستفسار تواصلي معنا.</div>` : `<ol>${steps}</ol>`}
    </div>
    <div class="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 mt-4">
      <h2 class="font-bold text-stone-900 mb-3">ملخص الطلب</h2>
      ${(order.items || []).map(i => `<div class="flex justify-between text-sm py-1.5 border-b border-stone-100"><span>${esc(i.name)}</span><span class="text-stone-500">×${esc(i.qty)}</span></div>`).join('')}
      <div class="flex justify-between font-extrabold mt-3"><span>المجموع</span><span>${fmt(order.total)} ${esc(cur)}</span></div>
    </div>
    ${contactBtn(order.orderNo)}`;
    document.title = `تتبع الطلب ${order.orderNo}`;
}
function contactBtn(orderNo) {
    const text = orderNo ? `مرحباً، أستفسر عن الطلب رقم ${orderNo}` : 'مرحباً، أحتاج مساعدة بخصوص طلبي';
    return `<a href="https://wa.me/${esc(wa)}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener" class="mt-4 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl shadow flex items-center justify-center gap-2 transition"><i class="fa-brands fa-whatsapp text-xl"></i> تواصلي معنا عبر واتساب</a>`;
}

watchSettings(s => {
    wa = String(s.whatsapp || '').replace(/\D/g, '') || WHATSAPP_NUMBER; cur = (s.currency || '').trim() || CURRENCY;
    if (s.storeName) $('storeName').textContent = s.storeName;
    const l = safeImg(s.logo); if (l) { $('logo').src = l; $('logo').classList.remove('hidden'); $('logoMark').classList.add('hidden'); }
    render();
}, () => {});
if (token) watchTracking(token, o => { order = o; loaded = true; render(); }, () => { order = null; loaded = true; render(); });
render();
