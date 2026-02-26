-- ============================================================
-- Avatar Bot: Core Database Schema
-- Auto-executed on first Docker Compose up via initdb.d
-- ============================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id              BIGINT PRIMARY KEY,             -- Telegram user_id
    username        VARCHAR(255),
    first_name      VARCHAR(255),
    last_name       VARCHAR(255),
    language_code   VARCHAR(10),
    star_balance    INT NOT NULL DEFAULT 0,
    free_stylize    INT NOT NULL DEFAULT 1,         -- daily free generations
    free_remove_bg  INT NOT NULL DEFAULT 1,
    free_enhance    INT NOT NULL DEFAULT 1,
    referred_by     VARCHAR(255),                   -- referrer user_id as string
    ref_earnings    INT NOT NULL DEFAULT 0,         -- total referral earnings
    parent_l1       BIGINT,                         -- 5-level referral chain
    parent_l2       BIGINT,
    parent_l3       BIGINT,
    parent_l4       BIGINT,
    parent_l5       BIGINT,
    blocked         BOOLEAN NOT NULL DEFAULT FALSE,
    is_admin        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Generations table
CREATE TABLE IF NOT EXISTS generations (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    mode            VARCHAR(50) NOT NULL,           -- stylize, multi_photo, etc.
    prompt          TEXT,
    style           VARCHAR(100),
    result_url      TEXT,                           -- S3 URL of result
    result_type     VARCHAR(20) DEFAULT 'image',    -- image or video
    stars_spent     INT NOT NULL DEFAULT 0,
    duration_sec    INT,                            -- for video modes
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generations_user ON generations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_mode ON generations(mode);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    telegram_charge_id VARCHAR(255),
    provider_charge_id VARCHAR(255),
    stars           INT NOT NULL,
    bonus           INT NOT NULL DEFAULT 0,
    total_credited  INT NOT NULL,
    status          VARCHAR(20) DEFAULT 'completed',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id, created_at DESC);

-- User topics (for photosession themes, etc.)
CREATE TABLE IF NOT EXISTS user_topics (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    topic           VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_topics_user ON user_topics(user_id);

-- Auto-update updated_at trigger for users
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();

-- Daily free generation reset function (call via n8n cron or pg_cron)
CREATE OR REPLACE FUNCTION reset_daily_free_generations()
RETURNS void AS $$
BEGIN
    UPDATE users SET
        free_stylize = 1,
        free_remove_bg = 1,
        free_enhance = 1;
END;
$$ LANGUAGE plpgsql;
