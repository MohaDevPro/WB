# WK V1 Implementation Plan

## الغرض

V1 هي مرحلة التوسع بعد إثبات V0. لا تبدأ V1 قبل قياس Pilot V0، ولا تُنفذ كل القدرات دفعة واحدة. المرجع التشغيلي الأول هو `V0_IMPLEMENTATION_PLAN.md`، بينما تسجل هذه الوثيقة ما سيضاف لاحقًا فوق الأساس المنفذ.

## القرارات المعتمدة

تظل WK منصة مجتمع عام للنقاش والمعرفة مع مجتمعات متخصصة مغلقة. تنشئ Platform Admin المجتمعات والمجموعات والقنوات مركزيًا. يستطيع Community Admin إدارة مجتمعه، لكنه لا يحذف المجتمع ولا ينشئ مجموعة. يبقى Auth الأساسي بريدًا وكلمة مرور، والبريد ورقم الجوال إلزاميين عند التسجيل، مع تفعيل البريد عبر Resend قبل الاستخدام وتأجيل OTP.

المعمارية Modular Monolith داخل Monorepo، باستخدام Next.js وNestJS وPostgreSQL وRedis وS3-compatible self-hosted في Docker Compose، مع REST/OpenAPI وبيئات local/staging/production وGitHub Actions. لا تستخدم V1 microservices أو Kubernetes.

## نطاق V1 المرحلي

### 1. Profile وPrivacy وVerification

يضاف الملف المهني المتقدم، بما يشمل الخبرات والتعليم والشهادات والمهارات واللغات والخدمات والروابط والتوفر والاهتمامات. يستطيع المستخدم إظهار أو إخفاء الأقسام والعناصر.

تستخدم الخصوصية المستويات التالية:

```text
public
members_only
community_only
admins_only
private
```

يفصل النظام بين توثيق الشخص/الحساب وتوثيق الادعاء المهني. في V1 يفعّل التوثيق الإداري للشخص والمهارات والخدمات، مع بقاء الأدلة خاصة، وحالات `pending`, `verified`, `rejected`, `expired`, `revoked`، وفلترة server-side للموثقين. لا تعني الشارة اعتمادًا حكوميًا أو ضمانًا لجودة الخدمة.

### 2. Community Expansion

تضاف إدارة العضوية اليدوية، وروابط الدعوة ذات السياسات المحدودة، وطلبات إنشاء المجتمع، واقتراحات إنشاء المجموعات، مع بقاء الإنشاء النهائي بيد Platform Admin. تضاف الحالات الإدارية وسجل التدقيق وقواعد الدعوة وتفويضات أكثر دقة.

### 3. Channels

تصبح Channels كيانات نشر حقيقية، وليست tags. ينشئها Platform Admin، ويحدد نطاقها وظهورها وأدوار النشر واشتراط الموافقة ونوع المحتوى وحالتها. القنوات الافتراضية تشمل الإعلانات والأحداث والفرص والشراكات والنقاشات وExperts & Services.

تبقى قناة Demo Day خاصة، ولا يظهر محتواها أو رابط Zoom إلا للأعضاء المقبولين. تفرض صلاحيات القنوات server-side وتسجل التغييرات والنشر والإدارة في audit log.

### 4. Moderation وSafety

تتوسع البلاغات إلى moderation queue، وإجراءات قابلة للمراجعة، وسجل مخالفات محدود، وسياسة appeals، وقياس للإشراف. يمكن استخدام AI للتصنيف أو الترتيب فقط مع بقاء قرارات التعليق أو الإزالة الحساسة بشرية ومقيدة.

### 5. Events Expansion

يدعم Event Engine أحداثًا فردية ومتكررة، وسلاسل وoccurrences، وتعديل occurrence أو السلسلة، وتنظيمًا ومتحدثين متعددين، وحالات `registered`, `attended`, `no_show`، مع موافقة مسبقة للأحداث الحساسة. يظل رابط Zoom محميًا حسب العضوية والتسجيل.

لا تدخل التذاكر والمدفوعات والتسجيلات والشهادات وQR إلا بعد وجود حاجة مثبتة.

### 6. Directory وOpportunities

يضاف دليل خبراء ومقدمي خدمات على مستوى المنصة، مع فلاتر اختيارية مثل المهارة واللغة والموقع والتوفر وحالة التوثيق. تظل الخدمات تعريفية، ولا يصبح النظام Marketplace أو نظام دفع.

تضاف الوظائف والفرص والشراكات كإعلانات تديرها الإدارة أو Community Admin داخل مجتمعه، مع رابط خارجي للتقديم عند الحاجة، دون نظام تقديم أو تعاقد داخلي.

### 7. Contribution وTrust

يفصل النظام بين Contribution Signals وPoints وBadges وTrust/Reputation. تشمل الإشارات النشر والتعليق والحضور وقبول البلاغ ومساعدة الآخرين. تكون النقاط تحفيزية ولا تمنح صلاحيات حساسة تلقائيًا. تظهر الشارات العامة المناسبة، بينما تبقى تفاصيل الثقة والبلاغات للإدارة والمستخدم وفق الصلاحية.

