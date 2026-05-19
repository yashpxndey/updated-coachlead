import type {Metadata} from 'next';
import './globals.css'; // Global styles
import InstallBanner from '@/components/install-banner';

export const metadata: Metadata = {
  title: 'CoachLead — Academy Management',
  description: 'Academy Management System by Revjet',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CoachLead'
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg'
  }
}

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {children}
        <InstallBanner />
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
              })
            }
          `
        }} />
      </body>
    </html>
  );
}
