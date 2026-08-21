'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';

type User = {
  id: string;
  email: string;
  phoneNumber: string;
  displayName: string;
  platformRole: string;
  emailVerifiedAt: string | null;
  status: string;
};

type Community = {
  id: string;
  name: string;
  slug?: string;
  description: string;
  visibility: 'public' | 'closed';
  membership_status: string;
  membership_roles?: string;
  membership_role?: string;
};

type Group = { id: string; name: string; description: string; directly_joined?: boolean };

type Post = {
  id: string;
  author_id?: string;
  author_name: string;
  body: string;
  created_at: string;
  updated_at?: string;
  comment_count: number;
  like_count: number;
  liked: boolean;
};

type Comment = { id: string; author_id: string; author_name: string; body: string; created_at: string };

type WbEvent = {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at?: string | null;
  timezone: string;
  visibility: 'public' | 'private';
  community_id: string | null;
  group_id?: string | null;
  community_name?: string;
  registered: boolean;
  status: string;
  occurrence_status?: string;
};

type EventDetail = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt?: string | null;
  timezone: string;
  visibility: 'public' | 'private';
  communityId: string | null;
  groupId?: string | null;
  status: string;
  occurrenceId: string;
  registered: boolean;
  zoomUrl?: string | null;
};

type Notification = {
  id: string;
  notification_type: string;
  read_at: string | null;
  created_at: string;
  actor_id?: string;
  post_id?: string | null;
  occurrence_id?: string | null;
  event_kind?: string | null;
  decision?: string | null;
};

type MembershipRequest = {
  id: string;
  user_id: string;
  email: string;
  display_name?: string | null;
  reason?: string | null;
  created_at: string;
};

type AuthMode = 'landing' | 'login' | 'register' | 'forgot' | 'verify';
type View = 'feed' | 'events' | 'notifications' | 'profile' | 'admin';
type Notice = { tone: 'success' | 'error'; message: string } | null;

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/v0/${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? data.error ?? 'حدث خطأ غير متوقع');
  return data as T;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'وقت غير متاح';
  return date.toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
}

function initials(name: string) {
  return name.trim().slice(0, 1) || 'و';
}

function communityRoles(community: Community | null) {
  return (community?.membership_roles ?? community?.membership_role ?? '').split(',').filter(Boolean);
}

function isAdminFor(user: User, community: Community | null) {
  return user.platformRole === 'platform_admin' || communityRoles(community).includes('community_admin');
}

function notificationText(notification: Notification) {
  if (notification.notification_type === 'post_comment') return 'لديك تعليق جديد على منشورك.';
  if (notification.notification_type === 'event') {
    if (notification.event_kind === 'cancelled') return 'تم إلغاء حدث كنت مسجلًا فيه.';
    if (notification.event_kind === 'updated') return 'تم تحديث حدث أنت مسجل فيه.';
    return 'تم تسجيلك في حدث مباشر.';
  }
  if (notification.notification_type === 'membership') return notification.decision === 'active' ? 'تم قبول طلب انضمامك.' : 'تم رفض طلب انضمامك.';
  return 'لديك إشعار جديد في WB.';
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>('landing');

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('auth');
    if (requested === 'login' || requested === 'register' || requested === 'forgot' || requested === 'verify') setAuthMode(requested);
    api<{ user: User }>('auth/session')
      .then(({ user: current }) => setUser(current))
      .catch(() => undefined)
      .finally(() => setChecking(false));
  }, []);

  if (checking) return <LoadingScreen />;
  if (user) return <Dashboard user={user} onLogout={() => setUser(null)} />;
  if (authMode !== 'landing') return <AuthScreen mode={authMode} onBack={() => setAuthMode('landing')} onAuthenticated={setUser} />;
  return <Landing onLogin={() => setAuthMode('login')} onRegister={() => setAuthMode('register')} />;
}

function Topbar({ user, onLogout, onLogin, onRegister }: { user?: User | null; onLogout?: () => void; onLogin?: () => void; onRegister?: () => void }) {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="WB الصفحة الرئيسية">
        <span className="brand-mark">و</span>
        <span>WB</span>
      </a>
      <div className="top-actions">
        {user ? (
          <>
            <span className="user-chip"><span className="status-dot" />{user.displayName}</span>
            <button className="button ghost small" onClick={onLogout}>تسجيل الخروج</button>
          </>
        ) : (
          <>
            <button className="button ghost small" onClick={onLogin}>دخول</button>
            <button className="button primary small" onClick={onRegister}>ابدأ الآن</button>
          </>
        )}
      </div>
    </header>
  );
}

