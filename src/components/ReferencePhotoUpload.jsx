import { useRef } from 'react';

export default function ReferencePhotoUpload({
  mainPhoto,
  referencePhoto,
  onMainPhotoSelected,
  onReferencePhotoSelected,
  labels,
}) {
  const mainInputRef = useRef(null);
  const refInputRef = useRef(null);

  const handleFile = (file, callback) => {
    if (!file || (file.type && !file.type.startsWith('image/'))) return;
    if (file.size > 10 * 1024 * 1024) return;

    const reader = new FileReader();
    reader.onload = (e) => callback(file, e.target.result);
    reader.readAsDataURL(file);
  };

  const slots = [
    {
      title: labels?.main || '\u0422\u0432\u043e\u0451 \u0444\u043e\u0442\u043e',
      icon: '\ud83d\udcf7',
      photo: mainPhoto,
      inputRef: mainInputRef,
      onSelect: onMainPhotoSelected,
      onRemove: () => onMainPhotoSelected(null, null),
    },
    {
      title: labels?.reference || '\u0420\u0435\u0444\u0435\u0440\u0435\u043d\u0441 \u0441\u0442\u0438\u043b\u044f',
      icon: '\ud83c\udfa8',
      photo: referencePhoto,
      inputRef: refInputRef,
      onSelect: onReferencePhotoSelected,
      onRemove: () => onReferencePhotoSelected(null, null),
    },
  ];

  return (
    <div className="reference-upload">
      <div className="reference-upload-label">Загрузите фото и референс</div>
      <div className="reference-grid">
        {slots.map((slot) => (
          <div
            key={slot.title}
            className={`reference-slot ${slot.photo?.preview ? 'filled' : ''}`}
            onClick={() => !slot.photo?.preview && slot.inputRef.current?.click()}
          >
            {slot.photo?.preview ? (
              <>
                <img src={slot.photo.preview} alt={slot.title} className="reference-slot-preview" />
                <button
                  className="reference-slot-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    slot.onRemove();
                  }}
                >
                  ✕
                </button>
              </>
            ) : (
              <>
                <span className="reference-slot-icon">{slot.icon}</span>
                <span className="reference-slot-title">{slot.title}</span>
              </>
            )}
            <input
              ref={slot.inputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                handleFile(e.target.files[0], slot.onSelect);
                e.target.value = '';
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
