import type { Metadata } from 'next';

import './globals.css';

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
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter+Tight:wght@300;400;500;600&display=swap"
        />
        <meta name="theme-color" content="#fbf8f2" />
      </head>
      <body>{children}</body>
    </html>
  );
}
