import { expect, test, type Page } from '@playwright/test';

const admin = {
  email: process.env.SEED_ADMIN_EMAIL ?? 'admin@wb.local',
  password: process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!',
};

async function loginAsAdmin(page: Page) {
  await page.goto('/?auth=login');
  await expect(page.getByRole('heading', { name: 'مرحبًا بعودتك' })).toBeVisible();
  await page.getByLabel('البريد الإلكتروني').fill(admin.email);
  await page.getByLabel('كلمة المرور').fill(admin.password);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await expect(page.getByRole('navigation', { name: 'التنقل الرئيسي' })).toBeVisible();
  await expect(page.getByRole('banner').getByText('WB Platform Admin')).toBeVisible();
}

test.describe('WB V0 browser flows', () => {
  test('landing page opens the Arabic auth flow', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /مساحة تعرف فيها/ })).toBeVisible();
    await page.getByRole('button', { name: 'لدي حساب بالفعل' }).click();
    await expect(page.getByRole('heading', { name: 'مرحبًا بعودتك' })).toBeVisible();
    await expect(page.getByLabel('البريد الإلكتروني')).toBeVisible();
    await expect(page.getByLabel('كلمة المرور')).toBeVisible();
  });

  test('admin can log in and load the community dashboard', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'WB Community' })).toBeVisible();
    await expect(page.getByText('مجتمعاتك')).toBeVisible();
    await expect(page.getByRole('button', { name: 'الإدارة' })).toBeVisible();
  });

  test('admin can publish, like, and comment on a post', async ({ page }) => {
    await loginAsAdmin(page);
    const body = `E2E post ${Date.now()}`;
    await page.getByLabel('نص المنشور').fill(body);
    await page.getByRole('button', { name: 'نشر المنشور' }).click();

    const post = page.locator('article.post').filter({ hasText: body });
    await expect(post).toContainText(body);
    await post.getByRole('button', { name: 'الإعجاب بالمنشور' }).click();
    await post.getByRole('button', { name: /التعليقات/ }).click();
    await post.getByLabel('تعليق جديد').fill('تعليق E2E مفيد');
    await post.getByRole('button', { name: 'إضافة' }).click();
    await expect(post).toContainText('تعليق E2E مفيد');
  });

  test('dashboard navigation renders events, notifications, profile, and admin views', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: 'الأحداث' }).click();
    await expect(page.getByRole('heading', { name: 'الأحداث' })).toBeVisible();

    await page.getByRole('button', { name: 'الإشعارات' }).click();
    await expect(page.getByRole('heading', { name: 'الإشعارات' })).toBeVisible();

    await page.getByRole('button', { name: 'ملفي' }).click();
    await expect(page.getByRole('heading', { name: 'ملفي' })).toBeVisible();
    await page.getByLabel('نبذة قصيرة').fill('اختبار E2E لملف WB.');
    await page.getByRole('button', { name: 'حفظ التغييرات' }).click();
    await expect(page.getByRole('status')).toContainText('تم حفظ الملف');

    await page.getByRole('button', { name: 'الإدارة' }).click();
    await expect(page.getByRole('heading', { name: 'الإدارة' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'إنشاء مجتمع' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'نشر حدث مباشر' })).toBeVisible();
  });

  test('landing page remains usable on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /مساحة تعرف فيها/ })).toBeVisible();
    const fitsViewport = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(fitsViewport).toBe(true);
  });
});
