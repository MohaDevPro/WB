# WK V0 Implementation Plan

## الهدف

V0 هي أقل نسخة قابلة للاستخدام لإثبات الدورة الأساسية في WK:

> تسجيل → تفعيل البريد → دخول المجتمع → نشر منشور → تعليق وتفاعل → التسجيل في Event → الوصول إلى رابط Zoom.

V0 ليست منتجًا كاملًا. هي Proof of Concept قابل للتشغيل، مبني بطريقة تسمح بإضافة V1 لاحقًا دون إعادة كتابة Auth أو Community Core.

## الحالة التقنية المنفذة

| المجال | V0 |
|---|---|
| Web | Next.js + React + TypeScript + CSS design system |
| API | NestJS + TypeScript |
| Database | PostgreSQL |
| Rate limiting | Express rate limit، وRedis موجود في Docker Compose للتوسعة |
| Storage | MinIO/S3-compatible، ويُحجز في V0 لصورة Profile عند تفعيل مسار الرفع |
| Email | Resend لتفعيل البريد واستعادة كلمة المرور |
| Auth | Email/password، رقم الجوال كمدخل إلزامي غير موثق، sessions عبر httpOnly cookie |
| API | REST versioned تحت `/v0` مع Swagger تحت `/docs` |
| Environments | local، staging، production |
| CI | GitHub Actions للفحص والاختبار والبناء |

## ما يدخل في V0

### Auth وProfile

تتضمن V0 التسجيل بالبريد وكلمة المرور ورقم الجوال واسم العرض، وتفعيل البريد عبر Resend، إعادة إرسال التفعيل، تسجيل الدخول والخروج، استعادة كلمة المرور، تغييرها، إدارة الجلسات وإبطالها، rate limiting، security events، ومنع الحساب غير المفعّل من وظائف المجتمع والأحداث.

رقم الجوال مطلوب عند التسجيل، لكن لا يرسل النظام OTP ولا يعتبر الرقم موثقًا. يبقى `phone_verified_at` فارغًا. يحتوي Profile على `display_name` و`avatar_object_key` و`bio` فقط؛ يبقى البريد ورقم الجوال خاصين.

### Community Core

تدعم V0 مجتمعًا عامًا ينضم إليه المستخدم المفعّل تلقائيًا، ومجتمعًا مغلقًا يستطيع المستخدم رؤية اسمه ووصفه ثم إرسال طلب انضمام. لا يظهر Feed الخاص قبل قبول الطلب.

تنشئ Platform Admin المجموعات فقط. يرث الوصول إلى المجموعة من عضوية Community الأب. تطبق الأدوار التالية:

| الدور | الصلاحيات |
|---|---|
| Platform Admin | إنشاء المجتمعات والمجموعات، تعيين الأدوار، إدارة كل المحتوى والبلاغات |
| Community Admin | إدارة أعضاء ومحتوى المجتمع، قبول طلبات الانضمام، إدارة أحداث المجتمع |
| Group Moderator | إدارة محتوى المجموعة المعينة |
| Member | القراءة والنشر والتعليق والتفاعل والتسجيل في الأحداث المسموح بها |

لا يستطيع Community Admin حذف المجتمع أو إنشاء مجموعة.

### Feed والمحتوى

تستخدم V0 Feed المجتمع أو المجموعة بدل Channels. يدعم Feed منشورات نصية، تعليقات من مستوى واحد، `like` واحد، حذفًا منطقيًا، pagination أساسية، وReport. لا توجد وسائط أو ملفات داخل المنشورات أو رسائل خاصة.

تستطيع الإدارة إخفاء المحتوى أو استعادته، وتُسجل الأفعال الحساسة في `audit_events`. الإشعارات الداخلية محدودة للعضوية والتعليقات والتسجيل أو إلغاء Event.

### Events

Event في V0 فردي وغير متكرر، عام أو خاص، مرتبط بالمنصة أو Community أو Group، ويحتوي على عنوان ووصف ووقت ومنطقة زمنية ورابط Zoom.

التسجيل مباشر للأحداث العامة وللأعضاء النشطين في الأحداث الخاصة. لا يظهر رابط Zoom إلا بعد التحقق من صلاحية الوصول، ولا يرسل ضمن قائمة عامة. حالات Event هي `draft`, `published`, `cancelled`, `completed`، وحالات التسجيل هي `registered`, `cancelled`.

