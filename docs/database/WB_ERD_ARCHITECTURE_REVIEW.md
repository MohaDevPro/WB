# WB PostgreSQL ERD — Architecture and Best-Practice Review

**الحالة:** تقرير مراجعة مستقل؛ لم يتم تعديل ERD أو الكود أو migrations.

**الملف المراجع:** `WB_FULL_ERD_FOR_REVIEW.md`

**الحكم المختصر:** التصميم قوي كاتجاه معماري، لكنه **غير جاهز للاعتماد التنفيذي كما هو**. لا توجد مشكلة جوهرية في اختيار PostgreSQL واحدة مع Schema لكل Module، ولا في مستوى التطبيع العام، لكن توجد مجموعة من **P0 blockers** في ترتيب migrations، وقيود subtype tables، وChannel ownership، وVerification/Trust integrity، وسياسة حذف المستخدمين، وحماية أسرار Zoom. بعد معالجة هذه النقاط يصبح التصميم مناسبًا كأساس Database Foundation لـ WB Modular Monolith.

---

## 1. النتيجة النهائية

| البعد | التقييم | الحكم |
|---|---:|---|
| PostgreSQL واحدة لكل بيئة | قوي | مناسب لـ Modular Monolith، ويجنب distributed transactions غير الضرورية. |
| Schema لكل Module | قوي | مناسب للتنظيم والـownership، لكنه ليس عزلًا أمنيًا وحده؛ الصلاحيات والكود مطلوبان أيضًا. |
| Identity Root في `auth.users` | قوي | القرار صحيح ولا توجد جداول User مكررة في Modules أخرى. |
| التطبيع العام | جيد جدًا | معظم العلاقات M:N وtyped targets مطبعة؛ توجد بعض قيود integrity غير مكتملة. |
| Foreign Keys | جيد | التغطية واسعة، لكن بعض العلاقات تعتمد على triggers أو Application Logic غير محددة بما يكفي. |
| Groups | جيد | وجود `group_memberships` من البداية صحيح؛ يلزم تثبيت inherited access كقاعدة صريحة في V0. |
| Events | جيد | وجود `occurrences` وaudience subtype مناسب؛ ترتيب migration الحالي يكسر FK إلى Events. |
| Channels | غير مكتمل | توجد scope tables، لكن لا توجد Permission/Role tables، كما أن scope uniqueness غير محسوم. |
| Verification | يحتاج إصلاحًا | توجد target tables، لكن Badge ownership وrequest/target consistency تحتاج قيودًا إضافية. |
| Trust | يحتاج إصلاحًا | المصدر typed، لكن ledger يحتاج idempotency وreversal/source linkage ومصادر signals إضافية. |
| Security/Deletion | يحتاج قرارًا ملزمًا | `CASCADE` الحالي قد يتعارض مع audit/history وحذف الحسابات والمجتمعات المنشورة. |
| Migration order | حرج | `moderation` يشير إلى `event.events` قبل إنشاء Schema `event`. |

**القرار المقترح:** **Conditional Approval**؛ نوافق على المعمارية، ولا نوافق على تحويل النسخة الحالية مباشرة إلى Production migrations قبل إغلاق P0.

---

## 2. ما هو صحيح ويجب الحفاظ عليه

الاتجاه الأساسي صحيح: قاعدة PostgreSQL واحدة، مع Schemas مستقلة مثل `auth` و`profile` و`community` و`content` و`event` و`system`. PostgreSQL تتيح استخدام Schemas لتنظيم الجداول داخل قاعدة واحدة، مع إمكانية استخدام أسماء مؤهلة مثل `schema.table` وForeign Keys بين الـSchemas؛ لكنها لا تفصل الـSchemas فصلًا صارمًا مثل قواعد بيانات مستقلة.[1]

> لذلك: Schema Boundary هي Boundary تنظيمية وOwnership Boundary، وليست Security Boundary كاملة. يجب دعمها بـ `GRANT/REVOKE` وApplication Ports وRepositories وschema-qualified SQL.

اختيار Typed Subtype Tables بدل `target_type + target_id` قرار جيد عندما نحتاج Foreign Keys حقيقية. كما أن فصل `auth.users` عن `profile.profiles`، وفصل Profile عن Verification، وفصل object metadata عن S3 bytes، كلها قرارات صحيحة ومتماسكة مع التطبيع.