function Landing({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  return (
    <div className="app-shell">
      <Topbar onLogin={onLogin} onRegister={onRegister} />
      <main className="landing">
        <div className="hero-grid">
          <section className="hero-copy">
            <h1>مساحة تعرف فيها <em>مكانك.</em></h1>
            <p>مجتمع عام للنقاش والمعرفة، ومساحات مغلقة تُدار بعناية، ولقاءات مباشرة تصل إليها عندما تكون ضمن جمهورها.</p>
            <div className="hero-actions">
              <button className="button primary" onClick={onRegister}>أنشئ حسابك</button>
              <button className="button ghost" onClick={onLogin}>لدي حساب بالفعل</button>
            </div>
            <div className="hero-note"><span className="note-dot" /><span>تفعيل البريد مطلوب قبل استخدام المنصة. رقم الجوال مطلوب عند التسجيل، بينما التحقق عبر OTP مؤجل في V0.</span></div>
          </section>
          <section className="preview-board" aria-label="معاينة مساحة المجتمع">
            <div className="preview-window">
              <div className="window-header"><span className="window-title">لوحة WB</span><span className="live-pill"><span className="status-dot warm" /> متاح للأعضاء</span></div>
              <div className="preview-body">
                <div className="mini-nav"><span className="active">المجتمع</span><span>الأحداث</span><span>الإشعارات</span></div>
                <div className="mini-feed">
                  <div className="mini-post"><strong>سارة العتيبي</strong><p>ما السؤال الذي نريد أن نخرج بإجابة عملية عنه هذا الأسبوع؟</p></div>
                  <div className="mini-event"><small>السبت · ٩:٠٠ مساءً</small><strong>جلسة مباشرة عبر Zoom</strong><small>التسجيل مفتوح للأعضاء</small></div>
                  <div className="mini-post"><strong>فريق WB</strong><p>ابدأ من منشور واحد، أو اختر لقاءً يناسبك.</p></div>
                </div>
              </div>
            </div>
          </section>
        </div>
        <section className="landing-proof" aria-label="ما الذي يقدمه WB">
          <div><strong>نقاش له سياق</strong><span>منشورات وتعليقات داخل مساحات مفهومة.</span></div>
          <div><strong>خصوصية عملية</strong><span>المجتمعات المغلقة والأحداث الخاصة لا تظهر إلا لمن يحق له الوصول.</span></div>
          <div><strong>لقاء في وقته</strong><span>سجّل في الحدث، ثم يظهر رابط Zoom عند السماح.</span></div>
        </section>
      </main>
    </div>
  );
}

function AuthScreen({ mode, onBack, onAuthenticated }: { mode: Exclude<AuthMode, 'landing'>; onBack: () => void; onAuthenticated: (user: User) => void }) {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', phoneNumber: '', displayName: '', token: '' });
  const set = (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const copy = {
    register: ['أنشئ حسابك في WB', 'ابدأ من مجتمع عام، ثم اكتشف المساحات المغلقة التي تناسبك.'],
    login: ['مرحبًا بعودتك', 'أكمل من حيث توقفت داخل مساحات WB.'],
    forgot: ['استعادة كلمة المرور', 'سنرسل رابطًا إذا كان الحساب موجودًا.'],
    verify: ['فعّل بريدك الإلكتروني', 'أدخل رمز التفعيل الذي وصلك لتفتح دورة المجتمع كاملة.'],
  }[mode];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (mode === 'register') {
        const result = await api<{ message: string }>('auth/register', { method: 'POST', body: JSON.stringify(form) });
        setSuccess(result.message);
      } else if (mode === 'login') {
        const result = await api<{ user: User }>('auth/login', { method: 'POST', body: JSON.stringify({ email: form.email, password: form.password }) });
        onAuthenticated(result.user);
      } else if (mode === 'forgot') {
        const result = await api<{ message: string }>('auth/password/forgot', { method: 'POST', body: JSON.stringify({ email: form.email }) });
        setSuccess(result.message);
      } else {
        const result = await api<{ message: string }>('auth/email/verify', { method: 'POST', body: JSON.stringify({ token: form.token }) });
        setSuccess(result.message);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <Topbar />
      <main className="auth-wrap">
        <section className="auth-card">
          <button className="text-link back-link" onClick={onBack}>العودة إلى الصفحة الرئيسية</button>
          <h1>{copy[0]}</h1>
          <p>{copy[1]}</p>
          <form className="form-grid" onSubmit={submit}>
            {mode === 'register' && <>
              <Field id="displayName" label="اسم العرض" value={form.displayName} onChange={set('displayName')} autoComplete="name" />
              <Field id="phoneNumber" label="رقم الجوال" value={form.phoneNumber} onChange={set('phoneNumber')} required placeholder="+966..." inputMode="tel" autoComplete="tel" />
            </>}
            {mode !== 'verify' && <Field id="email" label="البريد الإلكتروني" type="email" value={form.email} onChange={set('email')} autoComplete="email" />}
            {(mode === 'register' || mode === 'login') && <Field id="password" label="كلمة المرور" type="password" value={form.password} onChange={set('password')} minLength={10} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} hint="10 أحرف على الأقل." />}
            {mode === 'verify' && <Field id="token" label="رمز التفعيل" value={form.token} onChange={set('token')} />}
            {error && <div className="alert error" role="alert">{error}</div>}
            {success && <div className="alert success" role="status">{success}</div>}
            <div className="form-actions"><button className="button primary" disabled={loading}>{loading ? 'جارٍ التنفيذ…' : mode === 'register' ? 'إنشاء الحساب' : mode === 'login' ? 'تسجيل الدخول' : mode === 'forgot' ? 'إرسال الرابط' : 'تفعيل البريد'}</button>{mode === 'login' && <button type="button" className="text-link" onClick={() => window.location.assign('/?auth=forgot')}>نسيت كلمة المرور؟</button>}</div>
          </form>
          {mode === 'login' && <p className="form-foot">ليس لديك حساب؟ <button className="text-link" onClick={() => window.location.assign('/?auth=register')}>أنشئ حسابًا</button></p>}
        </section>
      </main>
    </div>
  );
}

function Field({ id, label, value, onChange, type = 'text', required = true, ...props }: { id: string; label: string; value: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; type?: string; required?: boolean; hint?: string; [key: string]: unknown }) {
  const hint = props.hint;
  delete props.hint;
  return <div className="field"><label htmlFor={id}>{label}</label><input id={id} type={type} value={value} onChange={onChange} required={required} {...props} />{hint && <small className="field-hint">{hint}</small>}</div>;
}

function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [events, setEvents] = useState<WbEvent[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selected, setSelected] = useState<Community | null>(null);
  const [scope, setScope] = useState<{ type: 'community' | 'group'; id: string }>({ type: 'community', id: '' });
  const [posts, setPosts] = useState<Post[]>([]);
  const feedRequestVersion = useRef(0);
  const [view, setView] = useState<View>('feed');
  const [notice, setNotice] = useState<Notice>(null);
  const unreadCount = notifications.filter((item) => !item.read_at).length;
  const canAdmin = isAdminFor(user, selected);

  async function load() {
    const [communityResult, eventResult, notificationResult] = await Promise.allSettled([
      api<Community[]>('communities'),
      api<WbEvent[]>('events'),
      api<Notification[]>('notifications'),
    ]);
    if (communityResult.status === 'rejected') throw communityResult.reason;
    const nextCommunities = communityResult.value;
    setCommunities(nextCommunities);
    if (eventResult.status === 'fulfilled') setEvents(eventResult.value);
    if (notificationResult.status === 'fulfilled') setNotifications(notificationResult.value);
    const nextSelected = (selected && nextCommunities.find((item) => item.id === selected.id)) ?? nextCommunities.find((item) => item.membership_status === 'active') ?? nextCommunities[0] ?? null;
    setSelected(nextSelected);
    if (nextSelected && (!scope.id || scope.type === 'community')) setScope({ type: 'community', id: nextSelected.id });
  }

  useEffect(() => { load().catch((error) => setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'تعذر تحميل مساحة WB' })); }, []);
  useEffect(() => {
    if (!scope.id || view !== 'feed') return;
    const requestVersion = ++feedRequestVersion.current;
    api<Post[]>(`feeds/${scope.type}/${scope.id}`).then((nextPosts) => {
      if (requestVersion === feedRequestVersion.current) setPosts(nextPosts);
    }).catch((error) => setNotice({ tone: 'error', message: error.message }));
  }, [scope, view]);

  function selectCommunity(community: Community) {
    setSelected(community);
    setScope({ type: 'community', id: community.id });
    setView('feed');
  }

  async function logout() {
    try { await api('auth/logout', { method: 'POST' }); onLogout(); } catch (error) { setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'تعذر تسجيل الخروج' }); }
  }

  async function join(community: Community) {
    try {
      await api(`communities/${community.id}/join`, { method: 'POST' });
      setNotice({ tone: 'success', message: community.visibility === 'public' ? 'تم الانضمام إلى المجتمع.' : 'تم إرسال طلب الانضمام للمراجعة.' });
      await load();
    } catch (error) { setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'تعذر الانضمام' }); }
  }

  async function like(post: Post) {
    try {
      await api(`posts/${post.id}/like`, { method: post.liked ? 'DELETE' : 'POST' });
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, liked: !item.liked, like_count: item.like_count + (item.liked ? -1 : 1) } : item));
    } catch (error) { setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'تعذر تحديث الإعجاب' }); }
  }

  async function markRead(id: string) {
    try {
      await api(`notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((current) => current.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
    } catch (error) { setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'تعذر تحديث الإشعار' }); }
  }

  const navItems: { key: View; label: string; count?: number }[] = [
    { key: 'feed', label: 'المجتمع' },
    { key: 'events', label: 'الأحداث' },
    { key: 'notifications', label: 'الإشعارات', count: unreadCount },
    { key: 'profile', label: 'ملفي' },
    ...(canAdmin ? [{ key: 'admin' as View, label: 'الإدارة' }] : []),
  ];

  return (
    <div className="app-shell">
      <Topbar user={user} onLogout={logout} />
      <main className="dashboard">
        <div className="dashboard-grid">
          <aside className="sidebar">
            <div className="sidebar-heading"><div><span className="status-dot" /><span>مساحة WB</span></div><small>{user.platformRole === 'platform_admin' ? 'إدارة المنصة' : 'عضو موثّق البريد'}</small></div>
            <nav className="nav-list" aria-label="التنقل الرئيسي">
              {navItems.map((item) => <button key={item.key} className={`nav-item ${view === item.key ? 'active' : ''}`} onClick={() => setView(item.key)}><span>{item.label}</span>{item.count ? <b>{item.count}</b> : null}</button>)}
            </nav>
            <div className="sidebar-rule" />
            <p className="sidebar-note">اختر مجتمعًا لتدخل إلى نقاشه، ثم افتح الأحداث عندما تبحث عن اللقاء القادم.</p>
          </aside>
          <section className="content-panel panel-enter" key={view}>
            {notice && <div className={`alert ${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}><span>{notice.message}</span><button className="alert-close" onClick={() => setNotice(null)} aria-label="إغلاق التنبيه">إغلاق</button></div>}
            {view === 'feed' && <FeedView user={user} selected={selected} communities={communities} posts={posts} onSelect={selectCommunity} onJoin={join} onLike={like} onNotice={setNotice} onCreated={(post) => {
              feedRequestVersion.current += 1;
              const normalizedPost: Post = {
                ...post,
                author_id: post.author_id ?? user.id,
                author_name: post.author_name || user.displayName,
                comment_count: post.comment_count ?? 0,
                like_count: post.like_count ?? 0,
                liked: post.liked ?? false,
              };
              setPosts((current) => [normalizedPost, ...current]);
            }} onUpdated={(post) => setPosts((current) => current.map((item) => item.id === post.id ? { ...item, ...post } : item))} onDeleted={(id) => setPosts((current) => current.filter((item) => item.id !== id))} />}
            {view === 'events' && <EventsView events={events} onRefresh={load} onNotice={setNotice} />}
            {view === 'notifications' && <NotificationsView notifications={notifications} onMarkRead={markRead} />}
            {view === 'profile' && <ProfileView user={user} onNotice={setNotice} />}
            {view === 'admin' && canAdmin && <AdminView user={user} selected={selected} communities={communities} onRefresh={load} onNotice={setNotice} />}
          </section>
          <aside className="rail">
            <section className="rail-card community-rail"><div className="rail-heading"><h3>مجتمعاتك</h3><span>{communities.length}</span></div><div className="community-list">{communities.length === 0 && <div className="empty compact">لا توجد مساحات بعد.</div>}{communities.map((community) => <button key={community.id} className={`community-item ${selected?.id === community.id ? 'selected' : ''}`} onClick={() => selectCommunity(community)}><span className="community-item-top"><strong>{community.name}</strong><span className={`visibility-tag ${community.visibility}`}>{community.visibility === 'public' ? 'عام' : 'مغلق'}</span></span><small>{community.membership_status === 'active' ? 'عضو فعّال' : community.membership_status === 'pending' ? 'بانتظار المراجعة' : 'يمكنك الانضمام'}</small></button>)}</div></section>
            <section className="rail-card next-event"><div className="rail-heading"><h3>اللقاء القادم</h3><span className="status-dot warm" /></div>{events[0] ? <div className="event-rail"><small>{formatDate(events[0].starts_at)}</small><strong>{events[0].title}</strong><span>{events[0].registered ? 'أنت مسجل' : 'التسجيل مفتوح'}</span></div> : <div className="empty compact">لا توجد أحداث منشورة بعد.</div>}</section>
            <section className="rail-card trust-card"><h3>تذكير WB</h3><p>المحتوى داخل المجتمع مسؤولية صاحبه. استخدم البلاغ عندما ترى ما يحتاج إلى مراجعة، ولا تشارك رابط حدث خاص خارج جمهوره.</p></section>
          </aside>
        </div>
      </main>
    </div>
  );
}

