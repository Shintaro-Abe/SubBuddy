"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { refreshBrowserSession } from "@/lib/client-api";

type AppleAuthorization = {
  authorization: { id_token: string; state?: string };
};

type AppleAuth = {
  init(options: {
    clientId: string;
    scope: string;
    redirectURI: string;
    state: string;
    nonce: string;
    usePopup: boolean;
  }): void;
  signIn(): Promise<AppleAuthorization>;
};

declare global {
  interface Window {
    AppleID?: { auth: AppleAuth };
  }
}

export function AppleSignIn() {
  const router = useRouter();
  const [rememberBrowser, setRememberBrowser] = useState(false);
  const [working, setWorking] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshBrowserSession().then((refreshed) => {
      if (refreshed) {
        router.replace("/");
        router.refresh();
      }
    });
  }, [router]);

  async function signIn() {
    if (!window.AppleID) {
      setError("Appleサインインを読み込めませんでした。再読み込みしてください。");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const [configResponse, startResponse] = await Promise.all([
        fetch("/api/auth/apple/config"),
        fetch("/api/auth/apple/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rememberBrowser }),
        }),
      ]);
      if (!configResponse.ok || !startResponse.ok) throw new Error();
      const config = (await configResponse.json()) as {
        clientId: string;
        redirectUri: string;
      };
      const flow = (await startResponse.json()) as { state: string; nonce: string };

      window.AppleID.auth.init({
        clientId: config.clientId,
        scope: "name email",
        redirectURI: config.redirectUri,
        state: flow.state,
        nonce: flow.nonce,
        usePopup: true,
      });
      const apple = await window.AppleID.auth.signIn();
      if (apple.authorization.state && apple.authorization.state !== flow.state) throw new Error();
      const callback = await fetch("/api/auth/apple/callback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identityToken: apple.authorization.id_token,
          state: flow.state,
          nonce: flow.nonce,
        }),
      });
      if (!callback.ok) throw new Error();
      router.replace("/");
      router.refresh();
    } catch {
      setError("Appleでサインインできませんでした。時間をおいて再度お試しください。");
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <Script
        src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/ja_JP/appleid.auth.js"
        onLoad={() => setScriptReady(true)}
      />
      <label className="flex items-center gap-3 text-sm text-muted">
        <input
          type="checkbox"
          checked={rememberBrowser}
          onChange={(event) => setRememberBrowser(event.target.checked)}
        />
        このブラウザでログイン状態を保持する
      </label>
      <button
        type="button"
        className="btn block"
        onClick={signIn}
        disabled={working || !scriptReady}
      >
        {working ? "サインイン中" : "Appleでサインイン"}
      </button>
      {error ? (
        <p className="text-sm text-red" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
