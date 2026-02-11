const DURATIONS = [
  { value: '6', label: '6 \u0441\u0435\u043a', cost: 25 },
  { value: '10', label: '10 \u0441\u0435\u043a', cost: 50 },
];

export default function DurationSelector({ selectedDuration, onDurationSelect }) {
  return (
    <div className="duration-selector">
      <div className="duration-label">\u0414\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c \u0432\u0438\u0434\u0435\u043e</div>
      <div className="duration-options">
        {DURATIONS.map((d) => (
          <button
            key={d.value}
            className={`duration-option ${selectedDuration === d.value ? 'selected' : ''}`}
            onClick={() => onDurationSelect(d.value)}
          >
            {d.label}
            <span className="duration-cost">{d.cost} \u2b50</span>
          </button>
        ))}
      </div>
    </div>
  );
}
