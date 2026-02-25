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
      {examplesUrl && (
        <button className="prompt-examples-link" onClick={handleExamples} type="button">
          Примеры промптов &rarr;
        </button>
      )}
    </div>
  );
}
