'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type User = { id: string; email: string; phoneNumber: string; displayName: string; platformRole: string; emailVerifiedAt: string | null; status: string };
type Community = { id: string; name: string; description: string; visibility: 'public' | 'closed'; membership_status: string; membership_role: string };
type Post = { id: string; author_name: string; body: string; created_at: string; comment_count: number; like_count: number; liked: boolean };
type Event = { id: string; title: string; description: string; starts_at: string; timezone: string; visibility: 'public' | 'private'; community_id: string | null; community_name?: string; registered: boolean; zoomUrl?: string | null };

type AuthMode = 'landing' | 'login' | 'register' | 'forgot' | 'verify';

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/v0/${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? data.error ?? 'حدث خطأ غير متوقع');
  return data as T;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
}

function initials(name: string) { return name.trim().slice(0, 1) || 'و'; }

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>('landing');

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('auth');
    if (requested === 'login' || requested === 'register' || requested === 'forgot' || requested === 'verify') setAuthMode(requested);
    api<{ user: User }>('auth/session').then(({ user: current }) => setUser(current)).catch(() => undefined).finally(() => setChecking(false));
  }, []);

  if (checking) return <LoadingScreen />;
  if (user) return <Dashboard user={user} onLogout={() => setUser(null)} />;
  if (authMode !== 'landing') return <AuthScreen mode={authMode} onBack={() => setAuthMode('landing')} onAuthenticated={setUser} />;
  return <Landing onLogin={() => setAuthMode('login')} onRegister={() => setAuthMode('register')} />;
}

function Topbar({ user, onLogout, onLogin, onRegister }: { user?: User | null; onLogout?: () => void; onLogin?: () => void; onRegister?: () => void }) {
  return <header className="topbar">
    <a className="brand" href="/" aria-label="WK الصفحة الرئيسية"><span className="brand-mark">و</span><span>WK</span></a>
    <div className="top-actions">
      {user ? <><span className="post-time">مرحبًا، {user.displayName}</span><button className="button ghost small" onClick={onLogout}>تسجيل الخروج</button></> : <><button className="button ghost small" onClick={onLogin}>دخول</button><button className="button primary small" onClick={onRegister}>ابدأ الآن</button></>}
    </div>
  </header>;
}