لا يوجد في V0 recurrence أو QR أو check-in أو waitlist أو speaker management أو attendance states أو دفع.

## المراحل المنفذة

### Phase 0 — Bootstrap

تتضمن Monorepo، تطبيق Web وAPI، Docker Compose لـ PostgreSQL وRedis وMinIO، migrations وseed، health/readiness endpoints، `.env.example`، GitHub Actions، وREADME تشغيل.

### Phase 1 — Auth وProfile

تتضمن users، profiles، sessions، email verification tokens، password reset tokens، Auth Security Events، Resend adapter، cookies آمنة، ومنع الوصول قبل تفعيل البريد.

### Phase 2 — Community Core

تتضمن communities، memberships، groups، group moderators، RBAC، طلبات الانضمام، Feed، posts، comments، likes، reports، moderation actions، notifications، وaudit events.

### Phase 3 — Events

تتضمن events، event registrations، public/private access، إنشاء وتعديل وإلغاء الحدث، تسجيل وإلغاء التسجيل، وحماية Zoom URL server-side.

### Phase 4 — Pilot Hardening

تتضمن تشغيل CI، Unit/E2E tests، مراجعة RBAC وIDOR، rate limits، backup/restore، secrets منفصلة، health checks، MFA للحسابات الإدارية قبل Pilot حساس، وسياسات مختصرة للخصوصية وقواعد المجتمع.

## التشغيل

للتطوير المحلي:

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

أو باستخدام الخدمات المحلية:

```bash
docker compose up -d postgres redis minio
pnpm db:migrate
pnpm db:seed
pnpm dev
```

تعمل Web على `http://localhost:3000`، وتعمل API على `http://localhost:4000`. توثيق API موجود في `http://localhost:4000/docs`.

القيم الافتراضية للـ seed محلية فقط: `admin@wk.local` وكلمة المرور `ChangeMe123!`. يجب تغييرها قبل أي بيئة مشتركة.

## الاختبارات ومعايير القبول

يجب أن ينجح ما يلي قبل اعتبار V0 جاهزة لـ Pilot:

1. التسجيل ثم تفعيل البريد ثم تسجيل الدخول.
2. رفض المستخدم غير المفعّل عند طلب Communities أو Events أو Feed.
3. الانضمام التلقائي إلى Public Community.
4. طلب دخول Closed Community ثم قبول أو رفض الإدارة.
5. النشر والتعليق و`like` مع منع التفاعل المكرر.
6. منع Community Admin من حذف المجتمع أو إنشاء Group.
7. إنشاء Platform Admin لمجموعة وتعيين Group Moderator.
8. الإبلاغ عن محتوى ثم إخفاؤه واستعادته.
9. إنشاء Public Event وPrivate Event.
10. تسجيل عضو في Event وعدم كشف Zoom URL لمستخدم خارج النطاق.
11. إلغاء التسجيل وإلغاء الحدث مع Notification.
12. نجاح `pnpm check`, `pnpm test`, و`pnpm build`.

## خارج V0 ومؤجل إلى V1

يؤجل إلى V1 الملف المهني المتقدم، الخبرات والشهادات والمهارات والخدمات والتوثيق، مستويات الخصوصية الخمسة، Channels كنظام مستقل، روابط الدعوة، طلب إنشاء المجتمع، العضوية المستقلة للمجموعات، الوسائط والمرفقات، Polls، الرسائل الخاصة، دليل الخبراء والخدمات، الفرص والشراكات، Contribution Signals، Points، Badges، Trust/Reputation، الأحداث المتكررة، موافقة الحضور المعقدة، QR وCheck-in، المنظمون والمتحدثون المتعددون، التسجيلات والشهادات، الدفع، Marketplace، Google/Apple Auth، OTP وMFA العام، Search متقدم، AI وmicroservices وKubernetes.

## Definition of Done

لا تعتبر ميزة V0 منجزة إلا إذا كان لها كود قابل للبناء، ومسار API موثق، وauthorization server-side، واختبار مناسب، وحالات loading/error/empty في الواجهة، وعدم تسريب secrets أو tokens أو بيانات خاصة، وتحديث للوثائق، ونجاح CI.
