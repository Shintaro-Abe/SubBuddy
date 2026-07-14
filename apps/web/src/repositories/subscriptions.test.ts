import { describe, expect, it, vi } from "vitest";
import { deleteSubscription, getSubscription, updateSubscription } from "./subscriptions";

describe("subscription tenant boundary", () => {
  it("別ユーザー所有IDは取得・更新・削除のすべてで見つからない扱い", async () => {
    const db = {
      subscription: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    await expect(
      getSubscription("synthetic_user_a", "subscription_of_user_b", db as never),
    ).resolves.toBeNull();
    await expect(
      updateSubscription(
        "synthetic_user_a",
        "subscription_of_user_b",
        { amount: 1200 },
        db as never,
      ),
    ).resolves.toBeNull();
    await expect(
      deleteSubscription("synthetic_user_a", "subscription_of_user_b", db as never),
    ).resolves.toBe(false);

    expect(db.subscription.findFirst).toHaveBeenCalledWith({
      where: { id: "subscription_of_user_b", userId: "synthetic_user_a" },
    });
    expect(db.subscription.update).not.toHaveBeenCalled();
    expect(db.subscription.delete).not.toHaveBeenCalled();
  });
});
