import { useState, useEffect } from 'react';
import { useTelegram } from '../hooks/useTelegram';

export default function ResultScreen({ imageUrl, videoUrl, resultType = 'image', style, onNewGeneration, debugInfo }) {
  const { hapticFeedback, tg, shareResult } = useTelegram();
  const [displayUrl, setDisplayUrl] = useState(null);
  const [imgError, setImgError] = useState(null);

  const mediaUrl = resultType === 'video' ? videoUrl : imageUrl;

  useEffect(() => {
    if (!mediaUrl) return;
    fetch(mediaUrl)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then(blob => setDisplayUrl(URL.createObjectURL(blob)))
      .catch(e => {
        setImgError(e.message);
        setDisplayUrl(mediaUrl);
      });
  }, [mediaUrl]);

  const handleDownload = async () => {
    hapticFeedback('light');
    try {
      if (tg) {
        tg.openLink(mediaUrl);
      } else {
        window.open(mediaUrl, '_blank');
      }
    } catch (e) {
      window.open(mediaUrl, '_blank');
    }
  };

  const handleShare = () => {
    hapticFeedback('medium');
    const botLink = 'https://t.me/those_are_the_gifts_bot';
    const shareText = resultType === 'video'
      ? `Смотри какое видео я сделал с помощью AI! 🎬\n${mediaUrl}\n\nПопробуй тоже:`
      : `Смотри какую аватарку я сделал! 🎨\n${mediaUrl}\n\nПопробуй тоже:`;
    shareResult(botLink, shareText);
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
          resultType === 'video' ? (
            <video
              src={displayUrl}
              className="result-video"
              controls
              autoPlay
              loop
              playsInline
              muted
            />
          ) : (
            <img src={displayUrl} alt="Generated avatar" className="result-image" />
          )
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
            {resultType === 'video' ? 'Загрузка видео...' : 'Загрузка изображения...'}
          </div>
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
