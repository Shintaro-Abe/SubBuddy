"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PRIMARY_NAV = [
  { href: "/", label: "ホーム", icon: "home" },
  { href: "/subscriptions", label: "契約", icon: "contracts" },
  { href: "/recommendations", label: "見直し", icon: "review" },
] as const;

const SECONDARY_NAV = [
  { href: "/spending", label: "支出の内訳" },
  { href: "/renewals", label: "更新間近" },
  { href: "/getting-started", label: "使い方" },
  { href: "/settings", label: "設定" },
] as const;

function isFormPath(pathname: string): boolean {
  return pathname === "/subscriptions/new" || /^\/subscriptions\/[^/]+\/edit$/.test(pathname);
}

function primarySection(pathname: string): (typeof PRIMARY_NAV)[number]["href"] | null {
  if (pathname.startsWith("/subscriptions")) return "/subscriptions";
  if (pathname.startsWith("/recommendations")) return "/recommendations";
  if (pathname === "/") return "/";
  return null;
}

function formBackHref(pathname: string): string {
  const editMatch = pathname.match(/^\/subscriptions\/([^/]+)\/edit$/);
  return editMatch ? `/subscriptions/${editMatch[1]}` : "/subscriptions";
}

function NavIcon({ name }: { name: (typeof PRIMARY_NAV)[number]["icon"] }) {
  if (name === "home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 10.5 12 3l9 7.5M5.5 9.5V21h13V9.5" />
      </svg>
    );
  }
  if (name === "contracts") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M8 11h8M8 15h5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 18V9M10 18V5M16 18v-7M22 18V3" />
    </svg>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();
  const form = isFormPath(pathname);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = sheetRef.current?.querySelector<HTMLElement>("a, button");
    first?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !sheetRef.current) return;
      const focusable = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
      );
      if (focusable.length === 0) return;
      const firstItem = focusable[0];
      const lastItem = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <header className="mobile-topbar">
        {form ? (
          <Link
            href={formBackHref(pathname)}
            className="mobile-icon-button"
            aria-label="前の画面へ戻る"
          >
            <span aria-hidden="true">←</span>
          </Link>
        ) : (
          <Link href="/" className="mobile-brand">
            SubBuddy
          </Link>
        )}
        {form ? <span className="mobile-topbar-title">契約</span> : <span />}
        {form ? (
          <span aria-hidden="true" />
        ) : (
          <button
            ref={triggerRef}
            type="button"
            className="mobile-more-button"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <span aria-hidden="true">•••</span>
            <span>その他</span>
          </button>
        )}
      </header>

      {!form && (
        <nav className="mobile-bottom-nav" aria-label="主な画面">
          {PRIMARY_NAV.map((item) => {
            const active = primarySection(pathname) === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mobile-bottom-link${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {open && (
        <div className="mobile-sheet-backdrop" onMouseDown={() => setOpen(false)}>
          <div
            ref={sheetRef}
            className="mobile-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-more-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mobile-sheet-heading">
              <h2 id="mobile-more-title" className="title">
                その他
              </h2>
              <button type="button" className="mobile-sheet-close" onClick={() => setOpen(false)}>
                閉じる
              </button>
            </div>
            <nav aria-label="その他の画面" className="mobile-sheet-links">
              {SECONDARY_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={pathname.startsWith(item.href) ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  <span>{item.label}</span>
                  <span aria-hidden="true">›</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
