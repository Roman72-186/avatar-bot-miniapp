const THEMES = [
  { id: 'new_year', emoji: '🎄', name: 'Новогодняя' },
  { id: 'autumn', emoji: '🍂', name: 'Осенняя' },
  { id: 'family', emoji: '👨‍👩‍👧‍👦', name: 'Семейная' },
  { id: 'spring', emoji: '🌸', name: 'Весенняя' },
];

export default function ThemeSelector({ selectedTheme, onThemeSelect }) {
  return (
    <div className="theme-selector">
      <div className="theme-selector-label">Выберите тему фотосессии</div>
      <div className="theme-grid">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            className={`theme-card ${selectedTheme === theme.id ? 'selected' : ''}`}
            onClick={() => onThemeSelect(theme.id)}
          >
            <span className="theme-emoji">{theme.emoji}</span>
            <span className="theme-name">{theme.name}</span>
          </button>
        ))}
      </div>
      <div className="theme-info">
        10 AI-фото с сохранением вашей внешности
      </div>
    </div>
  );
}
