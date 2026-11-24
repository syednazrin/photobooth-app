"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import type { Lang } from "@/lib/config";
import { translate, type TKey } from "@/lib/i18n";

const Ctx = createContext<Lang>("en");

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

export function useT() {
  const lang = useContext(Ctx);
  return useCallback((key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
}
