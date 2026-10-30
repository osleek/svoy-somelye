import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter_Tight } from 'next/font/google';

import './globals.css';

const display = Cormorant_Garamond({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const body = Inter_Tight({
  subsets: ['cyrillic', 'latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Свой Сомелье — подбор российского вина',
  description:
    'Личный сомелье для российского вина: подбирает по блюду, вкусу, сорту и региону из каталога «Своё Вино», задаёт уточняющие вопросы и объясняет выбор.',
  openGraph: {
    title: 'Свой Сомелье',
    description: 'Подбор российского вина по блюду, вкусу и поводу.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
