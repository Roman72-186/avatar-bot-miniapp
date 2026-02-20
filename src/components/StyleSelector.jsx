import { STYLES } from '../utils/styles';

export default function StyleSelector({ selectedStyle, onStyleSelect }) {
  return (
    <div className="style-selector">
      <h2 className="section-title">Выбери стиль</h2>
      <div className="styles-grid">
        {STYLES.map((style) => (
          <button
            key={style.id}
            className={`style-card ${selectedStyle === style.id ? 'selected' : ''} ${style.premium ? 'premium' : ''}`}
            onClick={() => onStyleSelect(style.id)}
            style={{ '--accent': style.color }}
          >
            <span className="style-emoji">{style.emoji}</span>
            <span className="style-name">{style.name}</span>
            {style.premium && <span className="premium-badge">⭐</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
