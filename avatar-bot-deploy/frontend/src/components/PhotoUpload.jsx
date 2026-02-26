import { useState, useRef } from 'react';

export default function PhotoUpload({ onPhotoSelected, uploadTitle, uploadHint }) {
  const [preview, setPreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;

    // На Android file.type может быть пустым — проверяем лояльно
    if (file.type && !file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Файл слишком большой. Максимум 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
      onPhotoSelected(file, e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e) => {
    handleFile(e.target.files[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const resetPhoto = () => {
    setPreview(null);
    onPhotoSelected(null, null);
    if (galleryRef.current) galleryRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  };

  return (
    <div className="photo-upload">
      {!preview ? (
        <div
          className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="upload-icon">📸</div>
          <div className="upload-title">{uploadTitle || 'Загрузи своё фото'}</div>
          <div className="upload-hint">{uploadHint || 'Лучше всего работает с портретным фото лица крупным планом'}</div>

          <div className="upload-buttons">
            <button
              className="upload-btn gallery-btn"
              onClick={(e) => {
                e.stopPropagation();
                galleryRef.current?.click();
              }}
            >
              📸 Галерея
            </button>

            <button
              className="upload-btn camera-btn"
              onClick={(e) => {
                e.stopPropagation();
                cameraRef.current?.click();
              }}
            >
              📷 Камера
            </button>
          </div>

          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        <div className="preview-container">
          <img src={preview} alt="Preview" className="photo-preview" />
          <button className="reset-btn" onClick={resetPhoto}>
            ✕ Другое фото
          </button>
        </div>
      )}
    </div>
  );
}
