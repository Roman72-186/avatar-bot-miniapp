-- ============================================================
-- Avatar Bot: Error Logs & Monitoring Tables
-- ============================================================

-- 1. Main error_logs table
CREATE TABLE IF NOT EXISTS error_logs (
    id              SERIAL PRIMARY KEY,
    error_id        UUID DEFAULT gen_random_uuid() UNIQUE,
    severity        VARCHAR(20) NOT NULL DEFAULT 'info',
    category        VARCHAR(50) NOT NULL DEFAULT 'unknown',
    source_workflow VARCHAR(100),
    source_endpoint VARCHAR(100),
    source_node     VARCHAR(200),
    user_id         BIGINT,
    error_message   TEXT NOT NULL,
    error_stack     TEXT,
    error_code      VARCHAR(50),
    request_data    JSONB,
    response_data   JSONB,
    is_resolved     BOOLEAN DEFAULT FALSE,
    resolved_at     TIMESTAMP,
    resolved_by     VARCHAR(100),
    resolution_note TEXT,
    telegram_sent   BOOLEAN DEFAULT FALSE,
    telegram_sent_at TIMESTAMP,
    reminder_sent   BOOLEAN DEFAULT FALSE,
    reminder_sent_at TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(category);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_unresolved ON error_logs(is_resolved) WHERE is_resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_error_logs_source_endpoint ON error_logs(source_endpoint);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_id ON error_logs(error_id);

-- 2. Rate limiting tracking
CREATE TABLE IF NOT EXISTS request_rate_log (
    id          SERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL,
    endpoint    VARCHAR(100) NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_log_user_endpoint ON request_rate_log(user_id, endpoint, created_at DESC);

-- 3. Health check results
CREATE TABLE IF NOT EXISTS health_checks (
    id              SERIAL PRIMARY KEY,
    check_type      VARCHAR(50) NOT NULL,
    status          VARCHAR(20) NOT NULL,
    details         JSONB,
    checked_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_checks_type ON health_checks(check_type, checked_at DESC);

-- 4. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_error_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_error_logs_updated_at ON error_logs;
CREATE TRIGGER trg_error_logs_updated_at
    BEFORE UPDATE ON error_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_error_logs_updated_at();

-- 5. Summary views
CREATE OR REPLACE VIEW v_error_summary_last_hour AS
SELECT
    severity,
    category,
    source_endpoint,
    COUNT(*) as error_count,
    MAX(created_at) as last_occurrence
FROM error_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY severity, category, source_endpoint
ORDER BY error_count DESC;

CREATE OR REPLACE VIEW v_error_summary_today AS
SELECT
    severity,
    category,
    COUNT(*) as error_count,
    COUNT(*) FILTER (WHERE is_resolved = FALSE) as unresolved_count
FROM error_logs
WHERE created_at > CURRENT_DATE
GROUP BY severity, category
ORDER BY
    CASE severity
        WHEN 'critical' THEN 1
        WHEN 'warning' THEN 2
        ELSE 3
    END;
