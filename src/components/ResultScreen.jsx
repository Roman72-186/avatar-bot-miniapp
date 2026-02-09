import { useState, useEffect } from 'react';
import { useTelegram } from '../hooks/useTelegram';

export default function ResultScreen({ imageUrl, style, onNewGeneration, debugInfo }) {
  const { hapticFeedback, tg, shareResult } = useTelegram();
  const [displayUrl, setDisplayUrl] = useState(null);
  const [imgError, setImgError] = useState(null);

  useEffect(() => {
    if (!imageUrl) return;
    // Загружаем изображение через fetch и создаём blob URL
    // чтобы обойти ограничения Telegram WebView на внешние домены
    fetch(imageUrl)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then(blob => setDisplayUrl(URL.createObjectURL(blob)))
      .catch(e => {
        setImgError(e.message);
        setDisplayUrl(imageUrl); // fallback — попробуем напрямую
      });
  }, [imageUrl]);

  const handleDownload = async () => {
    hapticFeedback('light');
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `avatar-${style}-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      window.open(imageUrl, '_blank');
    }
  };

  const handleShare = () => {
    hapticFeedback('medium');
    const shareText = `Смотри какую аватарку я сделал! 🎨 Попробуй тоже:`;

    // Вызываем функцию шеринга с URL изображения и текстом
    shareResult(imageUrl, shareText);
  };

  const handleNewGeneration = () => {
    hapticFeedback('light');
    onNewGeneration();
  };

  return (
    <div className="result-screen">
      <h2 className="result-title">Готово! 🎉</h2>
      <div className="result-image-container">
        {displayUrl ? (
          <img src={displayUrl} alt="Generated avatar" className="result-image" />
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Загрузка изображения...</div>
        )}
        {imgError && (
          <div style={{ fontSize: 10, color: '#c33', textAlign: 'center' }}>fetch error: {imgError}</div>
        )}
      </div>
      <div className="result-actions">
        <button className="action-btn primary" onClick={handleDownload}>
          💾 Скачать
        </button>
        <button className="action-btn share" onClick={handleShare}>
          📤 Поделиться
        </button>
      </div>
      <button className="new-generation-btn" onClick={handleNewGeneration}>
        🔄 Создать ещё
      </button>
      {debugInfo && (
        <div style={{ marginTop: 8, fontSize: 10, color: '#888', wordBreak: 'break-all', padding: '0 12px', maxHeight: 80, overflow: 'auto' }}>
          {debugInfo}
        </div>
      )}
    </div>
  );
}
