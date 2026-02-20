import { useRef } from 'react';

const SLOT_CONFIG = [
  { title: 'Твоё фото', icon: '📷' },
  { title: 'Референс 1', icon: '🎨' },
  { title: 'Референс 2', icon: '🎨' },
  { title: 'Референс 3', icon: '🎨' },
];

export default function StyleTransferUpload({
  photos,
  onPhotosChanged,
  promptText,
  onPromptChange,
  promptPlaceholder,
}) {
  const inputRefs = useRef([]);

  const handleFile = (index, file) => {
    if (!file || (file.type && !file.type.startsWith('image/'))) return;
    if (file.size > 10 * 1024 * 1024) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const updated = [...photos];
      updated[index] = { file, preview: e.target.result };
      onPhotosChanged(updated);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (index, e) => {
    e.stopPropagation();
    const updated = [...photos];
    updated[index] = null;

    // Compact reference slots (indices 1-3) — shift nulls to end
    const main = updated[0];
    const refs = updated.slice(1).filter(Boolean);
    while (refs.length < 3) refs.push(null);
    onPhotosChanged([main, ...refs]);
  };

  const filledCount = photos.filter(Boolean).length;
  // Always show slot 0 (main) + dynamic reference slots: min 1, max 3, expand by 1
  const refFilled = photos.slice(1).filter(Boolean).length;
  const refSlotsToShow = Math.min(3, Math.max(1, refFilled + 1));
  const slotsToShow = 1 + refSlotsToShow;

  return (
    <div className="reference-upload">
      <div className="reference-upload-label">
        {filledCount < 2
          ? 'Загрузите фото и минимум 1 референс'
          : `Загружено ${filledCount} из 4`}
      </div>
      <div className="reference-grid">
        {Array.from({ length: slotsToShow }).map((_, i) => {
          const photo = photos[i];
          const cfg = SLOT_CONFIG[i];
          const isRequired = i <= 1; // main photo + at least 1 reference

          return (
            <div
              key={i}
              className={`reference-slot ${photo?.preview ? 'filled' : ''} ${isRequired && !photo ? 'required' : ''}`}
              onClick={() => !photo?.preview && inputRefs.current[i]?.click()}
            >
              {photo?.preview ? (
                <>
                  <img src={photo.preview} alt={cfg.title} className="reference-slot-preview" />
                  <button
                    className="reference-slot-remove"
                    onClick={(e) => removePhoto(i, e)}
                  >
                    ✕
                  </button>
                </>
              ) : (
                <>
                  <span className="reference-slot-icon">{cfg.icon}</span>
                  <span className="reference-slot-title">
                    {isRequired ? `${cfg.title} *` : cfg.title}
                  </span>
                </>
              )}
              <input
                ref={(el) => (inputRefs.current[i] = el)}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  handleFile(i, e.target.files[0]);
                  e.target.value = '';
                }}
              />
            </div>
          );
        })}
      </div>

      {onPromptChange && (
        <div className="reference-prompt-section">
          <textarea
            className="reference-prompt-input"
            placeholder={promptPlaceholder || 'Опишите желаемый результат (необязательно)'}
            value={promptText || ''}
            onChange={(e) => onPromptChange(e.target.value)}
            rows={3}
          />
        </div>
      )}
    </div>
  );
}
