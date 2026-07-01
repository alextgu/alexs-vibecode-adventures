import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hard 75 — Alex Version",
  description: "75 days. Every rule. Every day.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
