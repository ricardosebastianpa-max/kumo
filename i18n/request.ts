import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** Locale: explicit cookie → Accept-Language → Spanish (default). No URL prefixes. */
export default getRequestConfig(async () => {
  const c = (await cookies()).get("kumo_locale")?.value;
  let locale: Locale = "es";
  if (c && (LOCALES as readonly string[]).includes(c)) locale = c as Locale;
  else if (!c && /^en\b/i.test((await headers()).get("accept-language") ?? "")) locale = "en";
  return { locale, messages: (await import(`../messages/${locale}.json`)).default, timeZone: "UTC" };
});
