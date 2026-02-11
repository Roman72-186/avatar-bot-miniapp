import { MODE_LIST } from '../utils/modes';

export default function ModeSelector({ selectedMode, onModeSelect }) {
  return (
    <div className="mode-selector">
      <div className="mode-tabs">
        {MODE_LIST.map((mode) => (
          <button
            key={mode.id}
            className={`mode-tab ${selectedMode === mode.id ? 'selected' : ''}`}
            onClick={() => onModeSelect(mode.id)}
          >
            <span className="mode-tab-emoji">{mode.emoji}</span>
            {mode.name}
          </button>
        ))}
      </div>
    </div>
  );
}
