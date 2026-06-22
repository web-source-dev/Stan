import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { MediaLibraryProvider } from '@/components/media/MediaLibrary';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import DevAnnotations from '@/components/DevAnnotations';

export const metadata: Metadata = {
  title: 'Stan - Your Creator Store',
  description: 'Stan is the easiest way to make money online. All of your courses, digital products, and bookings are now hosted within your link-in-bio.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <MediaLibraryProvider>{children}</MediaLibraryProvider>
        </AuthProvider>
        <LanguageSwitcher />
        <DevAnnotations />
      </body>
    </html>
  );
}
