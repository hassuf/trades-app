import type { Metadata } from "next";
import { Archivo, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import NavBar from "@/components/nav-bar";

const display = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "800"],
});

const body = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "FairWork — see the price before you call",
  description:
    "Local trades publish what they charge and show the work they just finished. No lead fees, no bidding wars.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Suspense fallback={<div className="h-[57px] border-b border-[var(--line)] bg-[var(--paper)]" />}>
          <NavBar />
        </Suspense>
        <div className="flex-1 pb-20 sm:pb-0">{children}</div>
      </body>
    </html>
  );
}