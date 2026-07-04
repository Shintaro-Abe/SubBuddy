-- Apple サインインの stable identifier は平文保存せず、アプリ内の照合用ハッシュとして保持する。
ALTER TABLE "users" ADD COLUMN "apple_subject_hash" TEXT;
ALTER TABLE "users" ADD COLUMN "last_signed_in_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_apple_subject_hash_key" ON "users"("apple_subject_hash");