function FeedView({ user, selected, communities, posts, onSelect, onJoin, onLike, onNotice, onCreated, onUpdated, onDeleted }: { user: User; selected: Community | null; communities: Community[]; posts: Post[]; onSelect: (community: Community) => void; onJoin: (community: Community) => void; onLike: (post: Post) => void; onNotice: (notice: Notice) => void; onCreated: (post: Post) => void; onUpdated: (post: Post) => void; onDeleted: (id: string) => void }) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const active = selected?.membership_status === 'active';
  const roles = communityRoles(selected);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!selected || !body.trim()) return;
    setSaving(true);
    try {
      const post = await api<Post>(`feeds/community/${selected.id}/posts`, { method: 'POST', body: JSON.stringify({ body }) });
      setBody('');
      onCreated(post);
    } catch (error) {
      onNotice({ tone: 'error', message: error instanceof Error ? error.message : 'تعذر نشر المنشور' });
    } finally { setSaving(false); }
  }

  return (
    <>
      <div className="panel-heading">
        <div><h1>{selected?.name ?? 'مجتمع WB'}</h1><p>{selected?.description ?? 'اختر مساحة للبدء.'}</p></div>
        {selected && !active && <button className="button primary small" onClick={() => onJoin(selected)}>{selected.membership_status === 'pending' ? 'قيد المراجعة' : selected.visibility === 'public' ? 'انضمام' : 'طلب انضمام'}</button>}
      </div>
      <div className="community-tabs" role="tablist" aria-label="المجتمعات"><span className="tab-label">تبديل المساحة</span>{communities.map((community) => <button key={community.id} className={`community-tab ${selected?.id === community.id ? 'active' : ''}`} onClick={() => onSelect(community)}>{community.name}</button>)}</div>
      {active ? <form className="feed-form" onSubmit={create}><div className="composer-line"><span className="avatar">{initials(user.displayName)}</span><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={`ما الذي تريد مشاركته في ${selected?.name ?? 'المجتمع'}؟`} maxLength={4000} aria-label="نص المنشور" /></div><div className="form-actions"><span className="post-time">نص فقط · {body.length}/4000</span><button className="button primary small" disabled={saving || !body.trim()}>{saving ? 'ينشر…' : 'نشر المنشور'}</button></div></form> : <div className="empty join-empty"><strong>هذه المساحة تنتظر عضويتك.</strong><span>يمكنك رؤية الاسم والوصف، ثم طلب الوصول وفق سياسة المجتمع.</span></div>}
      <div className="post-list">{active && posts.length === 0 && <div className="empty"><strong>لا توجد منشورات بعد.</strong><span>ابدأ بسؤال أو فكرة عملية لتفتح النقاش.</span></div>}{posts.map((post) => <PostCard key={post.id} post={post} user={user} onLike={onLike} onNotice={onNotice} onUpdated={onUpdated} onDeleted={onDeleted} />)}</div>
      {active && roles.includes('community_admin') && <p className="role-note">لديك صلاحية إدارة هذه المساحة. افتح تبويب الإدارة لمراجعة طلبات الانضمام.</p>}
    </>
  );
}

