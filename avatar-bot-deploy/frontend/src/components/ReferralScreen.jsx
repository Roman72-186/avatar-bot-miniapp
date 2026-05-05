import { useState, useEffect } from 'react';
import { getReferralStats } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';

const LEVELS = [
  { level: 1, rate: '7%' },
  { level: 2, rate: '3%' },
  { level: 3, rate: '2%' },
  { level: 4, rate: '1%' },
  { level: 5, rate: '0.5%' },
];

export default function ReferralScreen({ userId, initData, onBack, onInvite }) {
  const { hapticFeedback } = useTelegram();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (userId) {
      getReferralStats(userId, initData)
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

  const botUsername = import.meta.env.VITE_BOT_USERNAME || 'those_are_the_gifts_bot';
  const referralLink = `https://t.me/${botUsername}?start=ref_${userId}`;

  const handleCopy = () => {
    hapticFeedback('light');
    navigator.clipboard?.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalPartners = Number(stats?.total_partners) || 0;
  const totalEarnings = Number(stats?.total_earnings) || 0;
  const structureTurnover = Number(stats?.structure_turnover) || 0;

  const levelData = LEVELS.map(({ level, rate }) => ({
    level,
    rate,
    count: Number(stats?.[`l${level}_count`]) || 0,
    earnings: Number(stats?.[`l${level}_earnings`]) || 0,
  }));

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
        <h2 className="referral-title">Партнёрская программа</h2>
      </div>

      {loading ? (
        <div className="history-loading">Загрузка...</div>
      ) : (
        <>
          {/* Top 3 stat cards */}
          <div className="referral-stats-grid">
            <div className="ref-stat-card">
              <div className="ref-stat-value">{totalPartners}</div>
              <div className="ref-stat-label">Партнёры</div>
            </div>
            <div className="ref-stat-card accent">
              <div className="ref-stat-value">{totalEarnings}</div>
              <div className="ref-stat-label">Заработано кредитов</div>
            </div>
            <div className="ref-stat-card">
              <div className="ref-stat-value">{structureTurnover}</div>
              <div className="ref-stat-label">Оборот кредитов</div>
            </div>
          </div>

          {/* Commission rates table */}
          <div className="referral-info-card">
            <h3>Ставки комиссий</h3>
            <p className="ref-info-desc">
              Вы получаете процент от каждой платной траты кредитов вашими партнёрами — до 5 уровней глубины.
            </p>
            <div className="tier-table">
              {LEVELS.map(({ level, rate }) => (
                <div key={level} className="tier-row">
                  <span className="tier-level-label">
                    <span className={`ref-level-badge l${level}`}>L{level}</span>
                    Уровень {level}
                  </span>
                  <span className="tier-reward">{rate}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Level breakdown */}
          {totalPartners > 0 && (
            <div className="referral-info-card">
              <h3>Структура по уровням</h3>
              <div className="ref-level-breakdown">
                {levelData.map(({ level, count, earnings }) => (
                  <div key={level} className={`ref-level-row ${count > 0 ? 'has-data' : ''}`}>
                    <span className={`ref-level-badge l${level}`}>L{level}</span>
                    <span className="ref-level-count">{count} партн.</span>
                    <span className="ref-level-earnings">+{earnings}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent referrals */}
          {recentRefs.length > 0 && (
            <div className="referral-list-section">
              <h3>Последние партнёры <span className="ref-count-badge">{totalPartners}</span></h3>
              <div className="referral-list">
                {recentRefs.map((ref, idx) => (
                  <div key={ref.id || idx} className="ref-item">
                    <span className={`ref-level-badge l${ref.level || 1}`}>L{ref.level || 1}</span>
                    <div className="ref-item-info">
                      <span className="ref-item-name">
                        {ref.username ? `@${ref.username}` : `ID: ${String(ref.id).slice(-6)}`}
                      </span>
                      <span className="ref-item-date">{formatDate(ref.created_at)}</span>
                    </div>
                    <span className={`ref-item-status ${ref.active ? 'paid' : ''}`}>
                      {ref.active ? 'Активен' : 'Новый'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Referral link */}
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
