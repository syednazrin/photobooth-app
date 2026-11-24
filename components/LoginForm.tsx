"use client";

import { useState } from "react";
import { useT } from "./I18n";

export default function LoginForm({ next, warnDefault }: { next: string; warnDefault: boolean }) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    if (res?.ok) {
      window.location.href = next;
      return;
    }
    const data = await res?.json().catch(() => ({}));
    setError(data?.error || t("wrongPassword"));
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-16 max-w-sm flex flex-col gap-4">
      <h1 className="text-3xl font-extralight tracking-widest">{t("login")}</h1>
      <label className="flex flex-col gap-1">
        <span className="text-sm opacity-70">{t("password")}</span>
        <input
          type="password"
          autoFocus
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="px-4 py-2 rounded-lg bg-white/10 border border-white/30"
        />
      </label>
      {error && <p role="alert" className="text-red-300">{error}</p>}
      {warnDefault && (
        <p className="text-sm text-amber-300">
          First run: the default password is <code>photobooth</code>. Change it in the admin panel, or set the ADMIN_PASSWORD
          environment variable.
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="px-6 py-3 rounded-none bg-[var(--accent)] text-black font-medium disabled:opacity-50"
      >
        {t("login")}
      </button>
    </form>
  );
}
