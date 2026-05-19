import type {Metadata, Viewport} from 'next';
import './globals.css'; // Global styles
import InstallBanner from '@/components/install-banner';
import ServiceWorkerRegistration from '@/components/service-worker-registration';

export const metadata: Metadata = {
  title: 'CoachLead — Academy Management',
  description: 'Academy Management System for Coaches and Academies',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CoachLead',
    startupImage: [
      {
        url: '/icon-512x512.png',
        media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)',
      },
    ],
  },
  icons: {
    icon: '/icon-192x192.png',
    shortcut: '/icon-192x192.png',
    apple: '/icon-192x192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {children}
        <InstallBanner />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