وجود جداول Groups وGroup Memberships وEvent Occurrences منذ البداية، مع تعطيل تفعيلها في V0، يطابق طلبك الأساسي: **Database Foundation كاملة، وApplication Code متدرج**.

---

## 3. P0 — مشاكل يجب إصلاحها قبل الاعتماد التنفيذي

### P0-1 — ترتيب Migrations غير صالح بسبب FK إلى Events

الترتيب الحالي يضع:

```text
008 moderation reports + typed targets + actions + sanctions
009 verification ...
010 event events + occurrences + audiences + registrations
```

لكن `moderation.report_event_targets.event_id` يملك Foreign Key إلى `event.events.id`. لا يمكن إنشاء FK إلى جدول لم يُنشأ بعد. هذه مشكلة تنفيذية مباشرة وليست ملاحظة تجميلية.

**التصحيح المقترح:** إما إنشاء Event قبل Moderation، أو فصل Event Target إلى migration لاحقة. الترتيب الأبسط:

```text
001 public extensions + schema_migrations
002 auth identity
003 profile
004 community
005 content
006 event core + occurrences + audiences + registrations
007 moderation reports + targets + actions + sanctions
008 verification
009 directory
010 trust
011 system
012 indexes + triggers + views
013 grants + default privileges
```

هذا الترتيب يجعل كل Parent Table موجودًا قبل أي Child FK يشير إليه.

---

### P0-2 — قاعدة Exactly-One Scope/Audience/Target ليست مضمونة تلقائيًا

الـERD يقرر أن كل Post يملك Scope واحدًا، وكل Event يملك Audience واحدًا، وكل Report يملك Target واحدًا، وكل Verification Request يملك Target واحدًا. لكن وجود ثلاث جداول subtype لا يمنع إدخال صف في جدولين في الوقت نفسه، ولا يمنع عدم وجود أي صف.

ولا ينبغي محاولة حل ذلك بـ`CHECK` يشير إلى جداول أخرى؛ PostgreSQL لا يدعم CHECK يضمن قيودًا مستمرة تعتمد على صفوف أخرى. الحل الصحيح هو `DEFERRABLE CONSTRAINT TRIGGER` أو تصميم Aggregate مختلف.[1] ويمكن جعل التحقق مؤجلًا إلى نهاية Transaction عبر `SET CONSTRAINTS`، وهو سلوك تدعمه PostgreSQL للـForeign Keys والـUnique والـConstraint Triggers القابلة للتأجيل.[4]

**المطلوب:** تعريف أربعة triggers محددة ومختبرة:

| Aggregate | القاعدة |
|---|---|
| `content.posts` | صف واحد بالضبط في `community_posts` أو `group_posts` أو `channel_posts`. |
| `event.events` | صف واحد بالضبط في `public_events` أو `private_community_events` أو `private_group_events`. |
| `moderation.reports` | صف واحد بالضبط في أحد Typed Report Targets. |
| `verification.requests` | صف واحد بالضبط في أحد Typed Verification Targets. |
| `trust.contribution_signals` | صف واحد بالضبط في أحد Source Tables عندما يكون المصدر مطلوبًا. |
| `system.notifications` | صف واحد على الأكثر في Typed Notification Links، أو تعريف واضح بأن بعض الإشعارات لا تملك Target. |

يجب أن تكون هذه triggers جزءًا من migration مستقلة، مع اختبارات INSERT/UPDATE/DELETE وpg_dump/restore.

---

### P0-3 — Channels ناقصة بالنسبة للقرار المنتجّي

القرار المعتمد يقول إن Channels هي مساحات نشر حقيقية لها صلاحيات، وأن Platform Admin ينشئها ويفوض النشر حسب Channel وCommunity وGroup. النموذج الحالي يملك:

```text
content.channels
content.community_channels
content.group_channels
```

لكنه لا يملك نموذجًا للصلاحيات، ولا يحدد من يستطيع القراءة أو النشر أو الإشراف داخل Channel. `channel_type` ليس بديلًا عن Authorization.

**التصحيح المقترح:** إضافة:

```text
content.channel_roles
content.channel_role_assignments
content.channel_permissions
```

أو نموذج أبسط وأكثر عملية:

