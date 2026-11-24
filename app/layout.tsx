import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const text = Barlow({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-text",
  display: "swap",
});

const display = Barlow_Condensed({
  weight: "700",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "photobooth",
  description: "Webcam photobooth with filters and photo strips",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${text.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