لا تقرر السمعة وحدها قبول Demo Day، ولا يوجد Leaderboard عالمي في البداية.

## المعمارية المستهدفة

```text
Next.js Web
   |
   v
NestJS Modular Monolith
   |-- auth
   |-- profiles/privacy/verification
   |-- communities/memberships/invitations
   |-- groups/channels
   |-- content/comments/moderation
   |-- events/registrations/attendance
   |-- directory/opportunities
   |-- contributions/trust
   |-- notifications
   |-- audit/security
   |
   +--> PostgreSQL
   +--> Redis for rate limits/cache/queues
   +--> S3-compatible for avatars, evidence and approved files
   +--> worker/outbox when asynchronous work is justified
```

يبقى PostgreSQL مصدر الحقيقة. تكون Redis وFile Storage خلف abstractions. لا تستخرج الخدمات إلى microservices إلا عند وجود سبب قابل للقياس متعلق بالتوسع أو العزل الأمني أو الملكية التشغيلية.

## نموذج البيانات الإضافي

تضاف إلى جداول V0 كيانات مثل:

```text
profile_sections
profile_visibility_rules
experiences
educations
certificates
skills
services
external_links
verification_records
verification_evidence
verification_reviews
channels
channel_permissions
invitations
community_creation_requests
group_proposals
event_occurrences
event_organizers
event_speakers
event_attendance
expert_listings
service_listings
opportunities
partnership_announcements
contribution_signals
point_rules
point_ledger
badges
user_badges
trust_snapshots
```

كل إضافة تحتاج migration وقيودًا وفهارس واختبارات authorization، ولا تعرض قاعدة البيانات مباشرة عبر API.

## مراحل V1 المقترحة

| المرحلة | الهدف | بوابة القبول |
|---|---|---|
| V1.1 | تحسين Auth وMFA الإداري وإدارة العضوية | لا توجد جلسات أو صلاحيات إدارية غير قابلة للإبطال |
| V1.2 | Profile وPrivacy وVerification | لا يظهر عنصر مخفي أو دليل خاص، ولا يزور المستخدم حالة التوثيق |
| V1.3 | Channels وModeration Expansion | التفويض والنطاق والبلاغات مغطاة باختبارات رفض |
| V1.4 | Events Recurrence وAttendance | لا يتسرب رابط Event خاص عبر list أو cache أو endpoint |
| V1.5 | Directory وOpportunities | لا توجد payment أو marketplace semantics |
| V1.6 | Contribution وTrust | القواعد قابلة للتفسير ولا تمنح صلاحيات حساسة آليًا |
| V1.7 | Hardening وPilot أوسع | backup/restore وmetrics وsecurity/accessibility tests وrunbooks |

## الاختبارات

تضاف Unit Tests لقواعد privacy والعضوية والدعوات والقنوات والتكرار والتوثيق والنقاط. تضاف Integration Tests لـ PostgreSQL وRedis وObject Storage وResend وoutbox عند استخدامه. تضاف E2E للمسارات الحرجة، ومنها تفعيل البريد، الانضمام المغلق، الدعوة، تفويض القناة، Demo Day، التوثيق، وإخفاء المعلومات.

تشمل Security Tests IDOR، privilege escalation، account enumeration، إعادة استخدام token، تسريب Zoom، تخمين invitation، رفع ملفات غير آمنة، وقراءة بيانات خاصة من admin endpoints.

## التشغيل والأمن

تستخدم local بيانات وهمية، وstaging بيانات اصطناعية أو منزوعة الهوية، وproduction secrets وvolumes وbackup منفصلة. النسخ الاحتياطية تشمل PostgreSQL وObject Storage مع retention ابتدائي 30 يومًا واختبار restore دوري.

لا تسجل كلمات المرور أو OTP أو tokens أو evidence الخام. تسجل تغييرات الأدوار والعضوية والتوثيق والقنوات والمحتوى الحساس في audit log. يضاف MFA للحسابات الإدارية قبل فتح قدرات حساسة.

## ما بعد V1

تؤجل Google/Apple Auth وOTP العام، التوثيق المؤسسي، التواصل الداخلي، Marketplace والمدفوعات، التقديم الوظيفي المتكامل، QR للحضور الحضوري، البث والتسجيلات، الرسائل الخاصة، AI المتقدم، semantic search، OpenSearch، federation، Kubernetes، وmicroservices.

## علاقة V0 بهذه الخطة

V0 ليست فرعًا مؤقتًا منفصلًا؛ هي أول release عملي للمستودع. يجب أن تتوسع V1 فوق جداول Auth وCommunity وEvents الموجودة، مع migrations backward-compatible قدر الإمكان. أي تغيير يكسر الجلسات أو العضويات أو روابط Events يحتاج ADR وخطة ترحيل واختبار restore.
