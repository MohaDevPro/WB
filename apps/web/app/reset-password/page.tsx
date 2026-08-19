'use client';

import { FormEvent, useState } from 'react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) { setError('رابط الاستعادة غير مكتمل.'); return; }
    const response = await fetch('/v0/auth/password/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
    const data = await response.json();
    if (!response.ok) setError(data.message ?? 'تعذر تغيير كلمة المرور'); else setMessage(data.message ?? 'تم تغيير كلمة المرور.');
  }
  return <main className="auth-wrap"><section className="auth-card"><a className="brand" href="/"><span className="brand-mark">و</span><span>WK</span></a><h1 style={{ marginTop: 28 }}>كلمة مرور جديدة</h1><p>اختر كلمة مرور جديدة لاستخدامها في تسجيل الدخول.</p><form className="form-grid" onSubmit={submit}><div className="field"><label htmlFor="password">كلمة المرور الجديدة</label><input id="password" type="password" minLength={10} required value={password} onChange={(event) => setPassword(event.target.value)} /></div>{error && <div className="alert error">{error}</div>}{message && <div className="alert success">{message}</div>}<button className="button primary">حفظ كلمة المرور</button></form></section></main>;
}
