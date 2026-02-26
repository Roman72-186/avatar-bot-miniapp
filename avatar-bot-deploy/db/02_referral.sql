-- ============================================================
-- Avatar Bot: 5-Level Referral Commission System
-- ============================================================

-- Referral commissions log
CREATE TABLE IF NOT EXISTS referral_commissions (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL,
    parent_id   BIGINT NOT NULL,
    level       SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 5),
    stars_spent INT NOT NULL,
    commission  INT NOT NULL CHECK (commission >= 1),
    mode        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rc_parent ON referral_commissions(parent_id);
CREATE INDEX IF NOT EXISTS idx_rc_created ON referral_commissions(created_at);

-- PL/pgSQL function: apply_referral_commission
-- Called after each paid generation to distribute commissions up the chain
-- Rates: L1=7%, L2=3%, L3=2%, L4=1%, L5=0.5%
CREATE OR REPLACE FUNCTION apply_referral_commission(
    p_user_id BIGINT,
    p_stars_spent INT,
    p_mode TEXT
) RETURNS TABLE(parent_id BIGINT, level INT, commission INT)
LANGUAGE plpgsql AS $$
DECLARE
    v_parents RECORD;
    v_rates NUMERIC[] := ARRAY[0.07, 0.03, 0.02, 0.01, 0.005];
    v_parent BIGINT;
    v_commission INT;
    v_level INT;
BEGIN
    -- Free generation -> no commission
    IF p_stars_spent <= 0 THEN
        RETURN;
    END IF;

    -- Read parent chain in one query
    SELECT parent_l1, parent_l2, parent_l3, parent_l4, parent_l5
    INTO v_parents
    FROM users WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    FOR v_level IN 1..5 LOOP
        v_parent := CASE v_level
            WHEN 1 THEN v_parents.parent_l1
            WHEN 2 THEN v_parents.parent_l2
            WHEN 3 THEN v_parents.parent_l3
            WHEN 4 THEN v_parents.parent_l4
            WHEN 5 THEN v_parents.parent_l5
        END;

        -- No parent at this level -> skip
        IF v_parent IS NULL THEN
            CONTINUE;
        END IF;

        -- L1: CEIL (guaranteed min 1 Star)
        -- L2-L5: FLOOR (skip if < 1)
        IF v_level = 1 THEN
            v_commission := CEIL(p_stars_spent * v_rates[v_level]);
            IF v_commission < 1 THEN
                v_commission := 1;
            END IF;
        ELSE
            v_commission := FLOOR(p_stars_spent * v_rates[v_level]);
            IF v_commission < 1 THEN
                CONTINUE;
            END IF;
        END IF;

        -- Credit parent
        UPDATE users SET
            star_balance = COALESCE(star_balance, 0) + v_commission,
            ref_earnings = COALESCE(ref_earnings, 0) + v_commission
        WHERE id = v_parent;

        -- Log commission
        INSERT INTO referral_commissions (user_id, parent_id, level, stars_spent, commission, mode)
        VALUES (p_user_id, v_parent, v_level, p_stars_spent, v_commission, p_mode);

        -- Return row
        parent_id := v_parent;
        level := v_level;
        commission := v_commission;
        RETURN NEXT;
    END LOOP;
END;
$$;
