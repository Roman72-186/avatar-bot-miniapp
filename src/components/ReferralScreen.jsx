import { useState, useEffect } from 'react';
import { getReferralStats } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';

export default function ReferralScreen({ userId, onBack, onInvite }) {
  const { hapticFeedback } = useTelegram();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (userId) {
      getReferralStats(userId)
        .then(data => {
          const s = Array.isArray(data) ? data[0] : data;
          setStats(s);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [userId]);

  const referralLink = `https://t.me/those_are_the_gifts_bot?start=ref_${userId}`;

  const handleCopy = () => {
    hapticFeedback('light');
    navigator.clipboard?.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalRefs = Number(stats?.total_referrals) || 0;
  const paidRefs = Number(stats?.paid_referrals) || 0;
  const totalEarnings = Number(stats?.total_earnings) || 0;
  const currentTier = Math.floor(paidRefs / 5) + 1;
  const nextTierAt = (currentTier) * 5;
  const remaining = nextTierAt - paidRefs;

  let recentRefs = stats?.recent_referrals || [];
  if (typeof recentRefs === 'string') {
    try { recentRefs = JSON.parse(recentRefs); } catch { recentRefs = []; }
  }

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  return (
    <div className="referral-screen">
      <div className="referral-header">
        <button className="history-back-btn" onClick={() => { hapticFeedback('light'); onBack(); }}>
          ←
        </button>
        <h2 className="referral-title">Реферальная программа</h2>
      </div>

      {loading ? (
        <div className="history-loading">Загрузка...</div>
      ) : (
        <>
          <div className="referral-stats-grid">
            <div className="ref-stat-card">
              <div className="ref-stat-value">{totalRefs}</div>
              <div className="ref-stat-label">Приглашено</div>
            </div>
            <div className="ref-stat-card accent">
              <div className="ref-stat-value">{totalEarnings} ⭐</div>
              <div className="ref-stat-label">Заработано</div>
            </div>
            <div className="ref-stat-card">
              <div className="ref-stat-value">{currentTier} ⭐</div>
              <div className="ref-stat-label">За реферала</div>
            </div>
          </div>

          <div className="referral-info-card">
            <h3>Как это работает</h3>
            <p className="ref-info-desc">
              Приглашайте друзей — когда они впервые пополняют баланс, вы получаете звёзды!
            </p>
            <div className="tier-table">
              {[
                ['1–5 рефералов', '+1 ⭐'],
                ['6–10 рефералов', '+2 ⭐'],
                ['11–15 рефералов', '+3 ⭐'],
                ['16–20 рефералов', '+4 ⭐'],
              ].map(([range, reward], i) => (
                <div
                  key={i}
                  className={`tier-row ${paidRefs >= (i * 5 + 1) && paidRefs <= ((i + 1) * 5) ? 'active' : ''}`}
                >
                  <span>{range}</span>
                  <span className="tier-reward">{reward}</span>
                </div>
              ))}
              <div className="tier-row hint">
                <span>и так далее...</span>
                <span className="tier-reward">+1 ⭐ каждые 5</span>
              </div>
            </div>
            {remaining > 0 && paidRefs > 0 && (
              <p className="tier-progress">
                До следующего уровня: ещё {remaining} оплативших
              </p>
            )}
          </div>

          {recentRefs.length > 0 && (
            <div className="referral-list-section">
              <h3>Последние рефералы <span className="ref-count-badge">{totalRefs}</span></h3>
              <div className="referral-list">
                {recentRefs.map((ref, idx) => (
                  <div key={ref.id || idx} className="ref-item">
                    <span className="ref-item-icon">{ref.paid ? '⭐' : '👤'}</span>
                    <div className="ref-item-info">
                      <span className="ref-item-name">
                        {ref.username ? `@${ref.username}` : `ID: ${String(ref.id).slice(-6)}`}
                      </span>
                      <span className="ref-item-date">{formatDate(ref.created_at)}</span>
                    </div>
                    <span className={`ref-item-status ${ref.paid ? 'paid' : ''}`}>
                      {ref.paid ? 'Оплатил' : 'Перешёл'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="referral-link-section">
            <label className="ref-link-label">Ваша реферальная ссылка:</label>
            <div className="referral-link-box" onClick={handleCopy}>
              <span className="referral-link-text">{referralLink}</span>
              <span className="referral-copy-btn">{copied ? '✓ Скопировано' : '📋 Копировать'}</span>
            </div>
          </div>

          <button className="referral-invite-btn" onClick={() => { hapticFeedback('medium'); onInvite(); }}>
            🎁 Пригласить друга
          </button>
        </>
      )}
    </div>
  );
}
