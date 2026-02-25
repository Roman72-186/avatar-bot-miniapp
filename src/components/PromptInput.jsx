export default function PromptInput({ value, onChange, placeholder, maxLength = 500, examplesUrl }) {
  const handleExamples = () => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.openLink(examplesUrl);
    } else {
      window.open(examplesUrl, '_blank');
    }
  };

  return (
    <div className="prompt-input-container">
      <div className="prompt-input-label">Промпт</div>
      <div className="prompt-input-wrap">
        {examplesUrl && (
          <button
            className="prompt-examples-btn"
            onClick={handleExamples}
            aria-label="Примеры промптов"
            type="button"
          >
            <span className="prompt-examples-icon">&#x1F4A1;</span>
          </button>
        )}
        <textarea
          className="prompt-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          placeholder={placeholder || 'Опишите, что хотите получить...'}
          maxLength={maxLength}
        />
        <div className="prompt-char-count">
          {value.length} / {maxLength}
        </div>
      </div>
    </div>
  );
}
