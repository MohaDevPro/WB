'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import {
  api,
  type Community,
  type PlatformHome,
  type PlatformEvent,
  type Profile,
  type Service,
} from './api-client';
import { useAuth } from './auth-provider';

type Locale = 'ar' | 'en';
type PlatformSection = 'home' | 'discover' | 'community' | 'events' | 'profile';
type AuthMode = 'login' | 'register';

const navigation: readonly Readonly<{
  id: PlatformSection;
  ar: string;
  en: string;
  icon: string;
}>[] = [
  { ar: 'الرئيسية', en: 'Home', icon: '⌂', id: 'home' },
  { ar: 'الاكتشاف', en: 'Discover', icon: '⌕', id: 'discover' },
  { ar: 'المجتمعات', en: 'Communities', icon: '◌', id: 'community' },
  { ar: 'اللقاءات', en: 'Events', icon: '□', id: 'events' },
  { ar: 'ملفي', en: 'My profile', icon: '◉', id: 'profile' },
];

const content: Record<
  PlatformSection,
  Record<Locale, Readonly<{ kicker: string; title: string }>>
> = {
  community: {
    ar: { kicker: 'محادثات متخصصة', title: 'مجتمعات تنمو بالمشاركة' },
    en: { kicker: 'Focused conversations', title: 'Communities that grow through contribution' },
  },
  discover: {
    ar: { kicker: 'اكتشاف مهني', title: 'فرص وخدمات قريبة من احتياجك' },
    en: {
      kicker: 'Professional discovery',
      title: 'Opportunities and services close to your need',
    },
  },
  events: {
    ar: { kicker: 'تعلّم حي', title: 'لقاءات تصنع اتصالاً حقيقياً' },
    en: { kicker: 'Live learning', title: 'Events that create real connection' },
  },
  home: {
    ar: { kicker: 'منصة WB المهنية', title: 'تعلّم، تواصل، وابنِ أثراً يتجاوزك' },
    en: {
      kicker: 'WB professional platform',
      title: 'Learn, connect, and build impact beyond yourself',
    },
  },
  profile: {
    ar: { kicker: 'مساحتك المهنية', title: 'ملف مهني يبدأ بك' },
    en: { kicker: 'Your professional space', title: 'A professional profile that starts with you' },
  },
};

function ArrowIcon() {
  return (
    <span aria-hidden="true" className="arrow-icon">
      ←
    </span>
  );
}

function initials(value: string): string {
  const characters = value.trim().split(/\s+/u).filter(Boolean).slice(0, 2);
  return characters.length === 0
    ? 'WB'
    : characters
        .map((item) => item.slice(0, 1))
        .join('')
        .toLocaleUpperCase();
}

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function formatCurrency(amount: number | null, currency: string, locale: Locale): string {
  if (amount === null) {
    return locale === 'ar' ? 'يُحدّد بالاتفاق' : 'By agreement';
  }

  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', {
    currency,
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(amount / 100);
}

function safeHome(): PlatformHome {
  return Object.freeze({
    communities: [],
    discussions: [],
    events: [],
    opportunities: [],
    services: [],
  });
}