```text
content.channel_policies
content.channel_publishers
```

ويجب أن تحدد على الأقل:

| Permission | مثال |
|---|---|
| `read` | هل كل أعضاء Community يقرأون؟ |
| `publish` | Platform Admin أو Community Admin أو Group Moderator؟ |
| `moderate` | من يخفي ويستعيد المحتوى؟ |
| `manage` | من يعدل إعدادات Channel؟ |

إذا كانت Channels ستظل V1 فقط، يجب أن تبقى الجداول في Foundation لكن لا يجوز القول إن Database Foundation مكتملة دون إضافة هذا الجزء، لأن الجداول الحالية لا تمثل القرار المعماري كاملًا.

---

### P0-4 — Scope وSlug الخاصة بـ Channels غير محسومة

`content.channels.slug` موجود في Base Table، لكنه ليس موضحًا هل هو Unique عالميًا أم فريد داخل Community/Group. غالبًا نريد Channel باسم `general` في أكثر من Community، لذلك لا ينبغي فرض Unique عالمي دون قرار صريح.

هناك خياران صحيحان:

| الخيار | التقييم |
|---|---|
| Slug عالمي داخل `content.channels` | أبسط تنفيذًا، لكنه يقيد المنتج بلا داعٍ. |
| Slug فريد داخل scope | أفضل منتجيًا؛ يتطلب أن يكون slug في Scope Table أو أن يضاف scope key إلى تصميم الفهرس بطريقة صحيحة. |

**التوصية:** اجعل `slug` داخل `community_channels` و`group_channels`، مع `UNIQUE (community_id, slug)` و`UNIQUE (group_id, slug)`، واترك Base `channels` للهوية والنوع والحالة. بذلك يكون التطبيع والـuniqueness متوافقين مع scope الحقيقي.

وينطبق مبدأ مشابه على أسماء Channels: الاسم ليس بالضرورة Unique عالميًا.

---

### P0-5 — `verification` لا يضمن تطابق نوع الطلب مع Target

`verification.requests.verification_type` يمكن أن تكون `person`، بينما يمكن نظريًا إدخال صف في `skill_targets` أيضًا. الوثيقة تذكر Exactly-One Target لكنها لا تذكر أن نوع Target يجب أن يطابق `verification_type`.

**المطلوب:** إما حذف `verification_type` واستنتاجه من subtype table، أو الإبقاء عليه وإضافة Constraint Trigger يفرض:

```text
person  ↔ person_targets فقط
skill   ↔ skill_targets فقط
service ↔ service_targets فقط
```

كذلك يجب أن يكون `verification.user_badges.verification_request_id` مرتبطًا بطلب `approved`، وأن يطابق المستخدم والهدف الصحيح. لا يكفي FK إلى Request موجود.

---

### P0-6 — Verification Badges لا تحدد الشيء الذي تم توثيقه

`verification.user_badges` مفتاحه المقترح `(user_id, badge_id)`. هذا لا يكفي إذا كان لدى المستخدم مهارتان موثقتان أو خدمتان موثقتان؛ لا نعرف من الصف أي Skill أو Service حصلت على Badge.

**التصحيح المقترح:** استخدام Award Aggregate مع Typed Target Tables:

```text
verification.badge_awards
verification.person_badge_targets
verification.skill_badge_targets
verification.service_badge_targets
```

ويكون:

```text
badge_awards(id, user_id, badge_id, verification_request_id, awarded_at, revoked_at)
skill_badge_targets(award_id, user_id, skill_id)
service_badge_targets(award_id, user_id, service_id)
```

أو إضافة `verification.user_skill_badges` و`verification.user_service_badges` منفصلين. المهم أن يظهر في Database **أي عنصر** تم توثيقه، لا أن يظهر فقط أن المستخدم يملك Badge عامة.

---

### P0-7 — Trust Ledger يحتاج Idempotency وReversal وSource

`trust.point_ledger` يحتوي `user_id` و`point_rule_id` و`points`، لكنه لا يمنع منح النقاط مرتين لنفس Contribution Signal، ولا يربط Ledger Entry صراحة بالمصدر، ولا يقدم علاقة واضحة لعكس قيد سابق.

**المطلوب:** إضافة:

