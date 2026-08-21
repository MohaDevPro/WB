'use client';

import { useEffect, useState } from 'react';

export default function VerifyEmailPage() {
  const [state, setState] = useState('جارٍ تفعيل البريد…');
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) { setState('رابط التفعيل غير مكتمل.'); return; }
    fetch('/v0/auth/email/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.message ?? 'تعذر تفعيل البريد'); setState(data.message ?? 'تم تفعيل البريد بنجاح.'); })
      .catch((error: Error) => setState(error.message));
  }, []);
  return <main className="auth-wrap"><section className="auth-card"><a className="brand" href="/"><span className="brand-mark">و</span><span>WB</span></a><h1 style={{ marginTop: 28 }}>نتيجة التفعيل</h1><p>{state}</p><a className="button primary" href="/">العودة إلى WB</a></section></main>;
}
