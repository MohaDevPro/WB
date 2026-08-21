# استراتيجية الاختبار والجودة في WB V0

تستخدم WB طبقات اختبار متدرجة بدل اعتبار نجاح `pnpm test` وحده دليلًا على اكتمال V0. الهدف هو إثبات دورة الاستخدام الأساسية: التسجيل، تفعيل البريد، الدخول، الوصول إلى المجتمع، النشر والتعليق والإبلاغ، التسجيل في حدث، ثم تنفيذ قرارات الإدارة بصلاحيات واضحة.

## الاختبارات الموجودة

| الطبقة | النطاق | الأداة | بوابة النجاح |
|---|---|---|---|
| Unit / Domain | `apps/api/src/common/v0-rules.ts` وقواعد password وphone وcontent وmembership | Vitest | كل الاختبارات ناجحة |
| Service boundary | AuthService وContentService في الحالات غير الصحيحة قبل DB writes | Vitest مع mocks | رفض input غير الصالح دون transaction أو query |
| Coverage | قواعد V0 الحرجة | Vitest + `@vitest/coverage-v8` | ≥ 80% lines وbranches؛ الوضع الحالي 100% |
| Mutation | تغيير قواعد V0 آليًا والتحقق من قدرة الاختبارات على كشف التغيير | Stryker | ≥ 70%؛ الوضع الحالي 92.31% |
| Database smoke | تطبيق `001_bootstrap.sql` و`002_modular_schemas.sql` وseed على PostgreSQL نظيفة | GitHub Actions PostgreSQL service | 167 Foreign Keys وسجلتا migrations |
| UI quality | RTL، focus-visible، reduced motion، browser surfaces وعدم gradient text | Impeccable محليًا + `scripts/ui-quality-check.mjs` في CI | لا findings حرجة |
| Browser E2E | Landing، Auth login، Dashboard، Feed post/like/comment، Events، Notifications، Profile، Admin، responsive mobile | Playwright Chromium | كل الرحلات الأساسية ناجحة؛ الوضع الحالي 5/5 |
| Type/build | API وWeb | TypeScript وNext.js | `pnpm check` و`pnpm build` ناجحان |

## الأوامر المحلية

```bash
pnpm check
pnpm test
pnpm test:coverage
pnpm test:mutation
pnpm quality:metrics
pnpm quality
pnpm test:e2e
pnpm build
node scripts/ui-quality-check.mjs
```

يولد `pnpm quality:metrics` التقرير `docs/quality/UNCLE_BOB_METRICS.md`. أما artifacts الكبيرة مثل `coverage/` و`reports/mutation/` و`reports/ui/` فهي مستبعدة من Git وتُرفع كـGitHub Actions artifacts فقط.

## Quality Gates

توقف CI عند انخفاض coverage عن 80%، أو mutation score عن 70%، أو ظهور circular relative dependencies، أو فشل typecheck/tests/build، أو مخالفة قواعد UI الآلية، أو فشل Playwright browser E2E. ويقيس Uncle Bob metrics التعقيد وحجم الملفات والدوال وبنية الاعتماديات في كل تشغيل.

## V0 journeys التي يجب استمرار اختبارها

1. **Auth**: كلمة مرور لا تقل عن 10 أحرف، phone بصيغة E.164، اسم عرض غير فارغ، جلسة مفعّلة، وتفعيل البريد.
2. **Community**: المجتمع العام ينشئ membership فعالًا، والمجتمع المغلق ينشئ طلبًا pending، مع منع كشف تفاصيل مغلقة قبل الوصول.
3. **Content**: منع المنشور والتعليق والبلاغ الفارغ، والتحقق من صلاحية الوصول قبل القراءة والكتابة.
4. **Moderation**: إظهار تقارير المجتمع للمدير المختص فقط، وربط action بالـreport والهدف الصحيح.
5. **Events**: الحدث العام متاح، والحدث الخاص يتطلب العضوية، ورابط Zoom لا يظهر قبل التسجيل ويُخزّن مشفرًا.
6. **Notifications**: إشعارات التعليقات وقرارات العضوية وتحديثات الأحداث typed وقابلة لتحديدها كمقروءة.
7. **UI**: حالات loading وerror وempty، keyboard focus، RTL، mobile layout، وreduced-motion.

## حدود V0 الحالية

تعمل الآن Playwright browser E2E على PostgreSQL seed قابلة لإعادة الإنشاء. يغطي الاختبار landing/auth، تسجيل الدخول، dashboard، النشر والإعجاب والتعليق، التنقل إلى events وnotifications وprofile وadmin، والاستجابة على شاشة هاتف. تبقى اختبارات database integration الأعمق للمعاملات وحالات الصلاحيات أولوية لاحقة منفصلة عن رحلة المتصفح.
