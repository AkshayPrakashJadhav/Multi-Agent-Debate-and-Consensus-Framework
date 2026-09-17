import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Multi-Agent Debate & Consensus Framework",
  description: "Advanced domain-specific decision support framework using multi-agent LLM systems, RAG, and custom evaluations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className={`${inter.className} min-h-full bg-bg-app text-text-primary antialiased selection:bg-accent-soft selection:text-accent`}>
        {children}
      </body>
    </html>
  );
}
