const FIELDS = [
  { key: 'city', label: 'Город', placeholder: 'Тюмень' },
  { key: 'district', label: 'Район или адрес', placeholder: 'Центр, ЖК, улица' },
  { key: 'rooms', label: 'Комнатность', placeholder: '2' },
  { key: 'area', label: 'Площадь', placeholder: '54 м²' },
  { key: 'floor', label: 'Этаж', placeholder: '7/16' },
  { key: 'price', label: 'Цена', placeholder: '6 500 000 ₽' },
];

export default function ObjectInfoForm({ value, onChange }) {
  const setField = (key, fieldValue) => {
    onChange({ ...value, [key]: fieldValue });
  };

  return (
    <div className="object-info-form">
      <div className="option-label">Данные для текста объявления</div>
      <div className="object-info-grid">
        {FIELDS.map((field) => (
          <label key={field.key} className="object-field">
            <span>{field.label}</span>
            <input
              value={value[field.key] || ''}
              onChange={(e) => setField(field.key, e.target.value)}
              placeholder={field.placeholder}
            />
          </label>
        ))}
      </div>
      <label className="object-field full">
        <span>Преимущества объекта</span>
        <textarea
          value={value.highlights || ''}
          onChange={(e) => setField('highlights', e.target.value)}
          placeholder="Например: новый дом, закрытый двор, рядом школа, вид на парк"
          maxLength={600}
        />
      </label>
    </div>
  );
}
