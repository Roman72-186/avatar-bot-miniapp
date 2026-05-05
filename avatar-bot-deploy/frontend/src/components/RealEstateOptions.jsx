import { ROOM_TYPES, RENOVATION_STYLES } from '../utils/realEstate';

export default function RealEstateOptions({
  roomType,
  onRoomTypeChange,
  renovationStyle,
  onRenovationStyleChange,
  showStyle = true,
}) {
  return (
    <div className="real-estate-options">
      <div className="option-block">
        <div className="option-label">Укажите тип помещения</div>
        <div className="option-grid compact">
          {ROOM_TYPES.map((room) => (
            <button
              key={room.id}
              className={`option-card ${roomType === room.id ? 'selected' : ''}`}
              onClick={() => onRoomTypeChange(room.id)}
              type="button"
            >
              <span className="option-name">{room.name}</span>
              <span className="option-hint">{room.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {showStyle && (
        <div className="option-block">
          <div className="option-label">Выберите стиль будущего ремонта</div>
          <div className="option-grid">
            {RENOVATION_STYLES.map((style) => (
              <button
                key={style.id}
                className={`option-card ${renovationStyle === style.id ? 'selected' : ''}`}
                onClick={() => onRenovationStyleChange(style.id)}
                type="button"
              >
                <span className="option-name">{style.name}</span>
                <span className="option-hint">{style.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