```text
source_signal_id UUID NULL FK → trust.contribution_signals.id
idempotency_key VARCHAR(160) NOT NULL UNIQUE
reversal_of_entry_id UUID NULL FK → trust.point_ledger.id
entry_type VARCHAR(20) NOT NULL -- grant/reversal/adjustment
```

وعند منح النقاط يجب أن يكون هناك Unique يضمن أن نفس Signal وRule لا ينتجان Grant مكررًا. Ledger يجب أن يكون Append-only؛ التصحيح يكون بقيد عكسي لا بتعديل التاريخ.

كما أن مصادر Contribution الحالية تغطي Post وComment وEvent فقط. القرارات السابقة ذكرت حضور Event وقبول البلاغ ومساعدة الآخرين؛ يلزم إضافة مصادر مستقبلية typed، مثل:

```text
trust.signal_attendance_sources
trust.signal_moderation_sources
trust.signal_membership_sources
```

أو توثيق أن هذه الإشارات لن تدخل Foundation الحالية.

---

### P0-8 — سياسة حذف Users وCommunities تتعارض مع بعض ON DELETE CASCADE

الوثيقة تقول إن الكيانات التاريخية تعتمد على Status/Soft Delete، لكنها تضع `ON DELETE CASCADE` من `auth.users` إلى Memberships وNotifications وProfile وبعض العلاقات. إذا حُذف User فعليًا، قد تختفي عضوياته وإشعاراته، بينما قد تمنع جداول Posts/Comments الحذف بسبب `RESTRICT`. ينتج عن ذلك سلوك غير متسق.

كذلك حذف Community بـ`CASCADE` قد يحذف Groups وPosts وEvents وMemberships إذا استُخدم Hard Delete، مع أن Community المنشورة يجب أن تبقى في Audit/History.

**التوصية الملزمة:**

1. لا يوجد Hard Delete للمستخدمين في Production؛ يتم `status = deleted` مع Scrubbing للبيانات الشخصية.
2. لا يوجد Hard Delete لمجتمع منشور؛ يتم `status = disabled/archived`.
3. `CASCADE` يستخدم فقط لجداول child المؤقتة أو Draft غير المنشورة.
4. الجداول التاريخية تستخدم `RESTRICT` أو `SET NULL` وتبقى محفوظة.
5. إضافة `deleted_at` و`deleted_by` حيث يحتاج المنتج إلى تتبع الحذف، وليس الاعتماد على `status` وحده.

هذا يتوافق مع مبدأ أن اختيار `CASCADE` أو `RESTRICT` يعتمد على كون الكيان Child مستقلًا أم Component لا يعيش بدونه.[1]

---

### P0-9 — Zoom URL سر حساس ويجب ألا يكون Text مكشوفًا

`event.occurrences.zoom_url TEXT NOT NULL` يسهل التطبيق، لكنه يجعل رابط Zoom السري مكشوفًا لأي من يملك قراءة الجدول أو Backup أو Dump. إخفاؤه من API ليس كافيًا.

**التصحيح المقترح:** أحد الخيارين:

| الخيار | التوصية |
|---|---|
| `zoom_url_encrypted BYTEA` مع Key Management خارج DB | مناسب إذا كان الرابط يجب تخزينه داخل PostgreSQL. |
| `zoom_secret_reference TEXT` إلى Secret Manager | أفضل أمنيًا إن توفر Secret Manager. |

في الحالتين يبقى API هو الذي يتحقق من Registration/Access قبل إرجاع رابط مؤقت أو الرابط المفكوك. لا يسجل الرابط في Audit أو Logs.

---

## 4. P1 — فجوات مهمة يجب إغلاقها قبل V1

