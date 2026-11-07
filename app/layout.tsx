import type { Metadata } from 'next';
import '@fontsource/fraunces/600.css';
import '@fontsource/fraunces/500.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import './globals.css';
import { DemoRibbon } from '@/components/DemoRibbon';
import { Shell } from '@/components/Shell';

export const metadata: Metadata = {
  title: 'Cashew — one verified trade, many lenders',
  description: 'A presentation-grade demo of neutral export-finance verification for Indian MSMEs.',
};

// The demo is stateful: every route reads the in-memory store, never a build-time snapshot.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-canvas text-ink antialiased">
        <DemoRibbon />
        <div className="pt-6">
          <Shell>{children}</Shell>
        </div>
      </body>
    </html>
  );
}
