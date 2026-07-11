import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PFMI — Hybrid Preventive Maintenance Intelligence",
  description:
    "Stop reacting to machine failures. Start predicting them. PFMI unifies your maintenance operations with AI-powered scheduling, OCR data entry, and real-time analytics.",
  keywords: [
    "predictive maintenance",
    "machine maintenance",
    "AI",
    "OCR",
    "industrial IoT",
    "preventive maintenance",
  ],
  openGraph: {
    title: "PFMI — Hybrid Preventive Maintenance Intelligence",
    description: "Stop reacting to failures. Start predicting them.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('pfmi-theme');
                  if (!theme) theme = 'dark';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
