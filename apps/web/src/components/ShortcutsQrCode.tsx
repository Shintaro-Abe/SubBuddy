"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface Props {
  subscriptionId: string;
  subscriptionName: string;
  /** 利用量同期 API の事前共有トークン。ショートカットが Authorization ヘッダで送る値（architecture §8.1.1）。 */
  usageSyncToken?: string | null;
  apiBaseUrl?: string;
}

export function ShortcutsQrCode({
  subscriptionId,
  subscriptionName,
  usageSyncToken = null,
  apiBaseUrl = typeof window !== "undefined" ? window.location.origin : "",
}: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  const qrData = JSON.stringify({
    url: `${apiBaseUrl}/api/usage/daily`,
    subscriptionId,
    subscriptionName,
    ...(usageSyncToken ? { token: usageSyncToken } : {}),
  });

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)} className="btn ghost">
        利用記録を自動化する
      </button>

      {open && (
        <div className="modal-shell fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="modal-panel panel w-full max-w-sm shadow-xl" role="dialog" aria-modal="true">
            <p className="title" style={{ marginBottom: 8 }}>
              {subscriptionName} の利用記録を自動化
            </p>
            <p className="body" style={{ marginBottom: 16 }}>
              iPhone のカメラでこの QR コードを読み取り、ショートカットを設定してください。
              設定は1回だけです。以後、アプリを開くたびに自動で記録されます。
            </p>
            <div
              className="flex justify-center"
              style={{
                border: "1px solid var(--hair)",
                borderRadius: 12,
                background: "#fff",
                padding: 16,
              }}
            >
              <QRCodeSVG value={qrData} size={200} />
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              className="btn block"
              style={{ marginTop: 16 }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  );
}
