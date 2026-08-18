export default function HomePage() {
  return (
    <main className="page-shell">
      <section aria-labelledby="foundation-title" className="foundation-card">
        <p className="eyebrow">WB</p>
        <h1 id="foundation-title">أساس منصة WB قيد البناء</h1>
        <p>
          تم إعداد نقطة انطلاق آمنة وقابلة للتحقق للتطوير. ستُبنى الميزات تدريجياً وفق معايير الثقة
          والخصوصية وإتاحة الاستخدام ودعم العربية والإنجليزية.
        </p>
        <p className="status" role="status">
          <span aria-hidden="true" className="status-indicator" />
          حالة الأساس: جاهز للتحقق
        </p>
        <p dir="ltr" lang="en" className="english-note">
          WB foundation is ready for verification. Product capabilities are introduced in reviewed
          increments.
        </p>
      </section>
    </main>
  );
}
