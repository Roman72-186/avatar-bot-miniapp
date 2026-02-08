export default function GenerateButton({ canGenerate, freeLeft, isLoading, onClick }) {
  return (
    <div className="generate-section">
      <button
        className={`generate-btn ${!canGenerate || isLoading ? 'disabled' : ''}`}
        onClick={onClick}
        disabled={!canGenerate || isLoading}
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
      {freeLeft !== null && (
        <div className="limits-info">
          {freeLeft > 0 ? (
            <span>Бесплатных осталось: <strong>{freeLeft}</strong> на сегодня</span>
          ) : (
            <span>Бесплатные генерации закончились. <strong>1 ⭐</strong> за генерацию</span>
          )}
        </div>
      )}
    </div>
  );
}