function PostCard({ post, user, onLike, onNotice, onUpdated, onDeleted }: { post: Post; user: User; onLike: (post: Post) => void; onNotice: (notice: Notice) => void; onUpdated: (post: Post) => void; onDeleted: (id: string) => void }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(post.body);
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [busy, setBusy] = useState(false);
  const ownPost = post.author_id === user.id;

  async function openComments() {
    try {
      if (!commentsOpen && comments.length === 0) setComments(await api<Comment[]>(`posts/${post.id}/comments`));
      setCommentsOpen((current) => !current);
    } catch (error) {
      onNotice({ tone: 'error', message: error instanceof Error ? error.message : 'تعذر تحميل التعليقات' });
    }
  }
  async function addComment(event: FormEvent) {
    event.preventDefault();
    if (!commentBody.trim()) return;
    setBusy(true);
    try {
      const comment = await api<Comment>(`posts/${post.id}/comments`, { method: 'POST', body: JSON.stringify({ body: commentBody }) });
      const normalizedComment: Comment = {
        ...comment,
        author_id: comment.author_id ?? user.id,
        author_name: comment.author_name || user.displayName,
        created_at: comment.created_at ?? new Date().toISOString(),
      };
      setComments((current) => [...current, normalizedComment]);
      setCommentBody('');
    }
    catch (error) { onNotice({ tone: 'error', message: error instanceof Error ? error.message : 'تعذر إضافة التعليق' }); }
    finally { setBusy(false); }
  }
  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try { const updated = await api<Post>(`posts/${post.id}`, { method: 'PATCH', body: JSON.stringify({ body: editBody }) }); onUpdated({ ...post, ...updated, body: editBody }); setEditing(false); }
    catch (error) { onNotice({ tone: 'error', message: error instanceof Error ? error.message : 'تعذر حفظ التعديل' }); }
    finally { setBusy(false); }
  }
  async function deletePost() {
    if (!window.confirm('حذف هذا المنشور؟')) return;
    setBusy(true);
    try { await api(`posts/${post.id}`, { method: 'DELETE' }); onDeleted(post.id); }
    catch (error) { onNotice({ tone: 'error', message: error instanceof Error ? error.message : 'تعذر حذف المنشور' }); }
    finally { setBusy(false); }
  }
  async function submitReport(event: FormEvent) {
    event.preventDefault();
    if (!reportReason.trim()) return;
    setBusy(true);
    try { await api('reports', { method: 'POST', body: JSON.stringify({ targetType: 'post', targetId: post.id, reason: reportReason }) }); setReporting(false); setReportReason(''); onNotice({ tone: 'success', message: 'تم إرسال البلاغ للمراجعة.' }); }
    catch (error) { onNotice({ tone: 'error', message: error instanceof Error ? error.message : 'تعذر إرسال البلاغ' }); }
    finally { setBusy(false); }
  }

  return (
    <article className="post">
      <div className="post-meta"><div className="post-author"><span className="avatar">{initials(post.author_name)}</span><span><strong>{post.author_name}</strong><small className="post-time">{formatDate(post.created_at)}</small></span></div><div className="post-menu">{ownPost && <><button className="text-link compact-link" onClick={() => setEditing((current) => !current)}>{editing ? 'إلغاء التعديل' : 'تعديل'}</button><button className="text-link danger-link" onClick={deletePost} disabled={busy}>حذف</button></>}{!ownPost && <button className="text-link compact-link" onClick={() => setReporting((current) => !current)}>إبلاغ</button>}</div></div>
      {editing ? <form className="edit-form" onSubmit={saveEdit}><textarea value={editBody} onChange={(event) => setEditBody(event.target.value)} maxLength={4000} /><div className="form-actions"><span className="post-time">حد أقصى 4000 حرف</span><button className="button secondary small" disabled={busy}>حفظ التعديل</button></div></form> : <p className="post-body">{post.body}</p>}
      {reporting && <form className="report-form" onSubmit={submitReport}><label htmlFor={`report-${post.id}`}>سبب البلاغ</label><textarea id={`report-${post.id}`} value={reportReason} onChange={(event) => setReportReason(event.target.value)} placeholder="صف المشكلة باختصار" maxLength={500} required /><button className="button ghost small" disabled={busy}>إرسال البلاغ</button></form>}
      <div className="post-actions"><button className={`action-button ${post.liked ? 'active' : ''}`} onClick={() => onLike(post)} aria-label={post.liked ? 'إلغاء الإعجاب' : 'الإعجاب بالمنشور'}><span className="action-dot" />{post.like_count}</button><button className="action-button" onClick={openComments} aria-expanded={commentsOpen}>التعليقات {post.comment_count}</button></div>
      {commentsOpen && <div className="comments"><div className="comment-list">{comments.length === 0 && <span className="post-time">لا توجد تعليقات بعد.</span>}{comments.map((comment) => <div className="comment" key={comment.id}><span className="avatar small-avatar">{initials(comment.author_name)}</span><div><strong>{comment.author_name}</strong><p>{comment.body}</p><small>{formatDate(comment.created_at)}</small></div></div>)}</div><form className="comment-form" onSubmit={addComment}><input value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="اكتب تعليقًا مفيدًا" aria-label="تعليق جديد" /><button className="button secondary small" disabled={busy || !commentBody.trim()}>إضافة</button></form></div>}
    </article>
  );
}

