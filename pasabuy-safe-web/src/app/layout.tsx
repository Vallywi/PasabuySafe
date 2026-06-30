import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/Header';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'PasabuySafe — Anti-Scam Escrow for Group Buying',
  description: 'Your payment is locked until you confirm delivery. Stop pasabuy scams with blockchain-powered escrow on Stellar.',
  keywords: ['pasabuy', 'escrow', 'stellar', 'soroban', 'anti-scam', 'group buying', 'philippines'],
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'PasabuySafe — Stop Pasabuy Scams',
    description: 'Your money is locked on blockchain until you confirm delivery.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-amber-50">
      <body className={`${inter.variable} font-sans bg-amber-50 text-slate-900 antialiased min-h-screen`}>
        <Header />
        <main className="pb-20 md:pb-0 bg-amber-50 min-h-[calc(100vh-64px)]">{children}</main>
      </body>
    </html>
  );
}
