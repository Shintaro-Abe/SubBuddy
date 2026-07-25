import { expect, test } from "@playwright/test";

test("Webセッション上限では解除方法を表示する", async ({ page }) => {
  const state = "synthetic-state-with-at-least-32-characters";
  const nonce = "synthetic-nonce-with-at-least-32-characters";

  await page.route("https://appleid.cdn-apple.com/**", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: `
        window.AppleID = {
          auth: {
            init: function () {},
            signIn: async function () {
              return { authorization: { id_token: "synthetic.identity.token", state: "${state}" } };
            }
          }
        };
      `,
    });
  });
  await page.route("**/api/auth/apple/config", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        clientId: "com.subbuddy.web",
        redirectUri: "https://subbuddy.example/sign-in",
      }),
    });
  });
  await page.route("**/api/auth/apple/start", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ state, nonce }),
    });
  });
  await page.route("**/api/auth/apple/callback", async (route) => {
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "session limit reached" }),
    });
  });

  await page.goto("/sign-in");
  const signIn = page.getByRole("button", { name: "Appleでサインイン" });
  await expect(signIn).toBeEnabled();
  await signIn.click();

  await expect(page.getByRole("alert")).toContainText("Webブラウザのログインが10件");
  await expect(page.getByRole("alert")).toContainText("端末とセッション");
});