function EventsView({ events, onRefresh, onNotice }: { events: WbEvent[]; onRefresh: () => Promise<void>; onNotice: (notice: Notice) => void }) {
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loadingId, setLoadingId] = useState('');
  async function open(event: WbEvent) { setLoadingId(event.id); try { setDetail(await api<EventDetail>(`events/${event.id}`)); } catch (error) { onNotice({ tone: 'error', message: error instanceof Error ? error.message : 'تعذر فتح الحدث' }); } finally { setLoadingId(''); } }
  async function register(event: WbEvent) { setLoadingId(event.id); try { await api(`events/${event.id}/register`, { method: 'POST' }); onNotice({ tone: 'success', message: 'تم التسجيل. افتح تفاصيل الحدث للوصول إلى رابط Zoom.' }); await onRefresh(); await open(event); } catch (error) { onNotice({ tone: 'error', message: error instanceof Error ? error.message : 'تعذر التسجيل' }); } finally { setLoadingId(''); } }
  async function cancel(event: WbEvent) { setLoadingId(event.id); try { await api(`events/${event.id}/cancel-registration`, { method: 'POST' }); onNotice({ tone: 'success', message: 'تم إلغاء التسجيل.' }); setDetail(null); await onRefresh(); } catch (error) { onNotice({ tone: 'error', message: error instanceof Error ? error.message : 'تعذر إلغاء التسجيل' }); } finally { setLoadingId(''); } }

  return <><div className="panel-heading"><div><h1>الأحداث</h1><p>لقاءات مباشرة بوقت واضح ورابط خاص بالأعضاء المسموح لهم.</p></div></div><div className="event-layout"><div className="post-list event-list">{events.length === 0 && <div className="empty"><strong>لا توجد أحداث منشورة.</strong><span>عندما تنشئ الإدارة لقاءً سيظهر هنا.</span></div>}{events.map((event) => <article className={`event-card ${detail?.id === event.id ? 'selected' : ''}`} key={event.id}><div className="event-date"><strong>{new Date(event.starts_at).toLocaleDateString('ar-SA', { day: '2-digit' })}</strong><span>{new Date(event.starts_at).toLocaleDateString('ar-SA', { month: 'short' })}</span></div><div className="event-main"><div className="event-card-meta"><span className={`visibility-tag ${event.visibility}`}>{event.visibility === 'private' ? 'خاص' : 'عام'}</span><small>{formatDate(event.starts_at)} · {event.community_name ?? 'على مستوى المنصة'}</small></div><h2>{event.title}</h2><p>{event.description || 'لا يوجد وصف إضافي لهذا اللقاء.'}</p><div className="event-actions"><button className="button ghost small" onClick={() => open(event)} disabled={loadingId === event.id}>{loadingId === event.id ? 'يفتح…' : 'التفاصيل'}</button>{event.registered ? <button className="button secondary small" onClick={() => cancel(event)} disabled={loadingId === event.id}>إلغاء التسجيل</button> : <button className="button primary small" onClick={() => register(event)} disabled={loadingId === event.id}>سجل الآن</button>}</div></div></article>)}</div>{detail && <aside className="event-detail"><div className="detail-heading"><div><h2>{detail.title}</h2></div><button className="text-link" onClick={() => setDetail(null)}>إغلاق</button></div><p>{detail.description || 'لا يوجد وصف إضافي.'}</p><dl className="detail-list"><div><dt>الموعد</dt><dd>{formatDate(detail.startsAt)}</dd></div><div><dt>النطاق</dt><dd>{detail.visibility === 'private' ? 'خاص بالأعضاء المسموح لهم' : 'عام'}</dd></div><div><dt>الحالة</dt><dd>{detail.registered ? 'مسجل' : 'غير مسجل'}</dd></div></dl>{detail.registered && detail.zoomUrl && <a className="zoom-link" href={detail.zoomUrl} target="_blank" rel="noreferrer">فتح رابط Zoom</a>}{!detail.registered && <p className="detail-note">سجّل في الحدث أولًا ليظهر رابط Zoom إذا كان مسموحًا لك.</p>}</aside>}</div></>;
}

