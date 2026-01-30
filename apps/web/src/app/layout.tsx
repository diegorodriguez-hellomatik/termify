import type { Metadata } from 'next';
import { JetBrains_Mono, Fira_Code, Source_Code_Pro, IBM_Plex_Mono, Space_Mono, Inter } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

// Terminal-themed fonts
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  weight: ['300', '400', '500', '600', '700'],
});

const firaCode = Fira_Code({
  subsets: ['latin'],
  variable: '--font-fira',
  weight: ['300', '400', '500', '600', '700'],
});

const sourceCodePro = Source_Code_Pro({
  subsets: ['latin'],
  variable: '--font-source',
  weight: ['300', '400', '500', '600', '700'],
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-ibm',
  weight: ['300', '400', '500', '600', '700'],
});

const spaceMono = Space_Mono({
  subsets: ['latin'],
  variable: '--font-space',
  weight: ['400', '700'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Termify',
  description: 'Cloud terminal platform',
  manifest: '/manifest.json',
  themeColor: '#000000',
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Termify',
  },
};

// Script to prevent theme/font flash - runs before React hydrates
const themeScript = `
  (function() {
    try {
      // Theme
      var theme = localStorage.getItem('theme');
      if (theme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }
      document.documentElement.setAttribute('data-theme', theme || 'dark');

      // Font family
      var fontFamily = localStorage.getItem('fontFamily') || 'jetbrains';
      document.documentElement.setAttribute('data-font', fontFamily);

      // Font size
      var fontSize = localStorage.getItem('fontSize') || '16';
      document.documentElement.style.setProperty('--font-size', fontSize + 'px');
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${jetbrainsMono.variable} ${firaCode.variable} ${sourceCodePro.variable} ${ibmPlexMono.variable} ${spaceMono.variable} ${inter.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
