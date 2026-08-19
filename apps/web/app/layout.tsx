import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WB — Community Core',
  description: 'WB V0 community proof of concept',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        {/* THESIS: WB V0 makes a trusted community loop tangible instead of shipping a generic social dashboard. OWN-WORLD: deep ink, sand, coral, and mint form a civic noticeboard with calm density and sharp editorial hierarchy. STORY: activate your account, enter the right space, contribute, and reserve the next live conversation. FIRST VIEWPORT: the public landing places the WB mark and a compact action rail above a split welcome panel and live community preview. FORM: code-led, direct product build for an operational community surface. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance */}
        {children}
      </body>
    </html>
  );
}
