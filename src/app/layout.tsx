import type { Metadata } from "next";
import { Inter } from "next/font/google"; // You can keep Inter, or switch to something like Outfit or Plus Jakarta Sans
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });

export const metadata: Metadata = {
  title: "OralCheck – AI Oral Technical Assessments",
  description: "Create and complete AI-powered oral technical assessments",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`font-sans antialiased bg-slate-50 text-slate-800 min-h-screen selection:bg-sky-200 selection:text-sky-900`}>
        {children}
      </body>
    </html>
  );
}
