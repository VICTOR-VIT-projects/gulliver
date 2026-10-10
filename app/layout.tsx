import type { Metadata } from "next";
import { Big_Shoulders, IBM_Plex_Mono, Newsreader } from "next/font/google";
import "./globals.css";

// Next has no fallback metrics for Big Shoulders, so skip size-adjust and fall back to a condensed system face.
const display = Big_Shoulders({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-big-shoulders",
  adjustFontFallback: false,
  fallback: ["Arial Narrow", "sans-serif"],
});
const serif = Newsreader({ subsets: ["latin"], axes: ["opsz"], style: ["normal", "italic"], variable: "--font-newsreader" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: { default: "Gulliver: every city, sized up", template: "%s · Gulliver" },
  description: "Tour intelligence for promoters, venues and talent agents, built on Qloo's taste graph.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${serif.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
