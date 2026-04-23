import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PDX Hub — Portland Live Map",
  description:
    "Real-time map of Portland, OR public data: police, fire, 911 calls, transit alerts, bridge lifts, road closures, weather hazards, and health alerts.",
  applicationName: "PDX Hub",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "PDX Hub",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "PDX Hub — Portland Live Map",
    description: "Real-time Portland public data on an interactive map.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e85d3c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
