import { MODE_LIST } from '../utils/modes';

export default function ModeSelector({ selectedMode, onModeSelect, freeGens }) {
  return (
    <div className="mode-selector">
      <div className="mode-tabs">
        {MODE_LIST.map((mode) => {
          const freeLeft = (freeGens && mode.freeKey) ? (freeGens[mode.freeKey] || 0) : 0;
          return (
            <button
              key={mode.id}
              className={`mode-tab ${selectedMode === mode.id ? 'selected' : ''}`}
              onClick={() => onModeSelect(mode.id)}
            >
              {freeLeft > 0 && <span className="mode-tab-free">FREE</span>}
              <span className="mode-tab-emoji">{mode.emoji}</span>
              {mode.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
