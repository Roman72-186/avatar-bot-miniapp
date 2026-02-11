const DURATIONS = [
  { value: '6', label: '6 \u0441\u0435\u043a', cost: 25 },
  { value: '10', label: '10 \u0441\u0435\u043a', cost: 50 },
];

export default function DurationSelector({ selectedDuration, onDurationSelect }) {
  return (
    <div className="duration-selector">
      <div className="duration-label">Длительность видео</div>
      <div className="duration-options">
        {DURATIONS.map((d) => (
          <button
            key={d.value}
            className={`duration-option ${selectedDuration === d.value ? 'selected' : ''}`}
            onClick={() => onDurationSelect(d.value)}
          >
            {d.label}
            <span className="duration-cost">{d.cost} ⭐</span>
          </button>
        ))}
      </div>
    </div>
  );
}
