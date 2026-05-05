export default function GenerateButton({
  canGenerate,
  isLoading,
  onClick,
  buttonLabel,
}) {
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
          <span>{buttonLabel || 'Создать визуализацию'}</span>
        )}
      </button>
    </div>
  );
}