| Gap | المشكلة | التوصية |
|---|---|---|
| Group inherited access | V0 يقول إن Group ترث Community، لكن لا توجد View أو Rule موحدة للتحقق من ذلك. | تعريف `community.effective_group_access` View أو Access Port، مع منع V0 من قراءة `group_memberships` كشرط وحيد. |
| Community Admin boundary | `membership_roles` يمثل الدور لكنه لا يمنع Community Admin من تعديل Community أخرى. | Authorization Service يفحص membership scope؛ DB لا تكفي وحدها. |
| Role drift | وجود `member` كصف Role داخل `membership_roles` قد يؤدي إلى Membership نشطة بلا Member role. | اجعل `member` حالة افتراضية، وخزن فقط elevated roles مثل `community_admin` و`moderator`، أو أضف trigger يفرض الدور. |
| Notification target | Typed links موجودة لكن Exactly-One أو event source غير مضمون. | Trigger أو تصميم Notification Aggregate واضح يدعم إشعارات بلا target. أضف `actor_id` و`dedupe_key`. |
| Event access rules | `rule_value TEXT` غير مطبع ولا يضمن نوع القيمة. | استخدم Typed access rule tables أو Catalog + typed value columns. |
| Event registration | Unique `(occurrence_id,user_id)` جيد، لكن يجب تعريف إعادة التسجيل بعد cancellation. | إما تحديث الصف نفسه أو partial unique index على active registrations مع history منفصل. |
| Profile visibility | visibility موجودة في Profile وبعض child tables، لكن لا يوجد نموذج موحد لحساب viewer eligibility. | Application Policy واحدة؛ لا تعتمد على DB column فقط. |
| `auth.users` email | `CITEXT` جيد، لكن normalization وlowercase policy وemail change history غير موثقة. | أضف `email_changed_at` أو `auth.email_change_requests` عند الحاجة. |
| Phone uniqueness | رقم الهاتف UK جيد، لكن تطبيع E.164 يجب أن يكون Regex واضحًا. | `^ + [1-9][0-9]{1,14}$` بعد إزالة escaping في SQL أو استخدام Regex PostgreSQL الصحيح. |
| Attachment ownership | `post_attachments` يثبت Attachment وPost، لكنه لا يثبت أن uploader يملك حق إرفاقه. | Application transaction أو claim/scan status قبل ربط الملف. |
| Moderation scope | Report User Target لا يوضح Community scope. | أضف `community_id NULL` إلى Reports أو Typed scope tables إذا كانت البلاغات قابلة للتوجيه على مستوى Community. |
| Moderation actor authority | FK إلى User لا يثبت أنه Moderator/Admin. | Application Authorization + optional snapshot of role used. |
| Audit integrity | `resource_type/resource_id` polymorphic مقبول للتدقيق، لكنه ليس FK. | أبقه محصورًا في Audit، وأضف `correlation_id`, `request_id`, `ip_hash`, `actor_type`. |
| Outbox idempotency | Outbox يملك attempts/status لكن لا يملك dedupe. | أضف `dedupe_key UNIQUE` و`locked_at` و`last_attempt_at`. |
| Job concurrency | `job_records` لا يحتوي lease/lock أو unique active key. | أضف `locked_until`, `worker_id`, وUnique للـjob business key. |
| Catalog consistency | `profile.skills` و`profile.services` وBadge catalogs تحتاج lifecycle. | أضف `created_by`, `archived_at` أو وضح أنها seed-only catalogs. |

---

## 5. Normalization review

التصميم قريب من 3NF في أغلب Domains. Junction Tables للمهارات والخدمات والعضويات والعلاقات بين Listings وCommunities صحيحة، كما أن Typed Tables تحل مشكلة الـPolymorphic Foreign Keys.

لكن Full Normalization لا يعني فقط فصل الجداول؛ بل يعني أيضًا أن كل Dependency منطقية ممثلة بقيود أو علاقة. أهم نقاط التطبيع التي تحتاج تثبيتًا هي:

| الموضع | التقييم |
|---|---|
| `profile.user_skills` و`profile.user_services` | صحيح؛ علاقات M:N مطبعة. |
| Verification skill/service target | جيد مع Composite FK إلى Owned Profile Relation. |
| Event audience | صحيح كمبدأ، لكنه يحتاج Exactly-One Trigger. |
| Post scope | صحيح كمبدأ، لكنه يحتاج Exactly-One Trigger وChannel permissions. |
| Audit `resource_type/resource_id` | مقبول استثناءً لأنه Audit Envelope وليس Business Entity. |
| Outbox `aggregate_type/aggregate_id` | مقبول لأنه Integration Envelope، مع ضرورة Version وIdempotency. |
| `event.access_rules.rule_value` | غير مكتمل تطبيعيًا؛ يفضل Typed Rules. |
| `verification.user_badges` | غير كافٍ لتحديد Skill/Service الموثقة؛ يحتاج Typed Badge Targets. |
| `trust.point_ledger` | يحتاج Source/Idempotency/Reversal حتى يكون Ledger قابلًا للمراجعة. |

