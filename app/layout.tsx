import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gulliver: every city, sized up",
  description: "A tour intelligence agent for promoters, venues and talent agents, grounded in Qloo's taste graph.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-stone-950 text-stone-100 antialiased">{children}</body>
    </html>
  );
}
