'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';

import {
  communities,
  copy,
  feed,
  featuredPeople,
  navigation,
  opportunities,
  platformStats,
  type Locale,
  type PlatformSection,
  upcomingEvent,
} from './platform-data';

const sectionKicker: Record<PlatformSection, Record<Locale, string>> = {
  community: { ar: 'محادثات متخصصة', en: 'Focused conversations' },
  discover: { ar: 'خبرات مختارة', en: 'Curated expertise' },
  events: { ar: 'تعلّم حي', en: 'Live learning' },
  home: { ar: 'منصة WB المهنية', en: 'WB professional platform' },
  profile: { ar: 'مساحتك المهنية', en: 'Your professional space' },
};

const sectionTitles: Record<PlatformSection, Record<Locale, string>> = {
  community: { ar: 'مجتمعات تنمو بالمشاركة', en: 'Communities that grow through contribution' },
  discover: { ar: 'اكتشف من يوسّع أثر فكرتك', en: 'Find people who expand your idea’s impact' },
  events: { ar: 'لقاءات تصنع اتصالاً حقيقياً', en: 'Events that create real connection' },
  home: {
    ar: 'تعلّم، تواصل، وابنِ أثراً يتجاوزك',
    en: 'Learn, connect, and build impact beyond yourself',
  },
  profile: { ar: 'ملف مهني يبدأ بك', en: 'A professional profile that starts with you' },
};

function ArrowIcon() {
  return (
    <span aria-hidden="true" className="arrow-icon">
      ←
    </span>
  );
}

