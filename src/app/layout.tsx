import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { Sidebar } from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "Pabrik Artikel - AI Dashboard",
  description: "Multi-tenant autonomous AI SEO Content Generator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-muted/20">
          {children}
        </main>
      </body>
    </html>
  );
}