---

## 6. Modular Monolith review

المعمارية صحيحة بشرط ألا يتحول `schema-per-module` إلى مجرد أسماء في SQL مع استمرار كل Service في الوصول إلى جداول Modules الأخرى مباشرة. PostgreSQL تسمح بالوصول إلى Objects في Schemas مختلفة حسب الصلاحيات؛ ولذلك يجب أن يظل Ownership الأساسي في NestJS عبر Repositories وApplication Ports.[2] [3]

القاعدة المقترحة للكود هي:

```text
Module A Application Service
    -> Module B Port/Interface
        -> Module B Application Service
            -> Module B Repository
                -> module_b.table
```

ولا ينبغي أن يصبح:

```text
Module A Service
    -> SELECT ... FROM module_b.table
```

حتى عندما يكون Cross-schema FK مطلوبًا. الـFK يحمي Referential Integrity، أما Port فيحمي Business Ownership.

على مستوى PostgreSQL يجب وجود أدوار منفصلة:

| Role | الصلاحية |
|---|---|
| `wb_migrator` | DDL وملكية Schemas والجداول أثناء migrations فقط. |
| `wb_app` | `USAGE` على Schemas وDML المطلوب؛ لا `CREATE/ALTER/DROP`. |
| `wb_readonly` | قراءة محدودة للتقارير والفحص. |

`USAGE` على Schema يسمح بالوصول إلى Objects إذا سمحت صلاحيات Object نفسها، و`CREATE` هو الذي يسمح بإنشاء Objects داخل Schema؛ لذلك يجب عدم إعطاء `CREATE` لـ`wb_app`.[2] [3]

---

## 7. Migration order المقترح بعد التصحيح

```text
001_bootstrap_extensions_and_ledger
002_auth_identity
003_auth_sessions_tokens_security
004_profile_core_catalogs_professional
005_community_core_memberships_groups
006_content_core_channels_posts_comments
007_event_core_occurrences_audiences_registrations
008_moderation_reports_targets_actions_sanctions
009_verification_requests_targets_evidence_reviews_badges
010_directory_listings_opportunities_partnerships
011_trust_signals_sources_rules_ledger_badges
012_system_audit_notifications_outbox_jobs
013_indexes_and_composite_foreign_keys
014_deferrable_exactly_one_triggers
015_views_effective_access_and_read_models
016_grants_default_privileges_comments
```

السبب في وضع Event قبل Moderation هو أن `moderation.report_event_targets` يحتاج `event.events`. أما `system` فيأتي بعد Domains التي تشير إليه منطقيًا، ويجب أن تظل Notification Link FKs بعد إنشاء `content`, `event`, و`community`.

---

## 8. Indexes المطلوبة وليست اختيارية في التطبيق الحقيقي

PostgreSQL تنشئ Indexes تلقائيًا للـPrimary Keys وUnique Constraints، لكنها لا تنشئ Index على أعمدة Foreign Key في الجدول child تلقائيًا؛ لذلك يجب تعريف Indexes على أعمدة الربط المستخدمة في Joins وDelete/Update paths.[1]

| Table | Index مقترح |
|---|---|
| `community.memberships` | `(user_id, status)` و`(community_id, status)`. |
| `community.membership_requests` | Partial unique `(community_id,user_id) WHERE status='pending'`. |
| `community.group_memberships` | `(user_id, status)` و`(group_id, status)`. |
| `content.posts` | `(author_id, created_at DESC)` وIndexes على Typed Scope Tables. |
| `content.comments` | `(post_id, created_at)`. |
| `content.reactions` | PK يبدأ بـ`post_id`, جيد للتجميع؛ أضف `(user_id, created_at)` إذا احتاجت صفحة المستخدم ذلك. |
| `event.occurrences` | `(starts_at, status)` و`(event_id, sequence_no)` Unique. |
| `event.registrations` | `(user_id, status)` و`(occurrence_id, status)`. |
| `moderation.reports` | `(status, created_at)` وindexes على كل Typed Target. |
| `verification.requests` | `(requested_by, status)` و`(status, submitted_at)`. |
| `trust.point_ledger` | `(user_id, created_at)` وUnique idempotency. |
| `system.notifications` | `(user_id, read_at, created_at DESC)`. |
| `system.outbox_events` | Partial index على pending/available events. |
| `system.audit_events` | `(actor_id, created_at)` و`(resource_type, resource_id, created_at)`. |