export default function HomePage() {
  const [activeSection, setActiveSection] = useState<PlatformSection>('home');
  const [locale, setLocale] = useState<Locale>('ar');
  const [isJoined, setIsJoined] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');

  const direction = locale === 'ar' ? 'rtl' : 'ltr';
  const filteredPeople = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    if (normalizedQuery.length === 0) {
      return featuredPeople;
    }

    return featuredPeople.filter((person) =>
      [copy(person.name, locale), copy(person.role, locale), copy(person.expertise, locale)]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [locale, query]);

  const t = (arabic: string, english: string): string => (locale === 'ar' ? arabic : english);

  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = locale;
  }, [direction, locale]);

  function changeSection(section: PlatformSection): void {
    setActiveSection(section);
    setNotice('');
  }

  function handleJoin(): void {
    setIsJoined((current) => !current);
    setNotice(
      !isJoined
        ? t(
            'أهلاً بك في تجربة WB. تم تجهيز مساحتك المهنية للبدء.',
            'Welcome to WB. Your professional space is ready to begin.',
          )
        : t(
            'يمكنك العودة إلى ملفك في أي وقت لإكمال بياناتك.',
            'You can return to your profile at any time to complete it.',
          ),
    );
    setActiveSection('profile');
  }

  function handleProfileSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setProfileSaved(true);
    setNotice(t('تم حفظ التغييرات في وضع الاستعراض.', 'Changes have been saved in demo mode.'));
  }

  return (
    <main className="wb-app" dir={direction}>
      <a className="skip-link" href="#platform-content">
        {t('انتقل إلى المحتوى', 'Skip to content')}
      </a>

      <header className="topbar">
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
                {copy(item.label, locale)}
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
            <button
              className="avatar-button"
              onClick={() => changeSection('profile')}
              type="button"
            >
              <span className="avatar avatar-small">م</span>
              <span className="avatar-name">{t('محمد', 'Mohammed')}</span>
            </button>
          </div>
        </div>
      </header>

      <section className="demo-banner" aria-label={t('تنبيه وضع الاستعراض', 'Demo mode notice')}>
        <span className="demo-dot" aria-hidden="true" />
        <span>
          {t(
            'تجربة واجهة تفاعلية — البيانات المعروضة توضيحية وآمنة',
            'Interactive interface preview — displayed data is illustrative and safe',
          )}
        </span>
      </section>

      <div className="mobile-nav" aria-label={t('تنقل الجوال', 'Mobile navigation')}>
        {navigation.map((item) => (
          <button
            aria-label={copy(item.label, locale)}
            className={activeSection === item.id ? 'mobile-nav-item is-active' : 'mobile-nav-item'}
            key={item.id}
            onClick={() => changeSection(item.id)}
            type="button"
          >
            <span aria-hidden="true">
              {item.id === 'home'
                ? '⌂'
                : item.id === 'discover'
                  ? '⌕'
                  : item.id === 'community'
                    ? '◌'
                    : item.id === 'events'
                      ? '□'
                      : '◉'}
            </span>
            <small>{copy(item.label, locale)}</small>
          </button>
        ))}
      </div>

      {notice.length > 0 ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}

      <div id="platform-content" className="platform-layout">
        <aside className="sidebar" aria-label={t('روابط سريعة', 'Quick links')}>
          <p className="sidebar-label">{t('استكشف WB', 'Explore WB')}</p>
          {navigation.map((item) => (
            <button
              className={activeSection === item.id ? 'side-link is-active' : 'side-link'}
              key={item.id}
              onClick={() => changeSection(item.id)}
              type="button"
            >
              <span className="side-glyph" aria-hidden="true">
                {item.id === 'home'
                  ? '⌂'
                  : item.id === 'discover'
                    ? '⌕'
                    : item.id === 'community'
                      ? '◌'
                      : item.id === 'events'
                        ? '□'
                        : '◉'}
              </span>
              {copy(item.label, locale)}
            </button>
          ))}
          <div className="sidebar-card">
            <span className="sidebar-card-kicker">
              {t('فكرتك تستحق مساحة', 'Your idea deserves a space')}
            </span>
            <strong>
              {t(
                'ابنِ حضورك المهني بخطوات هادئة وواضحة.',
                'Build your professional presence with calm, clear steps.',
              )}
            </strong>
            <button onClick={() => changeSection('profile')} type="button">
              {t('ابدأ ملفك', 'Start your profile')} <ArrowIcon />
            </button>
          </div>
        </aside>

        <section className="content-stage">
          <div className="section-intro">
            <p className="section-kicker">{sectionKicker[activeSection][locale]}</p>
            <h1>{sectionTitles[activeSection][locale]}</h1>
            {activeSection === 'home' ? (
              <p>
                {t(
                  'WB تجمع الممارسين والخبراء والفرص في مساحة واحدة مصممة للتعلّم العملي، العلاقات الموثوقة، والعمل الذي يترك أثراً.',
                  'WB brings practitioners, experts, and opportunities into one space for practical learning, trusted relationships, and work that leaves an impact.',
                )}
              </p>
            ) : null}
          </div>

          {activeSection === 'home' ? (
            <>
              <section
                className="hero-grid"
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
                    <button className="primary-action" onClick={handleJoin} type="button">
                      {isJoined
                        ? t('أكمل ملفك المهني', 'Complete your profile')
                        : t('انضم إلى WB', 'Join WB')}
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
                  <div className="hero-stats">
                    {platformStats.map((stat) => (
                      <div key={stat.value}>
                        <strong>{stat.value}</strong>
                        <span>{copy(stat.label, locale)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="hero-scene" aria-hidden="true">
                  <div className="scene-grid" />
                  <div className="scene-sun" />
                  <div className="scene-card scene-card-top">
                    <span className="scene-mini-avatar avatar-violet">ر</span>
                    <div>
                      <b>{t('محادثة مفيدة', 'Useful conversation')}</b>
                      <small>{t('مع خبير موثوق', 'with a trusted expert')}</small>
                    </div>
                  </div>
                  <div className="scene-card scene-card-bottom">
                    <span className="scene-mini-icon">✦</span>
                    <div>
                      <b>{t('فرصة جديدة', 'New opportunity')}</b>
                      <small>{t('فرّق عملك عن الضجيج', 'Make your work stand out')}</small>
                    </div>
                  </div>
                  <div className="scene-orbit orbit-one" />
                  <div className="scene-orbit orbit-two" />
                  <div className="scene-figure figure-one">
                    <span>ن</span>
                  </div>
                  <div className="scene-figure figure-two">
                    <span>ف</span>
                  </div>
                  <div className="scene-figure figure-three">
                    <span>ل</span>
                  </div>
                </div>
              </section>

              <section className="home-split-grid">
                <div className="panel panel-discover">
                  <div className="panel-heading">
                    <div>
                      <p>{t('خبرات قريبة من احتياجك', 'Expertise near your need')}</p>
                      <h2>{t('ابدأ بمحادثة ذات معنى', 'Start a conversation that matters')}</h2>
                    </div>
                    <button onClick={() => changeSection('discover')} type="button">
                      {t('عرض الكل', 'View all')} <ArrowIcon />
                    </button>
                  </div>
                  <div className="people-list">
                    {featuredPeople.slice(0, 2).map((person) => (
                      <article className="person-row" key={person.initials}>
                        <span className={`avatar avatar-${person.color}`}>{person.initials}</span>
                        <div>
                          <h3>{copy(person.name, locale)}</h3>
                          <p>{copy(person.role, locale)}</p>
                        </div>
                        <span className="person-badge">{copy(person.badge, locale)}</span>
                      </article>
                    ))}
                  </div>
                </div>
                <article className="panel panel-event">
                  <div className="event-icon">□</div>
                  <p>{t('اللقاء القادم', 'Next gathering')}</p>
                  <h2>{copy(upcomingEvent.title, locale)}</h2>
                  <div className="event-meta">
                    <span>{copy(upcomingEvent.date, locale)}</span>
                    <span>{copy(upcomingEvent.location, locale)}</span>
                  </div>
                  <button
                    className="dark-action"
                    onClick={() => changeSection('events')}
                    type="button"
                  >
                    {t('عرض التفاصيل', 'View details')} <ArrowIcon />
                  </button>
                </article>
              </section>

              <section className="value-strip" aria-label={t('لماذا WB', 'Why WB')}>
                {[
                  ['✦', t('معرفة قابلة للتطبيق', 'Knowledge you can apply')],
                  ['⌘', t('علاقات مبنية على الثقة', 'Relationships built on trust')],
                  ['↗', t('فرص تلتقي مع هدفك', 'Opportunities aligned with your goal')],
                ].map(([symbol, label]) => (
                  <div key={String(label)}>
                    <span aria-hidden="true">{symbol}</span>
                    <strong>{label}</strong>
                  </div>
                ))}
              </section>
            </>
          ) : null}

          {activeSection === 'discover' ? (
            <section className="discover-view">
              <div className="search-row">
                <label htmlFor="expert-search">
                  {t('ابحث بالمهارة أو المجال', 'Search by skill or field')}
                </label>
                <div>
                  <span aria-hidden="true">⌕</span>
                  <input
                    id="expert-search"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t(
                      'مثال: استراتيجية، نمو، تصميم…',
                      'e.g. strategy, growth, design…',
                    )}
                    value={query}
                  />
                </div>
              </div>
              <div className="expert-grid">
                {filteredPeople.map((person) => (
                  <article className="expert-card" key={person.initials}>
                    <div className="expert-card-top">
                      <span className={`avatar avatar-large avatar-${person.color}`}>
                        {person.initials}
                      </span>
                      <span className="person-badge">{copy(person.badge, locale)}</span>
                    </div>
                    <h2>{copy(person.name, locale)}</h2>
                    <p>{copy(person.role, locale)}</p>
                    <span className="skill-pill">{copy(person.expertise, locale)}</span>
                    <button
                      onClick={() =>
                        setNotice(
                          t(
                            `تم حفظ ${copy(person.name, locale)} في قائمة تواصلك.`,
                            `${copy(person.name, locale)} has been saved to your connections.`,
                          ),
                        )
                      }
                      type="button"
                    >
                      {t('طلب تواصل', 'Request connection')} <ArrowIcon />
                    </button>
                  </article>
                ))}
              </div>
              {filteredPeople.length === 0 ? (
                <div className="empty-state">
                  <span>⌕</span>
                  <h2>{t('لم نعثر على نتيجة مطابقة', 'No matching expertise found')}</h2>
                  <p>
                    {t(
                      'جرّب كلمة أقصر أو استعرض الخبرات المقترحة.',
                      'Try a shorter term or browse suggested expertise.',
                    )}
                  </p>
                </div>
              ) : null}
              <section className="opportunity-panel">
                <div>
                  <p>{t('فرص مختارة لك', 'Selected opportunities')}</p>
                  <h2>
                    {t(
                      'عمل ينسجم مع الخبرة التي تبنيها',
                      'Work aligned with the expertise you are building',
                    )}
                  </h2>
                </div>
                <div className="opportunity-list">
                  {opportunities.map((opportunity) => (
                    <button
                      key={copy(opportunity.title, locale)}
                      onClick={() =>
                        setNotice(
                          t(
                            'تمت إضافة الفرصة إلى قائمتك للمتابعة.',
                            'The opportunity has been added to your follow-up list.',
                          ),
                        )
                      }
                      type="button"
                    >
                      <span>
                        <small>{copy(opportunity.label, locale)}</small>
                        <strong>{copy(opportunity.title, locale)}</strong>
                        <em>{copy(opportunity.company, locale)}</em>
                      </span>
                      <ArrowIcon />
                    </button>
                  ))}
                </div>
              </section>
            </section>
          ) : null}

          {activeSection === 'community' ? (
            <section className="community-view">
              <div className="community-grid">
                {communities.map((community) => (
                  <article
                    className={`community-card accent-${community.accent}`}
                    key={community.members}
                  >
                    <div className="community-card-art">
                      <span>{community.members}</span>
                    </div>
                    <div>
                      <p>{t('عضو نشط', 'active members')}</p>
                      <h2>{copy(community.name, locale)}</h2>
                      <p className="community-summary">{copy(community.summary, locale)}</p>
                      <button
                        onClick={() =>
                          setNotice(
                            t(
                              `أصبحت الآن تتابع ${copy(community.name, locale)}.`,
                              `You are now following ${copy(community.name, locale)}.`,
                            ),
                          )
                        }
                        type="button"
                      >
                        {t('انضم إلى الحوار', 'Join the conversation')} <ArrowIcon />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <section className="feed-panel">
                <div className="panel-heading">
                  <div>
                    <p>{t('من المجتمع', 'From the community')}</p>
                    <h2>{t('أفكار تستحق أن تكملها', 'Ideas worth carrying forward')}</h2>
                  </div>
                  <button
                    onClick={() =>
                      setNotice(
                        t(
                          'سيظهر محرر المشاركة في النسخة المتصلة بالهوية.',
                          'The post editor will appear in the identity-connected version.',
                        ),
                      )
                    }
                    type="button"
                  >
                    {t('اكتب مشاركة', 'Write a post')}
                  </button>
                </div>
                {feed.map((post) => (
                  <article className="feed-item" key={post.initials}>
                    <span className="avatar avatar-small avatar-violet">{post.initials}</span>
                    <div>
                      <h3>{copy(post.author, locale)}</h3>
                      <small>{copy(post.meta, locale)}</small>
                      <p>{copy(post.text, locale)}</p>
                      <div className="feed-actions">
                        <button
                          onClick={() =>
                            setNotice(t('تم تقدير هذه الفكرة.', 'This idea has been appreciated.'))
                          }
                          type="button"
                        >
                          {t('مفيد', 'Helpful')} <span>24</span>
                        </button>
                        <button
                          onClick={() =>
                            setNotice(
                              t(
                                'سيُتاح الرد عند توصيل الحساب.',
                                'Replies will be available when the account is connected.',
                              ),
                            )
                          }
                          type="button"
                        >
                          {t('رد', 'Reply')}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            </section>
          ) : null}

          {activeSection === 'events' ? (
            <section className="events-view">
              <article className="event-spotlight">
                <div className="event-spotlight-copy">
                  <p>{copy(upcomingEvent.format, locale)}</p>
                  <h2>{copy(upcomingEvent.title, locale)}</h2>
                  <p className="event-description">
                    {t(
                      'جلسة عملية مع ممارسين يتشاركون ما نجح معهم وما الذي تغيّر في الطريق.',
                      'A practical session with practitioners sharing what worked and what changed along the way.',
                    )}
                  </p>
                  <div className="event-details">
                    <span>{copy(upcomingEvent.date, locale)}</span>
                    <span>{copy(upcomingEvent.location, locale)}</span>
                    <span>{copy(upcomingEvent.guests, locale)}</span>
                  </div>
                  <button
                    className="primary-action"
                    onClick={() =>
                      setNotice(
                        t(
                          'تم حجز مقعدك في وضع الاستعراض.',
                          'Your seat has been reserved in demo mode.',
                        ),
                      )
                    }
                    type="button"
                  >
                    {t('سجّل حضورك', 'Reserve your seat')} <ArrowIcon />
                  </button>
                </div>
                <div className="event-poster">
                  <span className="poster-number">28</span>
                  <span>{t('مايو', 'MAY')}</span>
                  <div className="poster-line" />
                  <strong>
                    WB
                    <br />
                    MEET
                  </strong>
                </div>
              </article>
              <div className="event-list-heading">
                <div>
                  <p>{t('قريباً', 'Coming up')}</p>
                  <h2>
                    {t('اختر اللقاء الذي يناسب مرحلتك', 'Choose the gathering for your next step')}
                  </h2>
                </div>
              </div>
              <div className="mini-events">
                {[
                  'مستديرة قادة الفرق',
                  'جلسة تفكير: من البيانات إلى القرار',
                  'مختبر الفرص المهنية',
                ].map((eventName, index) => (
                  <button
                    key={eventName}
                    onClick={() =>
                      setNotice(
                        t(
                          'تمت إضافة هذا اللقاء إلى جدولك.',
                          'This gathering has been added to your schedule.',
                        ),
                      )
                    }
                    type="button"
                  >
                    <span className={`date-square date-${index + 1}`}>
                      <b>{18 + index}</b>
                      <small>{t('يونيو', 'JUN')}</small>
                    </span>
                    <span>
                      <strong>
                        {locale === 'ar'
                          ? eventName
                          : [
                              'Team leads roundtable',
                              'Thinking session: data to decision',
                              'Professional opportunity lab',
                            ][index]}
                      </strong>
                      <small>{t('الرياض · 6:30 مساءً', 'Riyadh · 6:30 PM')}</small>
                    </span>
                    <ArrowIcon />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {activeSection === 'profile' ? (
            <section className="profile-view">
              <div className="profile-hero">
                <span className="avatar avatar-profile">م</span>
                <div>
                  <p>
                    {profileSaved
                      ? t('تم الحفظ في وضع الاستعراض', 'Saved in demo mode')
                      : t('مساحتك المهنية الخاصة', 'Your private professional space')}
                  </p>
                  <h2>{t('محمد أمين', 'Mohammed Amin')}</h2>
                  <span>
                    {t(
                      'مهتم ببناء مجتمعات ومنتجات ذات أثر',
                      'Interested in building communities and products with impact',
                    )}
                  </span>
                </div>
                <button
                  onClick={() =>
                    setNotice(
                      t(
                        'ستصبح الخصوصية قابلة للتحكم بعد توصيل حسابك.',
                        'Privacy controls will become available when your account is connected.',
                      ),
                    )
                  }
                  type="button"
                >
                  {t('خاص', 'Private')} <span aria-hidden="true">◌</span>
                </button>
              </div>
              <div className="profile-grid">
                <form className="profile-form" onSubmit={handleProfileSubmit}>
                  <div className="panel-heading">
                    <div>
                      <p>{t('بياناتك الأساسية', 'Your basics')}</p>
                      <h2>{t('صِغ حضورك بطريقتك', 'Shape your presence your way')}</h2>
                    </div>
                    <span className="demo-form-label">{t('وضع الاستعراض', 'Demo mode')}</span>
                  </div>
                  <label>
                    {t('الاسم الظاهر', 'Display name')}
                    <input defaultValue={t('محمد أمين', 'Mohammed Amin')} name="name" />
                  </label>
                  <label>
                    {t('نبذة قصيرة', 'Short bio')}
                    <textarea
                      defaultValue={t(
                        'أبني مساحات رقمية تساعد الناس على التعلّم والتعاون بثقة.',
                        'I build digital spaces that help people learn and collaborate with confidence.',
                      )}
                      name="bio"
                      rows={4}
                    />
                  </label>
                  <label>
                    {t('مجالات الاهتمام', 'Areas of interest')}
                    <input
                      defaultValue={t(
                        'المنتجات الرقمية، المجتمعات، الاستراتيجية',
                        'Digital products, communities, strategy',
                      )}
                      name="skills"
                    />
                  </label>
                  <div className="form-footer">
                    <span>
                      {t(
                        'تظهر هذه البيانات لك فقط في هذه المرحلة.',
                        'These details are visible only to you at this stage.',
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
                        'ابدأ بمتابعة مجتمع واحد، ثم احجز لقاءً قريباً لتتعرّف على أشخاص يشاركونك الاتجاه.',
                        'Follow one community, then reserve a gathering to meet people who share your direction.',
                      )}
                    </p>
                    <button onClick={() => changeSection('community')} type="button">
                      {t('استكشف المجتمعات', 'Explore communities')} <ArrowIcon />
                    </button>
                  </div>
                  <div className="profile-completion">
                    <span>{t('ملفك في وضع الاستعراض', 'Your demo profile')}</span>
                    <strong>62%</strong>
                    <div>
                      <i />
                    </div>
                  </div>
                </aside>
              </div>
            </section>
          ) : null}
        </section>
      </div>

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
