import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";

import "./globals.css";

const inter = localFont({
  src: "./fonts/inter-variable.woff2",
  display: "swap",
  variable: "--font-inter",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Stena Content Portal",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sv" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