function Landing({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  return <div className="app-shell"><Topbar onLogin={onLogin} onRegister={onRegister} /><main className="landing"><div className="hero-grid"><section className="hero-copy"><h1>مساحة تعرف فيها <em>مكانك.</em></h1><p>WK يبدأ من أبسط شيء: مجتمع واضح، نقاش مفيد، ولقاء مباشر عندما يحين وقته. ادخل، ساهم، وابنِ علاقات تستحق أن تستمر.</p><div className="hero-actions"><button className="button primary" onClick={onRegister}>أنشئ حسابك</button><button className="button ghost" onClick={onLogin}>لدي حساب بالفعل</button></div><div className="hero-note"><span className="note-dot" /><span>تفعيل البريد مطلوب قبل الدخول إلى المجتمعات. رقم الجوال مطلوب عند التسجيل، لكن التحقق عبر OTP مؤجل في V0.</span></div></section><section className="preview-board" aria-label="معاينة مساحة المجتمع"><div className="preview-window"><div className="window-header"><span className="window-title">المجتمع العام</span><span className="live-pill">● متاح الآن</span></div><div className="preview-body"><div className="mini-nav"><span className="active">الرئيسية</span><span>المجموعات</span><span>الأحداث</span><span>الإشعارات</span></div><div className="mini-feed"><div className="mini-post"><strong>سارة العتيبي</strong><p>ما السؤال الذي نريد أن نخرج بإجابة عملية عنه هذا الأسبوع؟</p></div><div className="mini-event"><small>السبت · ٩:٠٠ مساءً</small><strong>جلسة مباشرة عبر Zoom</strong><small>التسجيل مفتوح للأعضاء</small></div><div className="mini-post"><strong>فريق WK</strong><p>مرحبًا بك. ابدأ من منشور واحد، أو اختر لقاءً يناسبك.</p></div></div></div></div></section></div></main></div>;
}

function AuthScreen({ mode, onBack, onAuthenticated }: { mode: Exclude<AuthMode, 'landing'>; onBack: () => void; onAuthenticated: (user: User) => void }) {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', phoneNumber: '', displayName: '', token: '' });
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setSuccess(''); setLoading(true);
    try {
      if (mode === 'register') {
        const result = await api<{ message: string }>('auth/register', { method: 'POST', body: JSON.stringify(form) }); setSuccess(result.message);
      } else if (mode === 'login') {
        const result = await api<{ user: User }>('auth/login', { method: 'POST', body: JSON.stringify({ email: form.email, password: form.password }) }); onAuthenticated(result.user);
      } else if (mode === 'forgot') {
        const result = await api<{ message: string }>('auth/password/forgot', { method: 'POST', body: JSON.stringify({ email: form.email }) }); setSuccess(result.message);
      } else {
        const result = await api<{ message: string }>('auth/email/verify', { method: 'POST', body: JSON.stringify({ token: form.token }) }); setSuccess(result.message);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'حدث خطأ'); } finally { setLoading(false); }
  }

  const copy = mode === 'register' ? ['أنشئ حسابك في WK', 'ابدأ من مجتمع عام، ثم اكتشف المساحات المغلقة التي تناسبك.'] : mode === 'login' ? ['مرحبًا بعودتك', 'أكمل من حيث توقفت.'] : mode === 'forgot' ? ['استعادة كلمة المرور', 'سنرسل رابطًا إذا كان الحساب موجودًا.'] : ['تفعيل البريد', 'ألصق رمز التفعيل الذي وصلك عبر البريد.'];
  return <div className="app-shell"><Topbar /><main className="auth-wrap"><section className="auth-card"><button className="text-link" onClick={onBack}>العودة إلى الصفحة الرئيسية</button><h1>{copy[0]}</h1><p>{copy[1]}</p><form className="form-grid" onSubmit={submit}>{mode === 'register' && <><div className="field"><label htmlFor="displayName">اسم العرض</label><input id="displayName" value={form.displayName} onChange={set('displayName')} required autoComplete="name" /></div><div className="field"><label htmlFor="phoneNumber">رقم الجوال</label><input id="phoneNumber" value={form.phoneNumber} onChange={set('phoneNumber')} required placeholder="+966..." inputMode="tel" autoComplete="tel" /></div></>}{mode !== 'verify' && <div className="field"><label htmlFor="email">البريد الإلكتروني</label><input id="email" type="email" value={form.email} onChange={set('email')} required autoComplete="email" /></div>}{(mode === 'register' || mode === 'login') && <div className="field"><label htmlFor="password">كلمة المرور</label><input id="password" type="password" value={form.password} onChange={set('password')} required minLength={10} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></div>}{mode === 'verify' && <div className="field"><label htmlFor="token">رمز التفعيل</label><input id="token" value={form.token} onChange={set('token')} required /></div>}{error && <div className="alert error" role="alert">{error}</div>}{success && <div className="alert success" role="status">{success}</div>}<div className="form-actions"><button className="button primary" disabled={loading}>{loading ? 'جارٍ التنفيذ…' : mode === 'register' ? 'إنشاء الحساب' : mode === 'login' ? 'تسجيل الدخول' : mode === 'forgot' ? 'إرسال الرابط' : 'تفعيل البريد'}</button>{mode === 'login' && <button type="button" className="text-link" onClick={() => window.location.assign('/?auth=forgot')}>نسيت كلمة المرور؟</button>}</div></form>{mode === 'login' && <p style={{ marginTop: 22, marginBottom: 0 }}>ليس لديك حساب؟ <button className="text-link" onClick={() => window.location.assign('/?auth=register')}>أنشئ حسابًا</button></p>}</section></main></div>;
}

