import { STARS_PER_GENERATION } from '../utils/styles';

export default function GenerateButton({ canGenerate, freeLeft, starBalance, isLoading, onClick, onTopUp }) {
  const hasFree = freeLeft > 0;
  const hasStars = starBalance >= STARS_PER_GENERATION;
  const canAfford = hasFree || hasStars;

  return (
    <div className="generate-section">
      <button
        className={`generate-btn ${!canGenerate || isLoading || !canAfford ? 'disabled' : ''}`}
        onClick={onClick}
        disabled={!canGenerate || isLoading || !canAfford}
      >
        {isLoading ? (
          <span className="btn-loading">
            <span className="spinner"></span>
            Генерирую...
          </span>
        ) : (
          <span>✨ Создать аватарку</span>
        )}
      </button>

      <div className="balance-info">
        {freeLeft !== null && (
          <div className="limits-info">
            {hasFree ? (
              <span>Бесплатных: <strong>{freeLeft}</strong> на сегодня</span>
            ) : (
              <span>Бесплатные генерации закончились</span>
            )}
          </div>
        )}
        <div className="star-balance">
          ⭐ Баланс: <strong>{starBalance || 0}</strong>
          {!hasFree && <span className="cost-hint"> ({STARS_PER_GENERATION} ⭐ за генерацию)</span>}
        </div>
      </div>

      {!canAfford && (
        <button className="topup-btn" onClick={onTopUp}>
          ⭐ Пополнить баланс
        </button>
      )}
    </div>
  );
}
