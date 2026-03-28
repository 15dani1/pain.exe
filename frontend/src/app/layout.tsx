import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "pain.exe | Personal AI Agent",
  description:
    "A hackathon prototype for a relentless personal AI coaching agent that plans, tracks, escalates, and adapts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
