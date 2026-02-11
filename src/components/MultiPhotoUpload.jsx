import { useRef } from 'react';

export default function MultiPhotoUpload({ photos, onPhotosChanged, minPhotos = 2, maxPhotos = 4 }) {
  const inputRefs = useRef([]);

  const handleFile = (index, file) => {
    if (!file || !file.type.startsWith('image/')) return;
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
        {filledCount < minPhotos
          ? `\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u043c\u0438\u043d\u0438\u043c\u0443\u043c ${minPhotos} \u0444\u043e\u0442\u043e`
          : `\u0417\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u043e ${filledCount} \u0438\u0437 ${maxPhotos}`}
      </div>
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
                    \u2715
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
