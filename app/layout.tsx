import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";

const nunito = localFont({
  src: [{ path: "./fonts/nunito-latin-wght-normal.woff2", weight: "200 1000", style: "normal" }, { path: "./fonts/nunito-latin-ext-wght-normal.woff2", weight: "200 1000", style: "normal" }],
  variable: "--font-nunito",
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
    <html lang={locale} className={`${GeistSans.variable} ${nunito.variable}`}>
      <body className="min-h-dvh">
        <a href="#main" className="skip-link">{t("skipToContent")}</a>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
