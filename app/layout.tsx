import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recall — AI Flashcard Engine",
  description: "Turn any PDF into a smart flashcard deck with spaced repetition",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