export default function HomePage() {
  const {
    error: authError,
    isLoading: isAuthenticating,
    login,
    logout,
    profile,
    register,
    session,
    updateProfile,
    user,
  } = useAuth();
  const [activeSection, setActiveSection] = useState<PlatformSection>('home');
  const [locale, setLocale] = useState<Locale>('ar');
  const [home, setHome] = useState<PlatformHome>(safeHome);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [accountOpen, setAccountOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [query, setQuery] = useState('');
  const [profileDraft, setProfileDraft] = useState<Profile>({
    biography: null,
    displayName: '',
    locale: 'ar',
    skills: [],
  });
  const [discussionCommunity, setDiscussionCommunity] = useState('');
  const [discussionTitle, setDiscussionTitle] = useState('');
  const [discussionBody, setDiscussionBody] = useState('');

  const direction = locale === 'ar' ? 'rtl' : 'ltr';
  const t = useCallback(
    (arabic: string, english: string): string => (locale === 'ar' ? arabic : english),
    [locale],
  );

  const loadHome = useCallback(async () => {
    setIsLoadingData(true);
    setLoadError(null);

    try {
      const nextHome = await api.getHome();
      setHome(nextHome);
      setDiscussionCommunity((current) => current || nextHome.communities[0]?.slug || '');
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : 'Platform data could not be loaded.');
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = locale;
  }, [direction, locale]);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  useEffect(() => {
    if (profile !== null) {
      setProfileDraft(profile);
    }
  }, [profile]);

  const filteredServices = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (normalized.length === 0) {
      return home.services;
    }

    return home.services.filter((service) =>
      `${service.title} ${service.description}`.toLocaleLowerCase().includes(normalized),
    );
  }, [home.services, query]);

  const requireSession = (): string | null => {
    if (session !== null) {
      return session.accessToken;
    }

    setAccountOpen(true);
    setNotice(
      t('سجّل دخولك أولاً لتنفيذ هذا الإجراء.', 'Please sign in first to complete this action.'),
    );
    return null;
  };

  const changeSection = (section: PlatformSection): void => {
    setActiveSection(section);
    setNotice(null);
  };

  const handleAuthentication = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setNotice(null);

    try {
      if (authMode === 'login') {
        await login(email, password);
        setNotice(t('مرحباً بعودتك إلى WB.', 'Welcome back to WB.'));
      } else {
        await register(email, password);
        setNotice(
          t(
            'تم إنشاء حسابك. أكمل ملفك المهني للبدء.',
            'Your account is ready. Complete your professional profile to begin.',
          ),
        );
      }
      setAccountOpen(false);
      setPassword('');
      setActiveSection('profile');
    } catch {
      // The provider exposes a safe, user-facing error message.
    }
  };

  const joinCommunity = async (community: Community): Promise<void> => {
    const token = requireSession();
    if (token === null) return;

    try {
      await api.joinCommunity(token, community.slug);
      setNotice(t(`أنت الآن عضو في ${community.name}.`, `You are now part of ${community.name}.`));
      await loadHome();
    } catch (reason) {
      setNotice(
        reason instanceof Error
          ? reason.message
          : t('تعذر الانضمام الآن.', 'Could not join at this time.'),
      );
    }
  };

  const registerForEvent = async (event: PlatformEvent): Promise<void> => {
    const token = requireSession();
    if (token === null) return;

    try {
      const result = await api.registerForEvent(token, event.id);
      setNotice(
        result.status === 'waitlisted'
          ? t('أُدرجت في قائمة الانتظار.', 'You have been added to the waitlist.')
          : t('تم تسجيل حضورك بنجاح.', 'Your place has been registered.'),
      );
    } catch (reason) {
      setNotice(
        reason instanceof Error
          ? reason.message
          : t('تعذر تسجيل الحضور الآن.', 'Could not register at this time.'),
      );
    }
  };

  const reactToDiscussion = async (id: string): Promise<void> => {
    const token = requireSession();
    if (token === null) return;

    try {
      await api.reactToDiscussion(token, id);
      setNotice(t('تم تقدير هذه الفكرة.', 'This idea has been appreciated.'));
      await loadHome();
    } catch (reason) {
      setNotice(
        reason instanceof Error
          ? reason.message
          : t('تعذر حفظ التفاعل.', 'Could not save your reaction.'),
      );
    }
  };

  const publishDiscussion = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const token = requireSession();
    if (token === null) return;

    try {
      await api.createDiscussion(token, {
        body: discussionBody,
        communitySlug: discussionCommunity,
        title: discussionTitle,
      });
      setDiscussionTitle('');
      setDiscussionBody('');
      setNotice(t('نُشرت مشاركتك في المجتمع.', 'Your contribution has been published.'));
      await loadHome();
    } catch (reason) {
      setNotice(
        reason instanceof Error
          ? reason.message
          : t('تعذر نشر المشاركة.', 'Could not publish the contribution.'),
      );
    }
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    try {
      await updateProfile({ ...profileDraft, locale });
      setNotice(t('تم حفظ ملفك المهني.', 'Your professional profile has been saved.'));
    } catch (reason) {
      setNotice(
        reason instanceof Error
          ? reason.message
          : t('تعذر حفظ الملف.', 'Could not save your profile.'),
      );
    }
  };

  const requestService = async (service: Service): Promise<void> => {
    const token = requireSession();
    if (token === null) return;

    try {
      await api.requestService(
        token,
        service.id,
        t(
          `أرغب في مناقشة خدمة «${service.title}» وتفاصيل نطاق العمل.`,
          `I would like to discuss “${service.title}” and the appropriate scope of work.`,
        ),
      );
      setNotice(
        t('أُرسل طلب الخدمة إلى مقدمها.', 'Your service request has been sent to the provider.'),
      );
    } catch (reason) {
      setNotice(
        reason instanceof Error
          ? reason.message
          : t('تعذر إرسال الطلب.', 'Could not send the request.'),
      );
    }
  };

  const runGovernedAction = async (kind: 'ai' | 'workflow'): Promise<void> => {
    const token = requireSession();
    if (token === null) return;

    try {
      const result =
        kind === 'ai'
          ? await api.createAiTask(token, 'summary')
          : await api.createWorkflow(token, 'community_digest');
      setNotice(
        kind === 'ai'
          ? t(
              `تم إعداد مهمة الذكاء ${result.id.slice(0, 8)} للمراجعة البشرية.`,
              `AI task ${result.id.slice(0, 8)} is ready for human review.`,
            )
          : t(
              `تم إنشاء سير العمل ${result.id.slice(0, 8)} بانتظار الموافقة.`,
              `Workflow ${result.id.slice(0, 8)} has been created pending approval.`,
            ),
      );
    } catch (reason) {
      setNotice(
        reason instanceof Error
          ? reason.message
          : t('تعذر بدء الإجراء المحكوم.', 'Could not start the governed action.'),
      );
    }
  };

  const displayName = profile?.displayName || user?.email?.split('@')[0] || t('ضيف WB', 'WB guest');
  const platformCopy = content[activeSection][locale];
  const nextEvent = home.events[0];

  return (
    <main className="wb-app wb-connected" dir={direction}>
      <a className="skip-link" href="#platform-content">
        {t('انتقل إلى المحتوى', 'Skip to content')}
      </a>

      <header className="topbar wb-topbar">
        <div className="topbar-inner">
          <button
            aria-label={t('الانتقال إلى الرئيسية', 'Go to home')}
            className="brand"
            onClick={() => changeSection('home')}
            type="button"
          >
            <span className="brand-symbol" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>
              <strong>WB</strong>
              <small>{t('مساحة مهنية حيّة', 'A living professional space')}</small>
            </span>
          </button>

          <nav aria-label={t('التنقل الرئيسي', 'Primary navigation')} className="desktop-nav">
            {navigation.map((item) => (
              <button
                aria-current={activeSection === item.id ? 'page' : undefined}
                className={activeSection === item.id ? 'nav-link is-active' : 'nav-link'}
                key={item.id}
                onClick={() => changeSection(item.id)}
                type="button"
              >
                {locale === 'ar' ? item.ar : item.en}
              </button>
            ))}
          </nav>

          <div className="topbar-actions">
            <button
              aria-label={t('تغيير اللغة إلى الإنجليزية', 'Change language to Arabic')}
              className="language-toggle"
              onClick={() => setLocale((current) => (current === 'ar' ? 'en' : 'ar'))}
              type="button"
            >
              <span>{locale === 'ar' ? 'EN' : 'ع'}</span>
            </button>
            {user === null ? (
              <button
                className="account-trigger"
                onClick={() => setAccountOpen(true)}
                type="button"
              >
                {t('دخول أو إنشاء حساب', 'Sign in or join')}
              </button>
            ) : (
              <button
                className="avatar-button"
                onClick={() => changeSection('profile')}
                type="button"
              >
                <span className="avatar avatar-small">{initials(displayName)}</span>
                <span className="avatar-name">{displayName}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="live-banner" aria-label={t('حالة المنصة', 'Platform status')}>
        <span className="live-dot" aria-hidden="true" />
        <span>
          {isLoadingData
            ? t('يتم تحميل البيانات الحية…', 'Loading live platform data…')
            : t(
                'متصل ببيانات المنصة الحية والمحفوظة',
                'Connected to live, persistent platform data',
              )}
        </span>
        {user !== null ? (
          <span className="banner-user">{t('جلسة آمنة', 'Secure session')}</span>
        ) : null}
      </div>

      <div className="mobile-nav" aria-label={t('تنقل الجوال', 'Mobile navigation')}>
        {navigation.map((item) => (
          <button
            aria-label={locale === 'ar' ? item.ar : item.en}
            className={activeSection === item.id ? 'mobile-nav-item is-active' : 'mobile-nav-item'}
            key={item.id}
            onClick={() => changeSection(item.id)}
            type="button"
          >
            <span aria-hidden="true">{item.icon}</span>
            <small>{locale === 'ar' ? item.ar : item.en}</small>
          </button>
        ))}
      </div>

      {notice !== null ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}
      {loadError !== null ? (
        <div className="system-state error-state" role="alert">
          <strong>{t('تعذر تحميل المنصة', 'Platform unavailable')}</strong>
          <span>{loadError}</span>
          <button onClick={() => void loadHome()} type="button">
            {t('إعادة المحاولة', 'Try again')}
          </button>
        </div>
      ) : null}

      <div id="platform-content" className="platform-layout">
        <aside className="sidebar wb-sidebar" aria-label={t('روابط سريعة', 'Quick links')}>
          <p className="sidebar-label">{t('استكشف WB', 'Explore WB')}</p>
          {navigation.map((item) => (
            <button
              className={activeSection === item.id ? 'side-link is-active' : 'side-link'}
              key={item.id}
              onClick={() => changeSection(item.id)}
              type="button"
            >
              <span className="side-glyph" aria-hidden="true">
                {item.icon}
              </span>
              {locale === 'ar' ? item.ar : item.en}
            </button>
          ))}
          <div className="trust-card">
            <span className="trust-mark">✓</span>
            <p>{t('مساحة مهنية موثوقة', 'Trusted professional space')}</p>
            <small>
              {t(
                'تُسجل الإجراءات المهمة وتخضع عمليات الذكاء للمراجعة البشرية.',
                'Important actions are audited and intelligent workflows remain human reviewed.',
              )}
            </small>
          </div>
          {user !== null ? (
            <button className="quiet-button" onClick={() => void logout()} type="button">
              {t('تسجيل الخروج', 'Sign out')}
            </button>
          ) : null}
        </aside>

        <section className="content-stage">
          <div className="section-intro wb-intro">
            <p className="section-kicker">{platformCopy.kicker}</p>
            <h1>{platformCopy.title}</h1>
            {activeSection === 'home' ? (
              <p>
                {t(
                  'WB تجمع الممارسين والخبراء والفرص في مساحة واحدة للتعلّم العملي، العلاقات الموثوقة، والعمل الذي يترك أثراً.',
                  'WB brings practitioners, experts, and opportunities into one space for practical learning, trusted relationships, and work that leaves an impact.',
                )}
              </p>
            ) : null}
          </div>

          {activeSection === 'home' ? (
            <>
              <section
                className="hero-grid wb-hero"
                aria-label={t('نظرة عامة على المنصة', 'Platform overview')}
              >
                <div className="hero-copy">
                  <div className="eyebrow-line">
                    <span />
                    {t(
                      'مصمم لما يأتي بعد الاتصال الأول',
                      'Designed for what comes after the first connection',
                    )}
                  </div>
                  <div className="hero-actions">
                    <button
                      className="primary-action"
                      onClick={() =>
                        user === null ? setAccountOpen(true) : changeSection('community')
                      }
                      type="button"
                    >
                      {user === null
                        ? t('انضم إلى WB', 'Join WB')
                        : t('استكشف مجتمعك', 'Explore your community')}
                      <ArrowIcon />
                    </button>
                    <button
                      className="secondary-action"
                      onClick={() => changeSection('events')}
                      type="button"
                    >
                      <span aria-hidden="true">□</span>
                      {t('استعرض اللقاءات', 'Browse events')}
                    </button>
                  </div>
                  <div className="hero-stats live-stats">
                    <div>
                      <strong>{home.communities.length}</strong>
                      <span>{t('مجتمعات نشطة', 'active communities')}</span>
                    </div>
                    <div>
                      <strong>{home.events.length}</strong>
                      <span>{t('لقاءات قادمة', 'upcoming events')}</span>
                    </div>
                    <div>
                      <strong>{home.opportunities.length}</strong>
                      <span>{t('فرص متاحة', 'open opportunities')}</span>
                    </div>
                  </div>
                </div>
                <div className="hero-scene" aria-hidden="true">
                  <div className="scene-grid" />
                  <div className="scene-sun" />
                  <div className="scene-card scene-card-top">
                    <span className="scene-mini-avatar avatar-violet">✓</span>
                    <div>
                      <b>{t('ثقة قابلة للتحقق', 'Verifiable trust')}</b>
                      <small>{t('حوكمة متكاملة', 'Governed by design')}</small>
                    </div>
                  </div>
                  <div className="scene-card scene-card-bottom">
                    <span className="scene-mini-icon">✦</span>
                    <div>
                      <b>{t('فرصة جديدة', 'New opportunity')}</b>
                      <small>{t('بيانات حية محفوظة', 'Live, persistent data')}</small>
                    </div>
                  </div>
                  <div className="scene-orbit orbit-one" />
                  <div className="scene-orbit orbit-two" />
                  <div className="scene-figure figure-one">
                    <span>و</span>
                  </div>
                  <div className="scene-figure figure-two">
                    <span>ب</span>
                  </div>
                  <div className="scene-figure figure-three">
                    <span>ر</span>
                  </div>
                </div>
              </section>

              <section className="home-split-grid">
                <div className="panel panel-discover live-panel">
                  <div className="panel-heading">
                    <div>
                      <p>{t('من المنصة', 'From the platform')}</p>
                      <h2>{t('ابدأ بمحادثة ذات معنى', 'Start a conversation that matters')}</h2>
                    </div>
                    <button onClick={() => changeSection('community')} type="button">
                      {t('عرض الكل', 'View all')} <ArrowIcon />
                    </button>
                  </div>
                  <div className="people-list">
                    {home.discussions.slice(0, 2).map((discussion) => (
                      <article className="person-row" key={discussion.id}>
                        <span className="avatar avatar-violet">
                          {initials(discussion.authorName)}
                        </span>
                        <div>
                          <h3>{discussion.authorName}</h3>
                          <p>{discussion.title}</p>
                        </div>
                        <span className="person-badge">
                          {discussion.reactionCount} {t('تفاعل', 'reactions')}
                        </span>
                      </article>
                    ))}
                    {home.discussions.length === 0 ? (
                      <p className="empty-inline">
                        {t(
                          'ستظهر هنا أول محادثة منشورة.',
                          'The first published discussion will appear here.',
                        )}
                      </p>
                    ) : null}
                  </div>
                </div>
                <article className="panel panel-event">
                  <div className="event-icon">□</div>
                  <p>{t('اللقاء القادم', 'Next gathering')}</p>
                  <h2>
                    {nextEvent?.title ?? t('تفقّد اللقاءات القادمة', 'Explore upcoming events')}
                  </h2>
                  {nextEvent !== undefined ? (
                    <div className="event-meta">
                      <span>{formatDate(nextEvent.startsAt, locale)}</span>
                      <span>{nextEvent.location ?? t('عبر الإنترنت', 'Online')}</span>
                    </div>
                  ) : null}
                  <button
                    className="dark-action"
                    onClick={() => changeSection('events')}
                    type="button"
                  >
                    {t('عرض التفاصيل', 'View details')} <ArrowIcon />
                  </button>
                </article>
              </section>

              <section
                className="governance-strip"
                aria-label={t('إجراءات محكومة', 'Governed actions')}
              >
                <div>
                  <p>{t('ذكاء مسؤول', 'Responsible intelligence')}</p>
                  <h2>
                    {t('حوّل الإشارة إلى خطوة مدروسة', 'Turn a signal into a considered next step')}
                  </h2>
                  <span>
                    {t(
                      'كل مهمة ذكية وسير عمل مستقل يبقى ضمن نطاق واضح ومراجعة بشرية.',
                      'Every intelligent task and autonomous workflow remains within a clear scope and human review.',
                    )}
                  </span>
                </div>
                <div className="governance-actions">
                  <button onClick={() => void runGovernedAction('ai')} type="button">
                    {t('إنشاء ملخص ذكي', 'Create AI summary')}
                  </button>
                  <button onClick={() => void runGovernedAction('workflow')} type="button">
                    {t('بدء موجز المجتمع', 'Start community digest')}
                  </button>
                </div>
              </section>
            </>
          ) : null}

          {activeSection === 'discover' ? (
            <section className="discover-view connected-view">
              <div className="search-row">
                <label htmlFor="service-search">
                  {t('ابحث بالخدمة أو المجال', 'Search by service or field')}
                </label>
                <div>
                  <span aria-hidden="true">⌕</span>
                  <input
                    id="service-search"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t(
                      'مثال: استراتيجية، بحث، تصميم…',
                      'e.g. strategy, research, design…',
                    )}
                    value={query}
                  />
                </div>
              </div>
              <section className="opportunity-panel live-opportunities">
                <div>
                  <p>{t('فرص مختارة', 'Selected opportunities')}</p>
                  <h2>
                    {t(
                      'عمل ينسجم مع الخبرة التي تبنيها',
                      'Work aligned with the expertise you are building',
                    )}
                  </h2>
                </div>
                <div className="opportunity-list">
                  {home.opportunities.map((opportunity) => (
                    <article key={opportunity.id}>
                      <span>
                        <small>{opportunity.type}</small>
                        <strong>{opportunity.title}</strong>
                        <em>{opportunity.description}</em>
                      </span>
                      <span className="type-dot">↗</span>
                    </article>
                  ))}
                </div>
              </section>
              <div className="service-grid">
                {filteredServices.map((service) => (
                  <article className="service-card" key={service.id}>
                    <span className="service-topline">
                      <small>{t('خدمة احترافية', 'Professional service')}</small>
                      <b>{formatCurrency(service.priceMinor, service.currency, locale)}</b>
                    </span>
                    <h2>{service.title}</h2>
                    <p>{service.description}</p>
                    <button onClick={() => void requestService(service)} type="button">
                      {t('طلب خدمة', 'Request service')} <ArrowIcon />
                    </button>
                  </article>
                ))}
              </div>
              {filteredServices.length === 0 ? (
                <div className="empty-state">
                  <span>⌕</span>
                  <h2>{t('لم نعثر على خدمة مطابقة', 'No matching service found')}</h2>
                  <p>
                    {t(
                      'جرّب كلمة أقصر أو استعرض جميع الخدمات المنشورة.',
                      'Try a shorter phrase or browse all published services.',
                    )}
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          {activeSection === 'community' ? (
            <section className="community-view connected-view">
              <div className="community-grid">
                {home.communities.map((community, index) => (
                  <article
                    className={`community-card accent-${['violet', 'orange', 'green'][index % 3]}`}
                    key={community.id}
                  >
                    <div className="community-card-art">
                      <span>{community.memberCount}</span>
                    </div>
                    <div>
                      <p>{t('عضو نشط', 'active members')}</p>
                      <h2>{community.name}</h2>
                      <p className="community-summary">{community.summary}</p>
                      <button onClick={() => void joinCommunity(community)} type="button">
                        {t('انضم إلى الحوار', 'Join the conversation')} <ArrowIcon />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <section className="feed-panel live-feed">
                <div className="panel-heading">
                  <div>
                    <p>{t('من المجتمع', 'From the community')}</p>
                    <h2>{t('أفكار تستحق أن تكملها', 'Ideas worth carrying forward')}</h2>
                  </div>
                </div>
                {user !== null ? (
                  <form
                    className="discussion-form"
                    onSubmit={(event) => void publishDiscussion(event)}
                  >
                    <select
                      aria-label={t('المجتمع', 'Community')}
                      onChange={(event) => setDiscussionCommunity(event.target.value)}
                      value={discussionCommunity}
                    >
                      {home.communities.map((community) => (
                        <option key={community.id} value={community.slug}>
                          {community.name}
                        </option>
                      ))}
                    </select>
                    <input
                      onChange={(event) => setDiscussionTitle(event.target.value)}
                      placeholder={t('عنوان مشاركتك', 'A title for your contribution')}
                      required
                      value={discussionTitle}
                    />
                    <textarea
                      onChange={(event) => setDiscussionBody(event.target.value)}
                      placeholder={t(
                        'شارك سؤالاً أو معرفة عملية…',
                        'Share a question or practical insight…',
                      )}
                      required
                      rows={3}
                      value={discussionBody}
                    />
                    <button className="primary-action" type="submit">
                      {t('نشر المشاركة', 'Publish contribution')}
                    </button>
                  </form>
                ) : (
                  <button
                    className="sign-in-callout"
                    onClick={() => setAccountOpen(true)}
                    type="button"
                  >
                    {t('سجّل دخولك لكتابة مشاركة حقيقية', 'Sign in to publish a real contribution')}
                  </button>
                )}
                {home.discussions.map((discussion) => (
                  <article className="feed-item" key={discussion.id}>
                    <span className="avatar avatar-small avatar-violet">
                      {initials(discussion.authorName)}
                    </span>
                    <div>
                      <h3>{discussion.authorName}</h3>
                      <small>
                        {discussion.communityName} · {formatDate(discussion.createdAt, locale)}
                      </small>
                      <h4>{discussion.title}</h4>
                      <p>{discussion.body}</p>
                      <div className="feed-actions">
                        <button onClick={() => void reactToDiscussion(discussion.id)} type="button">
                          {t('مفيد', 'Helpful')} <span>{discussion.reactionCount}</span>
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            </section>
          ) : null}

          {activeSection === 'events' ? (
            <section className="events-view connected-view">
              {home.events.map((event, index) => (
                <article className={index === 0 ? 'event-spotlight' : 'event-row'} key={event.id}>
                  <div className="event-spotlight-copy">
                    <p>{event.type}</p>
                    <h2>{event.title}</h2>
                    <p className="event-description">{event.description}</p>
                    <div className="event-details">
                      <span>{formatDate(event.startsAt, locale)}</span>
                      <span>{event.location ?? t('عبر الإنترنت', 'Online')}</span>
                      {event.capacity !== null ? (
                        <span>
                          {event.capacity} {t('مقعد', 'seats')}
                        </span>
                      ) : null}
                    </div>
                    <button
                      className="primary-action"
                      onClick={() => void registerForEvent(event)}
                      type="button"
                    >
                      {t('سجّل حضورك', 'Reserve your seat')} <ArrowIcon />
                    </button>
                  </div>
                  {index === 0 ? (
                    <div className="event-poster" aria-hidden="true">
                      <span className="poster-number">WB</span>
                      <span>{t('لقاء', 'MEET')}</span>
                      <div className="poster-line" />
                      <strong>{formatDate(event.startsAt, locale).split(' ')[0]}</strong>
                    </div>
                  ) : null}
                </article>
              ))}
              {home.events.length === 0 ? (
                <div className="empty-state">
                  <span>□</span>
                  <h2>{t('لا توجد لقاءات مفتوحة حالياً', 'No open events right now')}</h2>
                  <p>
                    {t('تابع المنصة للقاء القادم.', 'Follow the platform for the next gathering.')}
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          {activeSection === 'profile' ? (
            <section className="profile-view connected-view">
              {user === null ? (
                <div className="auth-empty">
                  <span className="avatar avatar-profile">WB</span>
                  <p>{t('ملفك المهني الخاص', 'Your private professional space')}</p>
                  <h2>
                    {t(
                      'ابدأ حضورك المهني بخطوة واحدة',
                      'Start your professional presence in one step',
                    )}
                  </h2>
                  <button
                    className="primary-action"
                    onClick={() => setAccountOpen(true)}
                    type="button"
                  >
                    {t('أنشئ حساباً آمناً', 'Create a secure account')}
                  </button>
                </div>
              ) : (
                <>
                  <div className="profile-hero">
                    <span className="avatar avatar-profile">{initials(displayName)}</span>
                    <div>
                      <p>{t('ملفك المهني الخاص', 'Your private professional space')}</p>
                      <h2>{displayName}</h2>
                      <span>
                        {profile?.biography ||
                          t(
                            'أضف نبذة مختصرة لتعريف مجتمع WB بما تبنيه.',
                            'Add a short bio to help the WB community understand what you are building.',
                          )}
                      </span>
                    </div>
                    <span className="private-badge">
                      {t('خاص', 'Private')} <span aria-hidden="true">◌</span>
                    </span>
                  </div>
                  <div className="profile-grid">
                    <form className="profile-form" onSubmit={(event) => void saveProfile(event)}>
                      <div className="panel-heading">
                        <div>
                          <p>{t('بياناتك الأساسية', 'Your basics')}</p>
                          <h2>{t('صِغ حضورك بطريقتك', 'Shape your presence your way')}</h2>
                        </div>
                        <span className="live-form-label">
                          {t('محفوظ بأمان', 'Securely stored')}
                        </span>
                      </div>
                      <label>
                        {t('الاسم الظاهر', 'Display name')}
                        <input
                          onChange={(event) =>
                            setProfileDraft((current) => ({
                              ...current,
                              displayName: event.target.value,
                            }))
                          }
                          required
                          value={profileDraft.displayName}
                        />
                      </label>
                      <label>
                        {t('نبذة قصيرة', 'Short bio')}
                        <textarea
                          onChange={(event) =>
                            setProfileDraft((current) => ({
                              ...current,
                              biography: event.target.value || null,
                            }))
                          }
                          rows={4}
                          value={profileDraft.biography ?? ''}
                        />
                      </label>
                      <label>
                        {t('مجالات الاهتمام', 'Areas of interest')}
                        <input
                          onChange={(event) =>
                            setProfileDraft((current) => ({
                              ...current,
                              skills: event.target.value
                                .split(',')
                                .map((skill) => skill.trim())
                                .filter(Boolean),
                            }))
                          }
                          value={profileDraft.skills.join(', ')}
                        />
                      </label>
                      <div className="form-footer">
                        <span>
                          {t(
                            'تُستخدم هذه البيانات لتخصيص تجربتك ومطابقتك مع فرص ذات صلة.',
                            'This information personalizes your experience and helps match relevant opportunities.',
                          )}
                        </span>
                        <button className="primary-action" type="submit">
                          {t('حفظ التغييرات', 'Save changes')}
                        </button>
                      </div>
                    </form>
                    <aside className="profile-aside">
                      <div>
                        <p>{t('خطوتك التالية', 'Your next step')}</p>
                        <h3>
                          {t(
                            'انضم إلى مجتمع يوسّع أسئلتك',
                            'Join a community that expands your questions',
                          )}
                        </h3>
                        <p>
                          {t(
                            'ابدأ بمتابعة مجتمع واحد، ثم احجز لقاءً قريباً لتتعرف على أشخاص يشاركونك الاتجاه.',
                            'Follow one community, then reserve a gathering to meet people who share your direction.',
                          )}
                        </p>
                        <button onClick={() => changeSection('community')} type="button">
                          {t('استكشف المجتمعات', 'Explore communities')} <ArrowIcon />
                        </button>
                      </div>
                      <div className="profile-completion">
                        <span>{t('اكتمال الملف', 'Profile completion')}</span>
                        <strong>
                          {profile?.biography && profile.skills.length > 0 ? '100%' : '65%'}
                        </strong>
                        <div>
                          <i
                            style={{
                              width:
                                profile?.biography && profile.skills.length > 0 ? '100%' : '65%',
                            }}
                          />
                        </div>
                      </div>
                    </aside>
                  </div>
                </>
              )}
            </section>
          ) : null}
        </section>
      </div>

      {accountOpen ? (
        <div className="auth-overlay" role="presentation">
          <section aria-label={t('الحساب', 'Account')} className="auth-card">
            <button
              aria-label={t('إغلاق', 'Close')}
              className="auth-close"
              onClick={() => setAccountOpen(false)}
              type="button"
            >
              ×
            </button>
            <span className="auth-eyebrow">WB / {t('هوية موثوقة', 'trusted identity')}</span>
            <h2>
              {authMode === 'register'
                ? t('ابدأ مساحتك المهنية', 'Begin your professional space')
                : t('مرحباً بعودتك', 'Welcome back')}
            </h2>
            <p>
              {t(
                'أدِر ملفك، انضم للمجتمعات، وسجّل حضورك ببيانات حقيقية محفوظة بأمان.',
                'Manage your profile, join communities, and register for events with real data stored securely.',
              )}
            </p>
            <form onSubmit={(event) => void handleAuthentication(event)}>
              <label>
                {t('البريد الإلكتروني', 'Email address')}
                <input
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label>
                {t('كلمة المرور', 'Password')}
                <input
                  autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                  minLength={12}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
                <small>{t('12 حرفاً على الأقل', 'At least 12 characters')}</small>
              </label>
              {authError !== null ? (
                <p className="auth-error" role="alert">
                  {authError}
                </p>
              ) : null}
              <button
                className="primary-action auth-submit"
                disabled={isAuthenticating}
                type="submit"
              >
                {isAuthenticating
                  ? t('جارٍ المعالجة…', 'Working…')
                  : authMode === 'register'
                    ? t('إنشاء الحساب', 'Create account')
                    : t('تسجيل الدخول', 'Sign in')}{' '}
                <ArrowIcon />
              </button>
            </form>
            <button
              className="auth-switch"
              onClick={() =>
                setAuthMode((current) => (current === 'register' ? 'login' : 'register'))
              }
              type="button"
            >
              {authMode === 'register'
                ? t('لديك حساب بالفعل؟ سجّل الدخول', 'Already have an account? Sign in')
                : t('جديد في WB؟ أنشئ حساباً', 'New to WB? Create an account')}
            </button>
          </section>
        </div>
      ) : null}

      <footer className="site-footer">
        <div className="footer-brand">
          <span className="brand-symbol" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <strong>WB</strong>
        </div>
        <span>
          {t(
            'منصة مهنية تبني قيمة مشتركة، خطوة تلو الأخرى.',
            'A professional platform for building shared value, one step at a time.',
          )}
        </span>
        <div>
          <button onClick={() => setLocale('ar')} type="button">
            العربية
          </button>
          <span>·</span>
          <button onClick={() => setLocale('en')} type="button">
            English
          </button>
        </div>
      </footer>
    </main>
  );
}
