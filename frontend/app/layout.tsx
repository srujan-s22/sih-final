import type { Metadata, Viewport } from "next";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { DevStatusBar } from "@/components/dev/dev-status-bar";

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} — Healthcare Access & Entitlement Platform`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    "SwasthyaSetu",
    "Healthcare Access",
    "Ayushman Bharat",
    "Health Entitlement",
    "Public Health",
    "India Healthcare",
  ],
  authors: [{ name: "SwasthyaSetu Public Service Initiative" }],
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900 antialiased selection:bg-teal-100 selection:text-teal-900">
        <Header />
        <div className="flex-1 flex flex-col">{children}</div>
        <Footer />
        <DevStatusBar />
      </body>
    </html>
  );
}
