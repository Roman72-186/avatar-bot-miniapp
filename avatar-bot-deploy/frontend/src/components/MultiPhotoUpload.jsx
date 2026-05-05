import { useRef } from 'react';

export default function MultiPhotoUpload({
  photos,
  onPhotosChanged,
  minPhotos = 2,
  maxPhotos = 4,
  label,
  hint,
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
    // Shift nulls to end
    const compact = updated.filter(Boolean);
    while (compact.length < maxPhotos) compact.push(null);
    onPhotosChanged(compact);
  };

  const filledCount = photos.filter(Boolean).length;
  const slotsToShow = Math.min(maxPhotos, Math.max(minPhotos, filledCount + 1));

  return (
    <div className="multi-photo-upload">
      <div className="multi-photo-label">
        {label || (filledCount < minPhotos
          ? `Загрузите минимум ${minPhotos} фото`
          : `Загружено ${filledCount} из ${maxPhotos}`)}
      </div>
      {hint && <div className="multi-photo-hint">{hint}</div>}
      <div className="photo-grid">
        {Array.from({ length: slotsToShow }).map((_, i) => {
          const photo = photos[i];
          const isRequired = i < minPhotos;

          return (
            <div
              key={i}
              className={`photo-slot ${photo ? 'filled' : ''} ${isRequired && !photo ? 'required' : ''}`}
              onClick={() => !photo && inputRefs.current[i]?.click()}
            >
              {photo ? (
                <>
                  <img src={photo.preview} alt={`\u0424\u043e\u0442\u043e ${i + 1}`} className="photo-slot-preview" />
                  <button className="photo-slot-remove" onClick={(e) => removePhoto(i, e)}>
                    ✕
                  </button>
                </>
              ) : (
                <>
                  <span className="photo-slot-icon">+</span>
                  <span className="photo-slot-label">
                    {isRequired ? `\u0424\u043e\u0442\u043e ${i + 1} *` : `\u0424\u043e\u0442\u043e ${i + 1}`}
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
    </div>
  );
}
