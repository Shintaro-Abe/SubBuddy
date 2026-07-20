"use client";

import { useEffect, useState } from "react";

const VERSION = "1";

export function ScreenIntro({
  screen,
  children,
}: {
  screen: "subscriptions" | "spending" | "review" | "renewals";
  children: React.ReactNode;
}) {
  const storageKey = `subbuddy-screen-intro:${screen}:${VERSION}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(window.localStorage.getItem(storageKey) !== "seen");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  function dismiss() {
    window.localStorage.setItem(storageKey, "seen");
    setVisible(false);
  }

  return visible ? (
    <aside className="panel mt-4" aria-label="この画面について">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="title text-base">この画面について</p>
          <div className="body mt-1">{children}</div>
        </div>
        <button type="button" className="btn ghost shrink-0" onClick={dismiss}>
          閉じる
        </button>
      </div>
    </aside>
  ) : (
    <button
      type="button"
      className="mt-3 text-sm text-[var(--sage)] underline"
      onClick={() => setVisible(true)}
    >
      この画面について
    </button>
  );
}