function NotificationsView({ notifications, onMarkRead }: { notifications: Notification[]; onMarkRead: (id: string) => Promise<void> }) {
  return <><div className="panel-heading"><div><h1>الإشعارات</h1><p>قرارات العضوية، تحديثات الأحداث، وتعليقات الآخرين على منشوراتك.</p></div></div><div className="notification-list">{notifications.length === 0 && <div className="empty"><strong>لا توجد إشعارات.</strong><span>ستظهر هنا التحديثات المهمة داخل WB.</span></div>}{notifications.map((notification) => <article className={`notification ${notification.read_at ? '' : 'unread'}`} key={notification.id}><span className="notification-mark" /><div><strong>{notificationText(notification)}</strong><small>{formatDate(notification.created_at)}</small></div>{!notification.read_at && <button className="text-link compact-link" onClick={() => onMarkRead(notification.id)}>تحديد كمقروء</button>}</article>)}</div></>;
}

function ProfileView({ user, onNotice }: { user: User; onNotice: (notice: Notice) => void }) {
  const [name, setName] = useState(user.displayName);
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api<{ displayName: string; bio: string | null }>('me/profile').then((profile) => { setName(profile.displayName); setBio(profile.bio ?? ''); }).catch((error) => onNotice({ tone: 'error', message: error.message })).finally(() => setLoading(false)); }, [onNotice]);
  async function save(event: FormEvent) { event.preventDefault(); setSaving(true); try { await api('me/profile', { method: 'PATCH', body: JSON.stringify({ displayName: name, bio }) }); onNotice({ tone: 'success', message: 'تم حفظ الملف.' }); } catch (error) { onNotice({ tone: 'error', message: error instanceof Error ? error.message : 'تعذر حفظ الملف' }); } finally { setSaving(false); } }
  if (loading) return <LoadingBlock label="نجهز ملفك…" />;
  return <><div className="panel-heading"><div><h1>ملفي</h1><p>اسم العرض والنبذة القصيرة هما ما يراه الأعضاء في V0.</p></div></div><form className="profile-form" onSubmit={save}><div className="profile-summary"><span className="profile-avatar">{initials(name)}</span><div><strong>{name || 'اسم العرض'}</strong><span>{user.email}</span></div></div><div className="field"><label htmlFor="profile-name">اسم العرض</label><input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required /></div><div className="field"><label htmlFor="profile-bio">نبذة قصيرة</label><textarea id="profile-bio" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={500} placeholder="ما الذي تريد أن يعرفه عنك أعضاء WB؟" /><small className="field-hint">{bio.length}/500</small></div><div className="profile-meta"><span>البريد: {user.emailVerifiedAt ? 'مفعّل' : 'غير مفعّل'}</span><span>الجوال: {user.phoneNumber}</span></div><button className="button primary" disabled={saving}>{saving ? 'يحفظ…' : 'حفظ التغييرات'}</button></form></>;
}

