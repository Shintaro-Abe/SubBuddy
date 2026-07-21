import { AppleSignIn } from "@/components/AppleSignIn";

export default function SignInPage() {
  return (
    <main className="min-h-screen grid place-items-center px-6">
      <section className="sign-in-panel w-full max-w-sm border border-hair bg-card p-8 rounded-lg">
        <h1 className="brand mb-2">SubBuddy</h1>
        <p className="body mt-0 mb-8 text-muted">サブスクリプションを確認する</p>
        <div className="grid gap-4">
          <AppleSignIn />
        </div>
      </section>
    </main>
  );
}