function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selected, setSelected] = useState<Community | null>(null);
  const [scope, setScope] = useState<{ type: 'community' | 'group'; id: string }>({ type: 'community', id: '' });
  const [posts, setPosts] = useState<Post[]>([]);
  const [view, setView] = useState<'feed' | 'events' | 'profile'>('feed');
  const [notice, setNotice] = useState('');

  async function load() {
    const [communityData, eventData] = await Promise.all([api<Community[]>('communities'), api<Event[]>('events')]);
    setCommunities(communityData); setEvents(eventData);
    const first = communityData.find((item) => item.membership_status === 'active') ?? communityData[0];
    if (first) { setSelected(first); setScope({ type: 'community', id: first.id }); }
  }
  useEffect(() => { load().catch((error) => setNotice(error.message)); }, []);
  useEffect(() => { if (scope.id && view === 'feed') api<Post[]>(`feeds/${scope.type}/${scope.id}`).then(setPosts).catch((error) => setNotice(error.message)); }, [scope, view]);

  async function logout() { await api('auth/logout', { method: 'POST' }); onLogout(); }
  async function join(community: Community) { try { await api(`communities/${community.id}/join`, { method: 'POST' }); setNotice(community.visibility === 'public' ? 'تم الانضمام إلى المجتمع.' : 'تم إرسال طلب الانضمام للمراجعة.'); await load(); } catch (error) { setNotice(error instanceof Error ? error.message : 'تعذر الانضمام'); } }
  async function like(post: Post) { await api(`posts/${post.id}/like`, { method: post.liked ? 'DELETE' : 'POST' }); setPosts((current) => current.map((item) => item.id === post.id ? { ...item, liked: !item.liked, like_count: item.like_count + (item.liked ? -1 : 1) } : item)); }
  async function register(event: Event) { try { const detail = await api<Event>(`events/${event.id}/register`, { method: 'POST' }); setEvents((current) => current.map((item) => item.id === event.id ? { ...item, registered: true } : item)); setNotice('تم التسجيل. افتح تفاصيل الحدث للوصول إلى رابط Zoom.'); void detail; } catch (error) { setNotice(error instanceof Error ? error.message : 'تعذر التسجيل'); } }

  return <div className="app-shell"><Topbar user={user} onLogout={logout} /><main className="dashboard"><div className="dashboard-grid"><aside className="sidebar"><h2>مساحتك</h2><nav className="nav-list"><button className={`nav-item ${view === 'feed' ? 'active' : ''}`} onClick={() => setView('feed')}>المجتمع</button><button className={`nav-item ${view === 'events' ? 'active' : ''}`} onClick={() => setView('events')}>الأحداث</button><button className={`nav-item ${view === 'profile' ? 'active' : ''}`} onClick={() => setView('profile')}>ملفي</button></nav></aside><section className="content-panel">{notice && <div className="alert success" style={{ marginBottom: 16 }}>{notice}</div>}{view === 'feed' && <FeedView user={user} selected={selected} communities={communities} posts={posts} onSelect={(community) => { setSelected(community); setScope({ type: 'community', id: community.id }); }} onJoin={join} onLike={like} onCreated={(post) => setPosts((current) => [post, ...current])} />}{view === 'events' && <EventsView events={events} onRegister={register} />}{view === 'profile' && <ProfileView user={user} />}</section><aside className="rail"><section className="rail-card"><h3>مجتمعاتك</h3><div className="community-list">{communities.map((community) => <button key={community.id} className="community-item" onClick={() => { setSelected(community); setScope({ type: 'community', id: community.id }); setView('feed'); }}><strong>{community.name}</strong><small>{community.visibility === 'public' ? 'عام' : 'مغلق'} · {community.membership_status === 'active' ? 'عضو' : community.membership_status === 'pending' ? 'قيد المراجعة' : 'غير منضم'}</small></button>)}</div></section><section className="rail-card"><h3>اللقاء القادم</h3>{events[0] ? <div className="event-item"><small>{formatDate(events[0].starts_at)}</small><strong>{events[0].title}</strong><small>{events[0].registered ? 'أنت مسجل' : 'التسجيل مفتوح'}</small></div> : <div className="empty">لا توجد أحداث منشورة بعد.</div>}</section></aside></div></main></div>;
}

