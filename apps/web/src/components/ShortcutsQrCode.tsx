"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface Props {
  subscriptionId: string;
  subscriptionName: string;
  apiBaseUrl?: string;
}

export function ShortcutsQrCode({
  subscriptionId,
  subscriptionName,
  apiBaseUrl = typeof window !== "undefined" ? window.location.origin : "",
}: Props) {
  const [open, setOpen] = useState(false);

  const qrData = JSON.stringify({
    url: `${apiBaseUrl}/api/usage/daily`,
    subscriptionId,
    subscriptionName,
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
      >
        利用記録を自動化する
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-base font-semibold">
              {subscriptionName} の利用記録を自動化
            </h3>
            <p className="mb-4 text-sm text-zinc-600">
              iPhone のカメラでこの QR コードを読み取り、ショートカットを設定してください。
              設定は1回だけです。以後、アプリを開くたびに自動で記録されます。
            </p>
            <div className="flex justify-center rounded-lg border border-zinc-200 bg-white p-4">
              <QRCodeSVG value={qrData} size={200} />
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  );
}
