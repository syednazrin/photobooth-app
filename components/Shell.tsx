import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { PublicConfig } from "@/lib/config";
import { translate } from "@/lib/i18n";
import { isAdmin } from "@/lib/server/auth";
import { I18nProvider } from "./I18n";
import LogoutButton from "./LogoutButton";

/** Page wrapper: applies the configured colours, language and the top navigation. */
export default async function Shell({
  cfg,
  children,
  nav = true,
  wide = false,
}: {
  cfg: PublicConfig;
  children: ReactNode;
  nav?: boolean;
  wide?: boolean;
}) {
  const admin = await isAdmin();
  const t = (k: Parameters<typeof translate>[1]) => translate(cfg.language, k);
  const style = {
    "--accent": cfg.accent,
    "--bg": cfg.background,
    "--fg": cfg.textColor,
    background: "var(--bg)",
    color: "var(--fg)",
  } as CSSProperties;
  const link = "px-4 py-2 text-sm font-medium bg-[color-mix(in_srgb,var(--bg),white_8%)] hover:bg-[var(--accent)] hover:text-[var(--bg)] transition-colors";

  return (
    <I18nProvider lang={cfg.language}>
      <div style={style} className="min-h-screen flex flex-col">
        {nav && (
          <nav className="flex flex-wrap items-center gap-2 px-5 py-4">
            <Link href="/" className="mr-auto font-[family-name:var(--display)] text-3xl font-bold uppercase leading-none">
              {cfg.title}
            </Link>
            <Link href="/gallery" className={link}>{t("gallery")}</Link>
            <Link href="/couple" className={link}>Couples</Link>
            <Link href="/slideshow" className={link}>{t("slideshow")}</Link>
            <Link href="/effects" className={link}>{t("effects")}</Link>
            <Link href="/manual" className={link}>{t("manual")}</Link>
            <Link href="/admin" className={link}>{t("admin")}</Link>
            {admin && (
              <LogoutButton label={t("loggedOut")} className={link} />
            )}
          </nav>
        )}
        <div className={`flex-1 w-full mx-auto px-5 pb-10 ${wide ? "" : "max-w-5xl"}`}>{children}</div>
      </div>
    </I18nProvider>
  );
}
