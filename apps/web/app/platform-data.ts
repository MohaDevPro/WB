export type Locale = 'ar' | 'en';

export type LocalizedText = Readonly<Record<Locale, string>>;

export type PlatformSection = 'home' | 'discover' | 'community' | 'events' | 'profile';

export const copy = (text: LocalizedText, locale: Locale): string => text[locale];

export const navigation: readonly Readonly<{
  id: PlatformSection;
  label: LocalizedText;
}>[] = [
  { id: 'home', label: { ar: 'الرئيسية', en: 'Home' } },
  { id: 'discover', label: { ar: 'اكتشف الخبرات', en: 'Discover' } },
  { id: 'community', label: { ar: 'المجتمعات', en: 'Communities' } },
  { id: 'events', label: { ar: 'اللقاءات', en: 'Events' } },
  { id: 'profile', label: { ar: 'ملفي', en: 'My profile' } },
];

export const platformStats = [
  { label: { ar: 'عضو مهني', en: 'Professionals' }, value: '18K+' },
  { label: { ar: 'فرصة هذا الشهر', en: 'Monthly opportunities' }, value: '420' },
  { label: { ar: 'مجتمع متخصص', en: 'Active circles' }, value: '36' },
];

export const featuredPeople = [
  {
    badge: { ar: 'موثّق', en: 'Verified' },
    color: 'violet',
    expertise: { ar: 'استراتيجية المنتجات', en: 'Product strategy' },
    initials: 'RA',
    name: { ar: 'ريما العتيبي', en: 'Reema Alotaibi' },
    role: { ar: 'قائدة منتجات رقمية', en: 'Digital product leader' },
  },
  {
    badge: { ar: 'مرشد', en: 'Mentor' },
    color: 'gold',
    expertise: { ar: 'النمو والاستثمار', en: 'Growth & investment' },
    initials: 'FA',
    name: { ar: 'فهد الأنصاري', en: 'Fahad Alansari' },
    role: { ar: 'مستثمر ومؤسس', en: 'Investor & founder' },
  },
  {
    badge: { ar: 'خبيرة', en: 'Expert' },
    color: 'teal',
    expertise: { ar: 'تصميم الخدمات', en: 'Service design' },
    initials: 'LM',
    name: { ar: 'لولوة المطيري', en: 'Lulwa Almutairi' },
    role: { ar: 'استشارية تجربة عميل', en: 'Customer experience consultant' },
  },
] as const;

export const upcomingEvent = {
  date: { ar: 'الأربعاء، 28 مايو', en: 'Wednesday, 28 May' },
  format: { ar: 'لقاء حضوري وهجين', en: 'In-person & hybrid' },
  guests: { ar: '+180 مسجّل', en: '180+ registered' },
  location: { ar: 'مركز الملك عبدالله المالي، الرياض', en: 'KAFD, Riyadh' },
  speaker: { ar: 'أ. سارة الحربي', en: 'Sara Alharbi' },
  title: {
    ar: 'من الفكرة إلى الأثر: بناء منتجات يثق بها الناس',
    en: 'From idea to impact: building products people trust',
  },
};

export const communities = [
  {
    accent: 'violet',
    members: '3.4K',
    name: { ar: 'روّاد المنتجات', en: 'Product builders' },
    summary: {
      ar: 'نقاشات عملية عن اكتشاف المشكلة، التجارب، وإدارة الأثر.',
      en: 'Practical conversations on discovery, experiments, and impact.',
    },
  },
  {
    accent: 'teal',
    members: '2.1K',
    name: { ar: 'الاقتصاد الإبداعي', en: 'Creative economy' },
    summary: {
      ar: 'مساحة للمؤسسين والمبدعين لبناء الشراكات والفرص.',
      en: 'A space for founders and creatives to build partnerships.',
    },
  },
  {
    accent: 'gold',
    members: '1.8K',
    name: { ar: 'قادة التحول', en: 'Transformation leaders' },
    summary: {
      ar: 'رؤى من داخل الجهات التي تصمّم الخدمات العامة والخاصة.',
      en: 'Insights from leaders designing public and private services.',
    },
  },
] as const;

export const feed = [
  {
    author: { ar: 'نورة السالم', en: 'Noura Alsalem' },
    initials: 'NS',
    meta: { ar: 'منذ 35 دقيقة · مجتمع روّاد المنتجات', en: '35 minutes ago · Product builders' },
    text: {
      ar: 'ما أكثر إشارة مبكرة تساعدكم في معرفة أن المشكلة تستحق البناء لها؟ أشارك هذا الأسبوع إطاراً بسيطاً لاختبار الفرضيات قبل الاستثمار في الحل.',
      en: 'What early signal tells you a problem is worth building for? This week I am sharing a simple framework for testing assumptions before investing in a solution.',
    },
  },
  {
    author: { ar: 'عبدالعزيز العبدالكريم', en: 'Abdulaziz Alabdulkarim' },
    initials: 'AA',
    meta: { ar: 'منذ ساعتين · مجتمع قادة التحول', en: '2 hours ago · Transformation leaders' },
    text: {
      ar: 'فتحنا التسجيل لجلسة عمل مصغرة عن قياس جودة الخدمة. المقاعد محدودة لضمان نقاش عملي ومباشر.',
      en: 'Registration is open for a small working session on measuring service quality. Seats are limited for a practical discussion.',
    },
  },
] as const;

export const opportunities = [
  {
    company: { ar: 'مختبر الأثر', en: 'Impact Lab' },
    label: { ar: 'فرصة تعاون', en: 'Collaboration' },
    title: { ar: 'باحث/ة تجربة مستخدم', en: 'User research partner' },
  },
  {
    company: { ar: 'بوصلة', en: 'Bousla' },
    label: { ar: 'مشروع قصير', en: 'Short project' },
    title: { ar: 'مستشار نمو', en: 'Growth advisor' },
  },
] as const;
