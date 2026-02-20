import { useState, useEffect } from 'react';
import { useTelegram } from '../hooks/useTelegram';

export default function ResultScreen({ imageUrl, videoUrl, resultType = 'image', style, onNewGeneration, userId }) {
  const { hapticFeedback, tg, shareResult } = useTelegram();
  const [displayUrl, setDisplayUrl] = useState(null);

  const mediaUrl = resultType === 'video' ? videoUrl : imageUrl;

  useEffect(() => {
    if (!mediaUrl) return;
    // Use direct URL for both images and videos
    // Blob approach was causing partial loading issues on mobile
    setDisplayUrl(mediaUrl);
  }, [mediaUrl, resultType]);

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
    const refLink = userId
      ? `https://t.me/those_are_the_gifts_bot?start=ref_${userId}`
      : 'https://t.me/those_are_the_gifts_bot';
    const shareText = resultType === 'video'
      ? `\u0421\u043c\u043e\u0442\u0440\u0438 \u043a\u0430\u043a\u043e\u0435 \u0432\u0438\u0434\u0435\u043e \u044f \u0441\u0434\u0435\u043b\u0430\u043b \u0441 \u043f\u043e\u043c\u043e\u0449\u044c\u044e AI! \ud83c\udfac\n${mediaUrl}\n\n\u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0442\u043e\u0436\u0435:`
      : `\u0421\u043c\u043e\u0442\u0440\u0438 \u043a\u0430\u043a\u0443\u044e \u0430\u0432\u0430\u0442\u0430\u0440\u043a\u0443 \u044f \u0441\u0434\u0435\u043b\u0430\u043b! \ud83c\udfa8\n${mediaUrl}\n\n\u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439 \u0442\u043e\u0436\u0435:`;
    shareResult(refLink, shareText);
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
    </div>
  );
}
