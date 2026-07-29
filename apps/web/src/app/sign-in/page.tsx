import Image from "next/image";
import { AppleSignIn } from "@/components/AppleSignIn";

export default function SignInPage() {
  return (
    <main className="min-h-screen grid place-items-center px-6">
      <section className="sign-in-panel w-full max-w-sm border border-hair bg-card p-8 rounded-lg">
        <div className="sign-in-brand-visual" aria-hidden="true">
          <Image
            src="/brand/mudask-mascot.png"
            alt=""
            width={168}
            height={168}
            className="sign-in-mascot"
            priority
          />
        </div>
        <h1 className="sign-in-brand" aria-label="MUDASK">
          <Image
            src="/brand/mudask-wordmark.svg"
            alt=""
            width={210}
            height={51}
            className="sign-in-brand-logo"
            priority
          />
        </h1>
        <p className="body mt-0 mb-8 text-muted">サブスクリプションを確認する</p>
        <div className="grid gap-4">
          <AppleSignIn />
        </div>
      </section>
    </main>
  );
}
