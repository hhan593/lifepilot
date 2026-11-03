-- PushSubscription 是唯一缺 userId 索引的用户子表：推送扫描按 userId findMany，避免全表扫描
-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");
