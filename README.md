# زينة | Zayna — متجر إكسسوارات نسائية

متجر عربي (RTL) بـ HTML + Tailwind + JavaScript، مربوط بـ **Firebase** (Firestore + Authentication).

## الهيكل
```
├── index.html
├── css/style.css
├── js/config.js            # إعدادات Firebase والواتساب والفئات (عدّلي هنا)
├── js/firebase.js          # طبقة البيانات (Firestore + Auth)
├── js/app.js               # واجهة المتجر والسلة ولوحة الإدارة
├── js/tailwind-config.js
├── images/placeholder.svg
├── firestore.rules         # قواعد الأمان
└── .nojekyll
```

## إعداد Firebase (مرة واحدة)
1. أنشئي مشروعاً في [Firebase Console](https://console.firebase.google.com) ثم أضيفي **Web app** وانسخي `firebaseConfig` إلى `js/config.js`.
2. **Build ← Firestore Database ← Create database.**
3. **Build ← Authentication ← Sign-in method ← Email/Password** (فعّليه)، ثم من تبويب **Users** أضيفي حساب المدير.
4. من **Authentication ← Settings ← User actions** عطّلي **Enable create (sign-up)** حتى لا يُنشئ أحد حساباً جديداً.
5. افتحي `firestore.rules`، غيّري `admin@example.com` إلى بريد المدير، ثم الصقيها في **Firestore ← Rules** واضغطي Publish.
6. من **Authentication ← Settings ← Authorized domains** أضيفي `USERNAME.github.io`.
7. في `js/config.js` ضعي رقم واتساب المتجر.

## الاستخدام
- **لوحة التحكم** (زر أعلى الصفحة): دخول بالبريد وكلمة المرور ← إضافة/تعديل/حذف المنتجات وعرض الطلبات.
- أول مرة والمتجر فارغ: اضغطي «إضافة منتجات تجريبية» ثم عدّلي الصور.
- عند «إتمام الطلب» يُحفظ الطلب في Firestore ثم يُفتح واتساب بالرسالة جاهزة.

## التشغيل محلياً
وحدات ES لا تعمل من `file://`، استخدمي:
```bash
python3 -m http.server 8000
```

## النشر
GitHub: **Settings ← Pages ← Deploy from a branch ← main / root**.
