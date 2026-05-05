import { useState, useEffect } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import { REAL_ESTATE_DISCLAIMER } from '../utils/realEstate';

export default function ResultScreen({
  imageUrl,
  imageUrls = [],
  videoUrl,
  listingText = '',
  resultType = 'image',
  onNewGeneration,
  userId,
  starBalance = 0,
  onTopUp,
  disclaimer = REAL_ESTATE_DISCLAIMER,
}) {
  const { hapticFeedback, tg, shareResult } = useTelegram();
  const [displayUrl, setDisplayUrl] = useState(null);

  const primaryImage = imageUrl || imageUrls[0];
  const mediaUrl = resultType === 'video' ? videoUrl : (primaryImage || videoUrl);
  const displayAsVideo = resultType === 'video' || (!primaryImage && Boolean(videoUrl));

  useEffect(() => {
    if (!mediaUrl) return;
    // Use direct URL for both images and videos
    // Blob approach was causing partial loading issues on mobile
    setDisplayUrl(mediaUrl);
  }, [mediaUrl, resultType]);

  const handleDownload = async () => {
    hapticFeedback('light');
    if (!mediaUrl && !listingText) return;
    try {
      if (tg) {
        if (mediaUrl) tg.openLink(mediaUrl);
        else navigator.clipboard?.writeText(listingText);
      } else {
        if (mediaUrl) window.open(mediaUrl, '_blank');
        else navigator.clipboard?.writeText(listingText);
      }
    } catch (e) {
      if (mediaUrl) window.open(mediaUrl, '_blank');
    }
  };

  const handleShare = () => {
    hapticFeedback('medium');
    const botUsername = import.meta.env.VITE_BOT_USERNAME || 'those_are_the_gifts_bot';
    const refLink = userId
      ? `https://t.me/${botUsername}?start=ref_${userId}`
      : `https://t.me/${botUsername}`;
    const shareText = `AI-визуализация недвижимости готова.\n${mediaUrl || listingText || ''}\n\n${disclaimer}\n\nПопробуй тоже:`;
    shareResult(refLink, shareText);
  };

  const handleNewGeneration = () => {
    hapticFeedback('light');
    onNewGeneration();
  };

  return (
    <div className="result-screen">
      <h2 className="result-title">Готово</h2>
      {(displayUrl || resultType !== 'text') && (
        <div className="result-image-container">
          {displayUrl ? (
            displayAsVideo ? (
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
              <img src={displayUrl} alt="AI-визуализация недвижимости" className="result-image" />
            )
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
              Загрузка результата...
            </div>
          )}
        </div>
      )}
      {imageUrls.length > 1 && (
        <div className="result-gallery">
          {imageUrls.slice(0, 6).map((url) => (
            <img key={url} src={url} alt="" />
          ))}
        </div>
      )}
      {listingText && (
        <div className="listing-result">
          <div className="listing-result-title">Текст объявления</div>
          <p>{listingText}</p>
        </div>
      )}
      {disclaimer && <div className="result-disclaimer">{disclaimer}</div>}
      <div className="result-actions">
        <button className="action-btn primary" onClick={handleDownload}>
          {mediaUrl ? 'Скачать' : 'Скопировать'}
        </button>
        <button className="action-btn share" onClick={handleShare}>
          Поделиться
        </button>
      </div>
      {starBalance < 50 && onTopUp && (
        <div className="result-upsell" onClick={onTopUp}>
          <span>Пополните кредиты, чтобы обработать следующий объект</span>
        </div>
      )}
      <button className="new-generation-btn" onClick={handleNewGeneration}>
        Создать ещё
      </button>
    </div>
  );
}