function FeedView({ user, selected, communities, posts, onSelect, onJoin, onLike, onCreated }: { user: User; selected: Community | null; communities: Community[]; posts: Post[]; onSelect: (community: Community) => void; onJoin: (community: Community) => void; onLike: (post: Post) => void; onCreated: (post: Post) => void }) {
  const [body, setBody] = useState(''); const [saving, setSaving] = useState(false); const active = selected?.membership_status === 'active';
  async function create(event: FormEvent) { event.preventDefault(); if (!selected || !body.trim()) return; setSaving(true); try { const post = await api<Post>(`feeds/community/${selected.id}/posts`, { method: 'POST', body: JSON.stringify({ body }) }); setBody(''); onCreated(post); } finally { setSaving(false); } }
  return <><div className="panel-heading"><div><h1>{selected?.name ?? 'مجتمع WK'}</h1><p>{selected?.description ?? 'اختر مساحة للبدء.'}</p></div>{selected && !active && <button className="button primary small" onClick={() => onJoin(selected)}>{selected.membership_status === 'pending' ? 'قيد المراجعة' : selected.visibility === 'public' ? 'انضمام' : 'طلب انضمام'}</button>}</div>{active ? <form className="feed-form" onSubmit={create}><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={`ما الذي تريد مشاركته في ${selected?.name ?? 'المجتمع'}؟`} maxLength={4000} /><div className="form-actions"><span className="post-time">نص فقط · {body.length}/4000</span><button className="button primary small" disabled={saving || !body.trim()}>{saving ? 'ينشر…' : 'نشر'}</button></div></form> : <div className="empty">انضم إلى هذا المجتمع حتى يظهر لك النقاش.</div>}<div className="post-list">{active && posts.length === 0 && <div className="empty">لا توجد منشورات بعد. كن أول من يبدأ النقاش.</div>}{posts.map((post) => <article className="post" key={post.id}><div className="post-meta"><div className="post-author"><span className="avatar">{initials(post.author_name)}</span>{post.author_name}</div><time className="post-time">{formatDate(post.created_at)}</time></div><p className="post-body">{post.body}</p><div className="post-actions"><button className={`action-button ${post.liked ? 'active' : ''}`} onClick={() => onLike(post)}>♥ {post.like_count}</button><span className="action-button">تعليقات {post.comment_count}</span></div></article>)}</div></>;
}

function EventsView({ events, onRegister }: { events: Event[]; onRegister: (event: Event) => void }) { return <><div className="panel-heading"><div><h1>الأحداث</h1><p>لقاءات مباشرة، بوقت واضح ورابط خاص بالأعضاء المسموح لهم.</p></div></div><div className="post-list">{events.length === 0 && <div className="empty">لا توجد أحداث منشورة حتى الآن.</div>}{events.map((event) => <article className="post" key={event.id}><div className="post-meta"><div><span className="live-pill" style={{ color: event.visibility === 'private' ? 'var(--coral-dark)' : 'var(--moss)' }}>{event.visibility === 'private' ? 'خاص' : 'عام'}</span><h2 style={{ margin: '8px 0 4px' }}>{event.title}</h2><p className="post-time">{formatDate(event.starts_at)} · {event.community_name ?? 'على مستوى المنصة'}</p></div>{event.registered ? <span className="alert success">مسجل</span> : <button className="button primary small" onClick={() => onRegister(event)}>سجل الآن</button>}</div><p className="post-body">{event.description}</p></article>)}</div></>; }

function ProfileView({ user }: { user: User }) { const [name, setName] = useState(user.displayName); const [bio, setBio] = useState(''); const [saved, setSaved] = useState(''); async function save(event: FormEvent) { event.preventDefault(); const profile = await api<{ bio: string | null }>('me/profile'); setBio(profile.bio ?? ''); await api('me/profile', { method: 'PATCH', body: JSON.stringify({ displayName: name, bio }) }); setSaved('تم حفظ الملف.'); } useEffect(() => { api<{ bio: string | null }>('me/profile').then((profile) => setBio(profile.bio ?? '')).catch(() => undefined); }, []); return <><div className="panel-heading"><div><h1>ملفي</h1><p>ملف V0 بسيط: اسم عرض، صورة اختيارية، ونبذة قصيرة.</p></div></div><form className="form-grid" onSubmit={save}><div className="field"><label htmlFor="profile-name">اسم العرض</label><input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} /></div><div className="field"><label htmlFor="profile-bio">نبذة قصيرة</label><textarea id="profile-bio" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={500} /></div>{saved && <div className="alert success">{saved}</div>}<div><button className="button primary">حفظ التغييرات</button></div></form></>; }

function LoadingScreen() { return <div className="app-shell"><Topbar /><main className="auth-wrap"><div className="empty">جارٍ تجهيز مساحة WK…</div></main></div>; }
