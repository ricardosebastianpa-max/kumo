import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";

const fraunces = localFont({
  src: [{ path: "./fonts/fraunces-latin-opsz-normal.woff2", weight: "300 800", style: "normal" }, { path: "./fonts/fraunces-latin-ext-opsz-normal.woff2", weight: "300 800", style: "normal" }],
  variable: "--font-fraunces",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return { title: { default: "Kumo", template: "%s · Kumo" }, description: t("tagline"), applicationName: "Kumo", manifest: "/manifest.webmanifest" };
}
export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#FBF8F3" }, { media: "(prefers-color-scheme: dark)", color: "#0E1422" }],
  width: "device-width", initialScale: 1, viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations("common");
  return (
    <html lang={locale} className={`${GeistSans.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh">
        <a href="#main" className="skip-link">{t("skipToContent")}</a>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
