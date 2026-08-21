# WB V1 Decision Log

هذا السجل يلخص القرارات التي تحكم الانتقال من V0 إلى V1.

| القرار | المعتمد |
|---|---|
| هوية المنتج | مجتمع عام للنقاش والمعرفة مع مجتمعات متخصصة مغلقة |
| إنشاء المساحات | Platform Admin ينشئ Communities وGroups وChannels |
| Community Admin | يدير مجتمعه، لكنه لا يحذف المجتمع ولا ينشئ مجموعة |
| العضوية | Public Community مفتوح، Closed Community يدعم طلب الانضمام؛ الدعوات مؤجلة |
| Auth | Email/password، البريد والجوال إلزاميان، تفعيل البريد عبر Resend قبل الاستخدام |
| OTP | مؤجل؛ إدخال الجوال لا يعني التحقق |
| MFA | حسابات الإدارة أولًا؛ MFA العام مؤجل |
| Profile | V1 ملف مهني متقدم مع تحكم في الظهور |
| Verification | توثيق إداري للشخص والمهارات والخدمات فقط، والأدلة خاصة |
| Privacy | `public`, `members_only`, `community_only`, `admins_only`, `private` |
| Channels | مساحات نشر حقيقية تنشئها الإدارة مع تفويض نشر صريح |
| Events | فردية ومتكررة، عامة وخاصة، مباشرة عبر Zoom؛ QR مؤجل |
| Demo Day | قناة/حدث خاص لا يظهر محتواه أو رابط Zoom خارج المقبولين |
| Contribution | Signals وPoints وBadges وTrust طبقات منفصلة؛ لا تمنح صلاحيات حساسة تلقائيًا |
| Infrastructure | PostgreSQL وRedis وS3-compatible self-hosted داخل Docker Compose |
| Environments | local، staging، production |
| Deployment | GitHub Actions، وproduction بموافقة يدوية |
| Architecture | Modular Monolith؛ لا microservices أو Kubernetes في V1 |

## أثر القرارات على الكود

يجب أن تبقى `email_verified_at` منفصلة عن `phone_verified_at` و`verified_profile`. يجب أن تفرض الخصوصية والصلاحيات في الخادم لا في الواجهة. يجب تسجيل تغييرات الأدوار والعضوية والتوثيق والقنوات والمحتوى الحساس في audit log. يجب أن تبقى روابط Zoom الخاصة محمية بفحص الصلاحية والتسجيل.

## ما يؤجل بعد V1

Google/Apple Auth، OTP العام، توثيق جهة العمل، Marketplace والمدفوعات، الرسائل الخاصة، التقديم الوظيفي المتكامل، AI المتقدم، semantic search، OpenSearch، federation، Kubernetes، وmicroservices.
