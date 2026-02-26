export default function ResolutionSelector({ selectedResolution, onResolutionSelect, starCostFn }) {
  const options = [
    { value: '2K', label: '2K', desc: 'Стандарт' },
    { value: '4K', label: '4K', desc: 'Высокое' },
  ];

  return (
    <div className="duration-selector">
      <div className="duration-label">Разрешение</div>
      <div className="duration-options">
        {options.map((o) => (
          <button
            key={o.value}
            className={`duration-option ${selectedResolution === o.value ? 'selected' : ''}`}
            onClick={() => onResolutionSelect(o.value)}
          >
            {o.label}
            <span className="duration-desc">{o.desc}</span>
            <span className="duration-cost">{starCostFn(o.value)} ⭐</span>
          </button>
        ))}
      </div>
      <div className="duration-hint">Генерация может занять несколько минут</div>
    </div>
  );
}
