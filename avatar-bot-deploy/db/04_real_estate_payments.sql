-- ============================================================
-- Real Estate Mini App: working MVP compatibility migration
-- Safe to run repeatedly.
-- ============================================================

-- Existing bot workflows use payments_log for Telegram Stars receipts.
CREATE TABLE IF NOT EXISTS payments_log (
    id              BIGSERIAL PRIMARY KEY,
    charge_id       VARCHAR(255) UNIQUE,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    stars           INT NOT NULL DEFAULT 0,
    bonus           INT NOT NULL DEFAULT 0,
    total_credited  INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payments_log ADD COLUMN IF NOT EXISTS bonus INT NOT NULL DEFAULT 0;
ALTER TABLE payments_log ADD COLUMN IF NOT EXISTS total_credited INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_payments_log_user ON payments_log(user_id, created_at DESC);

-- New history/result screens can read package fields from metadata.
ALTER TABLE generations ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_generations_metadata_gin
    ON generations USING GIN (metadata);
