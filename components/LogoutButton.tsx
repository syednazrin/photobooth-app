"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton({ label, className }: { label: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await fetch("/api/login", { method: "DELETE" });
        router.push("/");
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
