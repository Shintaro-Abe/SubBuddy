"use client";

import { useState } from "react";
import { authenticatedFetch } from "@/lib/client-api";

export function LogoutButton() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await authenticatedFetch("/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("logout failed");
      window.location.assign("/sign-in");
    } catch {
      setError("ログアウトできませんでした。通信状態を確認して、もう一度お試しください。");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-4">
      <button className="btn ghost" type="button" disabled={isSubmitting} onClick={logout}>
        {isSubmitting ? "ログアウトしています…" : "ログアウト"}
      </button>
      {error ? (
        <p className="caption mt-2" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
