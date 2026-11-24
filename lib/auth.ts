import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import * as schema from "@/db/schema";
import { emailEnabled, layout, sendMail } from "@/lib/email";

const baseURL = process.env.BETTER_AUTH_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? undefined : "dev-only-secret-change-me-dev-only-secret"),
  database: drizzleAdapter(db, { provider: "pg", schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification } }),
  user: { additionalFields: { locale: { type: "string", required: false, defaultValue: "es", input: true }, timezone: { type: "string", required: false, input: true } } },
  emailAndPassword: {
    enabled: true, autoSignIn: true, minPasswordLength: 8, maxPasswordLength: 128, resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      // Always keep the link for the admin route; also email it when a provider exists.
      await db.insert(schema.authOutbox).values({ email: user.email.toLowerCase(), url });
      if (emailEnabled()) await sendMail({ to: user.email, subject: "Restablece tu contraseña de Kumo", ...layout({ title: "Nueva contraseña", body: "Toca el botón para elegir una contraseña nueva. El enlace vence en 1 hora.", cta: { label: "Elegir contraseña", url } }) });
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  rateLimit: { enabled: true, window: 60, max: 30, customRules: { "/request-password-reset": { window: 60, max: 3 }, "/sign-in/magic-link": { window: 60, max: 5 }, "/sign-in/email": { window: 60, max: 10 }, "/sign-up/email": { window: 60, max: 5 } } },
  trustedOrigins: [baseURL, ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : [])],
  plugins: [
    ...(emailEnabled() || process.env.NODE_ENV !== "production" ? [magicLink({
      expiresIn: 60 * 15,
      sendMagicLink: async ({ email, url }) => {
        const m = layout({
          title: "Tu enlace para entrar",
          body: "Toca el botón para entrar a Kumo. El enlace vence en 15 minutos y solo funciona una vez.",
          cta: { label: "Entrar a Kumo", url },
          footer: "Si no pediste este correo, puedes ignorarlo.",
        });
        await sendMail({ to: email, subject: "Tu enlace para entrar a Kumo", ...m });
      },
    })] : []),
    nextCookies(),
  ],
});
export type Session = typeof auth.$Infer.Session;