---

## 9. ما لا أعده Gap

وجود جداول V1 وPost-V1 داخل Database Foundation ليس Overengineering في هذا السياق؛ هذا مقصود منك. لكن يجب الفصل الصريح بين **وجود Schema/Table** و**تفعيل Use Case**.

كذلك وجود `group_memberships` منذ البداية ليس خطأ؛ بل هو الشكل الصحيح إذا كانت Database يجب أن تكون كاملة. الخطأ الوحيد سيكون إذا جعل V0 يعتمد على هذه الجداول قبل أن تعتمد سياسة Group-specific membership، أو إذا لم يعرف Access Layer أن V0 يستخدم Community inheritance.

وجود `event.occurrences` في V0 ليس خطأ أيضًا. يتم إنشاء Occurrence واحدة، وتظل Recurrence مجرد قدرة مستقبلية على نفس النموذج.

---

## 10. Required changes checklist

قبل الاعتماد التنفيذي، يجب إضافة أو حسم العناصر التالية:

| الأولوية | التغيير |
|---|---|
| P0 | إصلاح ترتيب Migrations بحيث يأتي Event قبل Moderation Event Targets. |
| P0 | تنفيذ Exactly-One Deferrable Constraint Triggers لكل Typed Aggregate. |
| P0 | إضافة Channel permission/publisher model أو تقليص قرار Channels بوضوح. |
| P0 | حسم Channel slug uniqueness داخل scope. |
| P0 | فرض تطابق Verification type مع Target. |
| P0 | إعادة تصميم Verification Badge Awards لإظهار Skill/Service الموثقة. |
| P0 | إضافة Trust ledger source/idempotency/reversal. |
| P0 | اعتماد سياسة No Hard Delete للمستخدمين والمجتمعات المنشورة. |
| P0 | تشفير Zoom URL أو استبداله بـ Secret Reference. |
| P1 | إضافة inherited Group access View/Port واختبارات الوصول. |
| P1 | حسم role model: default member مقابل تخزين member role. |
| P1 | Typed Event Access Rules. |
| P1 | Notification actor/dedupe/target policy. |
| P1 | Outbox dedupe/locking، وJob leases. |
| P1 | Moderation scope وrole authority. |
| P1 | Indexes لكل Foreign Key ومسارات القراءة والحذف. |
| P2 | تحسين naming وdocumentation packaging وgenerated diagrams. |

---

## 11. Final approval recommendation

التوصية ليست إعادة تصميم كاملة. التوصية هي **اعتماد المعمارية بعد Patch Set محدد**:

1. حافظ على PostgreSQL واحدة وSchema لكل Module.
2. حافظ على Cross-schema Foreign Keys وTyped Tables.
3. صحح migration dependency graph.
4. أضف triggers والقيود التي تجعل Exactly-One قاعدة فعلية لا مجرد نص.
5. أكمل Channels وVerification وTrust لأن Database Foundation معلنة بأنها كاملة.
6. ثبّت سياسة Soft Delete/Anonymization.
7. احمِ Zoom secrets.
8. أكمل Indexes وRoles وOutbox idempotency.

**الحكم النهائي:**

> **المعمارية: معتمدة من حيث الاتجاه.**
>
> **ERD الحالي: يحتاج تعديلات P0 قبل الاعتماد التنفيذي.**
>
> **بعد إغلاق P0: يصبح مناسبًا للتحويل إلى migrations كاملة وتنفيذ NestJS Modular Monolith تدريجيًا عبر V0 ثم V1.**

---

## References

[1]: https://www.postgresql.org/docs/current/ddl-constraints.html "PostgreSQL Documentation — Constraints"

[2]: https://www.postgresql.org/docs/current/ddl-schemas.html "PostgreSQL Documentation — Schemas"

[3]: https://www.postgresql.org/docs/current/ddl-priv.html "PostgreSQL Documentation — Privileges"

[4]: https://www.postgresql.org/docs/current/sql-set-constraints.html "PostgreSQL Documentation — SET CONSTRAINTS"
