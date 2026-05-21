import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "./components/Navigation";
import CookiesBanner from "./components/CookiesBanner";
import PWAInstallBanner from "./components/PWAInstallBanner";
import Providers from "./providers";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "gymmoo.",
  description: "Seguiment d'entrenaments personal",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="gymmoo." />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <meta name="theme-color" content="#F5F2EA" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0B0A09" media="(prefers-color-scheme: dark)" />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} antialiased bg-[var(--bg)] text-[var(--text)]`}>
        <Providers>
          <CookiesBanner />
          {children}
          <PWAInstallBanner />
          <Navigation />
        </Providers>
      </body>
    </html>
  );
}