function AdminView({ user, selected, communities, onRefresh, onNotice }: { user: User; selected: Community | null; communities: Community[]; onRefresh: () => Promise<void>; onNotice: (notice: Notice) => void }) {
  const platformAdmin = user.platformRole === 'platform_admin';
  const canReview = isAdminFor(user, selected);
  const [requests, setRequests] = useState<MembershipRequest[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [communityForm, setCommunityForm] = useState({ name: '', slug: '', description: '', visibility: 'public' as 'public' | 'closed' });
  const [groupForm, setGroupForm] = useState({ name: '', description: '' });
  const [moderatorForm, setModeratorForm] = useState({ groupId: '', userId: '' });
  const [eventForm, setEventForm] = useState({ title: '', description: '', startsAt: '', zoomUrl: '', visibility: 'public' as 'public' | 'private', groupId: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selected || !canReview) return;
    api<MembershipRequest[]>(`admin/communities/${selected.id}/membership-requests`).then(setRequests).catch((error) => onNotice({ tone: 'error', message: error.message }));
    api<Group[]>(`communities/${selected.id}/groups`).then(setGroups).catch(() => setGroups([]));
  }, [selected, canReview, onNotice]);

  async function decide(request: MembershipRequest, decision: 'approve' | 'reject') { setBusy(true); try { await api(`admin/membership-requests/${request.id}/${decision}`, { method: 'POST' }); setRequests((current) => current.filter((item) => item.id !== request.id)); onNotice({ tone: 'success', message: decision === 'approve' ? 'تم قبول الطلب.' : 'تم رفض الطلب.' }); } catch (error) { onNotice({ tone: 'error', message: error instanceof Error ? error.message : 'تعذر اتخاذ القرار' }); } finally { setBusy(false); } }
  async function createCommunity(event: FormEvent) { event.preventDefault(); setBusy(true); try { await api('admin/communities', { method: 'POST', body: JSON.stringify(communityForm) }); setCommunityForm({ name: '', slug: '', description: '', visibility: 'public' }); onNotice({ tone: 'success', message: 'تم إنشاء المجتمع.' }); await onRefresh(); } catch (error) { onNotice({ tone: 'error', message: error instanceof Error ? error.message : 'تعذر إنشاء المجتمع' }); } finally { setBusy(false); } }
  async function createGroup(event: FormEvent) { event.preventDefault(); if (!selected) return; setBusy(true); try { await api(`admin/communities/${selected.id}/groups`, { method: 'POST', body: JSON.stringify(groupForm) }); setGroupForm({ name: '', description: '' }); onNotice({ tone: 'success', message: 'تم إنشاء المجموعة.' }); const next = await api<Group[]>(`communities/${selected.id}/groups`); setGroups(next); } catch (error) { onNotice({ tone: 'error', message: error instanceof Error ? error.message : 'تعذر إنشاء المجموعة' }); } finally { setBusy(false); } }
  async function assignModerator(event: FormEvent) { event.preventDefault(); setBusy(true); try { await api(`admin/groups/${moderatorForm.groupId}/moderators`, { method: 'POST', body: JSON.stringify({ userId: moderatorForm.userId }) }); setModeratorForm({ groupId: '', userId: '' }); onNotice({ tone: 'success', message: 'تم تعيين مشرف المجموعة.' }); } catch (error) { onNotice({ tone: 'error', message: error instanceof Error ? error.message : 'تعذر تعيين المشرف' }); } finally { setBusy(false); } }
  async function createEvent(event: FormEvent) { event.preventDefault(); setBusy(true); try { await api('events', { method: 'POST', body: JSON.stringify({ ...eventForm, communityId: selected?.id || undefined, groupId: eventForm.groupId || undefined }) }); setEventForm({ title: '', description: '', startsAt: '', zoomUrl: '', visibility: selected ? 'private' : 'public', groupId: '' }); onNotice({ tone: 'success', message: 'تم نشر الحدث.' }); await onRefresh(); } catch (error) { onNotice({ tone: 'error', message: error instanceof Error ? error.message : 'تعذر نشر الحدث' }); } finally { setBusy(false); } }

  return <><div className="panel-heading"><div><h1>الإدارة</h1><p>{platformAdmin ? 'أنت تدير بنية المنصة والمجتمعات والمجموعات.' : `أنت مدير داخل ${selected?.name ?? 'المجتمع المحدد'}.`}</p></div></div><div className="admin-stack">{canReview && <section className="admin-section"><div className="section-heading"><div><h2>طلبات الانضمام</h2><p>راجع الطلبات قبل تفعيل العضوية في المجتمع المغلق.</p></div><span className="count-badge">{requests.length}</span></div>{requests.length === 0 ? <div className="empty compact">لا توجد طلبات معلقة.</div> : <div className="request-list">{requests.map((request) => <div className="request-row" key={request.id}><div><strong>{request.display_name || request.email}</strong><small>{request.email} · {formatDate(request.created_at)}</small>{request.reason && <p>{request.reason}</p>}</div><div className="row-actions"><button className="button primary small" onClick={() => decide(request, 'approve')} disabled={busy}>قبول</button><button className="button ghost small" onClick={() => decide(request, 'reject')} disabled={busy}>رفض</button></div></div>)}</div>}</section>}{platformAdmin && <section className="admin-section"><div className="section-heading"><div><h2>إنشاء مجتمع</h2><p>إنشاء المجتمعات محصور بإدارة المنصة.</p></div></div><form className="admin-form" onSubmit={createCommunity}><div className="form-two"><Field id="admin-name" label="اسم المجتمع" value={communityForm.name} onChange={(event) => setCommunityForm({ ...communityForm, name: event.target.value })} /><Field id="admin-slug" label="المعرّف اللطيف" value={communityForm.slug} onChange={(event) => setCommunityForm({ ...communityForm, slug: event.target.value })} placeholder="community-name" /></div><div className="field"><label htmlFor="admin-description">الوصف</label><textarea id="admin-description" value={communityForm.description} onChange={(event) => setCommunityForm({ ...communityForm, description: event.target.value })} required /></div><div className="field"><label htmlFor="admin-visibility">الوصول</label><select id="admin-visibility" value={communityForm.visibility} onChange={(event) => setCommunityForm({ ...communityForm, visibility: event.target.value as 'public' | 'closed' })}><option value="public">عام</option><option value="closed">مغلق</option></select></div><button className="button primary small" disabled={busy}>إنشاء المجتمع</button></form></section>}{platformAdmin && selected && <section className="admin-section"><div className="section-heading"><div><h2>مجموعات {selected.name}</h2><p>المجموعات تُنشأ مركزيًا وتستمد الوصول من المجتمع.</p></div></div><form className="admin-form" onSubmit={createGroup}><div className="form-two"><Field id="group-name" label="اسم المجموعة" value={groupForm.name} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} /><Field id="group-description" label="وصف مختصر" value={groupForm.description} onChange={(event) => setGroupForm({ ...groupForm, description: event.target.value })} /></div><button className="button secondary small" disabled={busy}>إنشاء المجموعة</button></form>{groups.length > 0 && <div className="group-list">{groups.map((group) => <div className="group-row" key={group.id}><div><strong>{group.name}</strong><span>{group.description || 'بدون وصف'}</span></div><span className="visibility-tag public">نشطة</span></div>)}</div>}</section>}{platformAdmin && <section className="admin-section"><div className="section-heading"><div><h2>تعيين مشرف مجموعة</h2><p>أدخل User ID للمستخدم المقبول داخل المجموعة.</p></div></div><form className="admin-form" onSubmit={assignModerator}><div className="form-two"><div className="field"><label htmlFor="moderator-group">المجموعة</label><select id="moderator-group" value={moderatorForm.groupId} onChange={(event) => setModeratorForm({ ...moderatorForm, groupId: event.target.value })} required><option value="">اختر مجموعة</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div><Field id="moderator-user" label="User ID" value={moderatorForm.userId} onChange={(event) => setModeratorForm({ ...moderatorForm, userId: event.target.value })} /></div><button className="button secondary small" disabled={busy}>تعيين المشرف</button></form></section>}{(platformAdmin || selected) && <section className="admin-section"><div className="section-heading"><div><h2>نشر حدث مباشر</h2><p>رابط Zoom يُخزّن مشفرًا ويظهر للمسجلين فقط.</p></div></div><form className="admin-form" onSubmit={createEvent}><div className="form-two"><Field id="event-title" label="عنوان الحدث" value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} /><div className="field"><label htmlFor="event-visibility">النطاق</label><select id="event-visibility" value={eventForm.visibility} onChange={(event) => setEventForm({ ...eventForm, visibility: event.target.value as 'public' | 'private' })}><option value="public">عام</option><option value="private">خاص بالمجتمع</option></select></div></div><div className="form-two"><div className="field"><label htmlFor="event-start">وقت البداية</label><input id="event-start" type="datetime-local" value={eventForm.startsAt} onChange={(event) => setEventForm({ ...eventForm, startsAt: event.target.value })} required /></div><Field id="event-zoom" label="رابط Zoom" value={eventForm.zoomUrl} onChange={(event) => setEventForm({ ...eventForm, zoomUrl: event.target.value })} placeholder="https://zoom.us/..." /></div><div className="field"><label htmlFor="event-description">الوصف</label><textarea id="event-description" value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })} /></div>{selected && groups.length > 0 && <div className="field"><label htmlFor="event-group">اختياري: مجموعة خاصة</label><select id="event-group" value={eventForm.groupId} onChange={(event) => setEventForm({ ...eventForm, groupId: event.target.value })}><option value="">كل أعضاء المجتمع</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div>}<button className="button primary small" disabled={busy}>نشر الحدث</button></form></section>}</div></>;
}

function LoadingBlock({ label }: { label: string }) { return <div className="loading-block"><span className="loader" /><span>{label}</span></div>; }
function LoadingScreen() { return <div className="app-shell"><Topbar /><main className="auth-wrap"><LoadingBlock label="جارٍ تجهيز مساحة WB…" /></main></div>; }
