import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Who to Meet — Ralphthon",
  description: "AI-powered networking recommendations for Ralphthon hackathon",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-[#0a0a0f] text-[#e0e0e8]">
        {children}
      </body>
    </html>
  );
}
