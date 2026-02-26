import { getStarCost } from '../utils/modes';

const DURATIONS = [
  { value: '5', label: '5 сек' },
  { value: '10', label: '10 сек' },
];

const QUALITIES = [
  { value: 'std', label: 'Standard', desc: 'Быстрее' },
  { value: 'pro', label: 'Pro', desc: 'Качественнее' },
];

const ASPECTS = [
  { value: '9:16', label: '9:16', desc: 'Верт.' },
  { value: '16:9', label: '16:9', desc: 'Гориз.' },
  { value: '1:1', label: '1:1', desc: 'Квадрат' },
];

export default function DurationSelector({
  selectedDuration, onDurationSelect,
  videoQuality, onQualitySelect,
  videoSound, onSoundToggle,
  videoAspect, onAspectSelect,
}) {
  const cost = getStarCost('photo_to_video', {
    duration: selectedDuration,
    videoQuality: videoQuality || 'std',
    videoSound: videoSound || false,
  });

  return (
    <div className="video-settings">
      <div className="video-setting-group">
        <div className="video-setting-label">Длительность</div>
        <div className="video-setting-options">
          {DURATIONS.map(d => (
            <button
              key={d.value}
              className={`video-setting-btn ${selectedDuration === d.value ? 'selected' : ''}`}
              onClick={() => onDurationSelect(d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="video-setting-group">
        <div className="video-setting-label">Качество</div>
        <div className="video-setting-options">
          {QUALITIES.map(q => (
            <button
              key={q.value}
              className={`video-setting-btn ${videoQuality === q.value ? 'selected' : ''}`}
              onClick={() => onQualitySelect(q.value)}
            >
              {q.label}
              <span className="video-setting-hint">{q.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="video-setting-group">
        <div className="video-setting-label">Формат</div>
        <div className="video-setting-options three-col">
          {ASPECTS.map(a => (
            <button
              key={a.value}
              className={`video-setting-btn ${videoAspect === a.value ? 'selected' : ''}`}
              onClick={() => onAspectSelect(a.value)}
            >
              {a.label}
              <span className="video-setting-hint">{a.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="video-setting-group">
        <div className="video-setting-label">Звук AI</div>
        <div className="video-setting-options">
          <button
            className={`video-setting-btn ${!videoSound ? 'selected' : ''}`}
            onClick={() => onSoundToggle(false)}
          >
            Без звука
          </button>
          <button
            className={`video-setting-btn ${videoSound ? 'selected' : ''}`}
            onClick={() => onSoundToggle(true)}
          >
            Со звуком
            <span className="video-setting-hint">+AI эффекты</span>
          </button>
        </div>
      </div>

      <div className="video-cost-display">
        Стоимость: <strong>{cost} ⭐</strong>
      </div>
    </div>
  );
}
