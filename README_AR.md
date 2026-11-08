# QUREO Cloudflare Browser Worker

هذه نسخة Worker مستقلة لتشغيل مهام Playwright على خدمة Cloudflare Browser Run. ليست نسخة Docker/FastAPI، ولا توفر اتصال CDP دائمًا مطابقًا للسيرفر القديم. كل طلب `/run` ينفذ رحلة متصفح قصيرة ثم يعيد النتيجة.

## المتطلبات
- حساب Cloudflare.
- تفعيل/إتاحة Browser Run (Browser Rendering سابقًا) على الحساب.
- Node.js حديث على جهازك لتثبيت Wrangler والنشر.
- لا تضع أي Token داخل الكود أو GitHub.

## النشر
1. فك ضغط الملف.
2. افتح مجلد المشروع في Terminal.
3. نفّذ: `npm install`
4. أنشئ سرًا طويلًا عشوائيًا ثم خزّنه: `npx wrangler secret put API_TOKEN`
5. انشر: `npx wrangler deploy`
6. سيظهر عنوان مثل `https://qureo-browser-worker.<subdomain>.workers.dev`.

لا تحتاج إلى إضافة Browser API Token يدويًا داخل Worker؛ ربط `BROWSER` في `wrangler.toml` يستخدم Browser Run binding. إذا طلبت لوحة Cloudflare تفعيل Browser Run أو تأكيد الخطة، أكمل ذلك من لوحة الحساب.

## اختبار الصحة
افتح `https://YOUR-WORKER.workers.dev/health` وستحصل على حالة الخدمة. هذا المسار لا يشغّل Chromium.

## اختبار تشغيل Chromium
أرسل POST إلى `/run` مع Header `Authorization: Bearer YOUR_API_TOKEN` و`Content-Type: application/json`:

```json
{
  "url": "https://example.com",
  "steps": [],
  "screenshot": true
}
```

مثال باستخدام curl:

```bash
curl -X POST "https://YOUR-WORKER.workers.dev/run" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","steps":[],"screenshot":true}'
```

## الأوامر المدعومة داخل steps

```json
{"action":"fill","selector":"input[name=q]","value":"hello"}
{"action":"click","selector":"button[type=submit]"}
{"action":"wait","ms":1000}
{"action":"text","selector":"h1"}
```

## ربط بوت Wispbyte
هذا Worker ليس بديلًا مباشرًا لوحدة `client/remote_browser_client.py` القديمة؛ لأن القديمة تتوقع API جلسات FastAPI وWebSocket CDP دائمًا. هذه النسخة تعمل بنظام إرسال خطوات Playwright في طلب واحد. يلزم تعديل جزء المتصفح في البوت ليحوّل خطوات QUREO إلى طلب `/run`.

## حدود مهمة
- Browser Run على الخطة المجانية له حدود استخدام يومية وجلسات متزامنة؛ راجع صفحة Limits في وثائق Cloudflare.
- لا توجد خدمة Chromium دائمة 24/7؛ المتصفح يُفتح عند الطلب ويُغلق بعد المهمة.
- Cloudflare قد يعرّف حركة Browser Run كحركة آلية، ولا يضمن تجاوز أنظمة الحماية أو CAPTCHA.
- لا ترسل بيانات الدخول أو مفاتيح API في المحادثة. خزّنها في Cloudflare Secrets وفي متغيرات بيئة Wispbyte فقط.
