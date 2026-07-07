-- iOS 端末側で生成・Keychain 保存する UUID。
-- 同じ Apple user の同じ端末登録を 1 レコードへ収束させる（D3）。
ALTER TABLE "devices" ADD COLUMN "client_device_id" TEXT;

CREATE UNIQUE INDEX "devices_user_id_client_device_id_key"
  ON "devices"("user_id", "client_device_id");
