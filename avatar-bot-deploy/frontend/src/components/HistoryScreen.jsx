import { useState, useEffect } from 'react';
import { getUserGenerations, deleteUserGeneration } from '../utils/api';
import { getGenerations as getCachedGenerations, deleteGenerationByUrl, getPrimaryResultUrl } from '../utils/generationCache';
import { MODES } from '../utils/modes';
import { useTelegram } from '../hooks/useTelegram';

function getMetadata(item) {
  if (!item?.metadata) return {};
  if (typeof item.metadata === 'string') {
    try { return JSON.parse(item.metadata); } catch { return {}; }
  }
  return item.metadata;
}

function getItemDetails(item) {
  const metadata = getMetadata(item);
  const imageUrls = item.image_urls || metadata.image_urls || [];
  const videoUrl = item.video_url || metadata.video_url || (item.result_type === 'video' ? item.result_url : '');
  const listingText = item.listing_text || metadata.listing_text || '';
  const primaryUrl = getPrimaryResultUrl({ ...item, metadata, image_urls: imageUrls, video_url: videoUrl });
  const isVideo = item.result_type === 'video' || (!imageUrls.length && Boolean(videoUrl));
  const isText = item.result_type === 'text' || (!primaryUrl && Boolean(listingText));
  const isMixed = item.result_type === 'mixed' || imageUrls.length > 1 || (Boolean(videoUrl) && Boolean(listingText));
  return { metadata, imageUrls, videoUrl, listingText, primaryUrl, isVideo, isText, isMixed };
}

export default function HistoryScreen({ userId, initData, onBack }) {
  const { hapticFeedback, tg } = useTelegram();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    // Сначала показываем кэш из localStorage
    const cached = getCachedGenerations();
    if (cached.length > 0) {
      setItems(cached);
      setLoading(false);
    }

    // Затем загружаем из БД
    if (userId) {
      getUserGenerations(userId, initData)
        .then(data => {
          const gens = data?.generations || (Array.isArray(data) ? data : []);
          if (gens.length > 0) {
            setItems(gens);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [userId]);

  const getModeInfo = (mode) => MODES[mode] || { emoji: '🖼️', name: mode };

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now - d;
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'только что';
      if (diffMin < 60) return `${diffMin} мин назад`;
      const diffH = Math.floor(diffMin / 60);
      if (diffH < 24) return `${diffH} ч назад`;
      return '';
    } catch {
      return '';
    }
  };

  const handleItemClick = (item) => {
    hapticFeedback('light');
    setPreview(item);
  };

  const handleDownload = (url) => {
    hapticFeedback('light');
    try {
      if (url) {
        if (tg) tg.openLink(url);
        else window.open(url, '_blank');
      } else if (preview) {
        const { listingText } = getItemDetails(preview);
        navigator.clipboard?.writeText(listingText);
      }
    } catch {
      if (url) window.open(url, '_blank');
    }
  };

  const handleDelete = async (item) => {
    hapticFeedback('medium');
    const { primaryUrl } = getItemDetails(item);
    setDeleting(item.id || primaryUrl);
    try {
      // Удаляем из БД (если есть id)
      if (item.id && userId) {
        await deleteUserGeneration(userId, item.id, initData).catch(() => {});
      }
      // Удаляем из localStorage
      deleteGenerationByUrl(primaryUrl);
      // Удаляем из текущего списка
      setItems(prev => prev.filter(i => {
        const currentPrimary = getItemDetails(i).primaryUrl;
        return (i.id || currentPrimary) !== (item.id || primaryUrl);
      }));
      setPreview(null);
    } finally {
      setDeleting(null);
    }
  };

  const handleClosePreview = () => {
    setPreview(null);
  };

  return (
    <div className="history-screen">
      <div className="history-header">
        <button className="history-back-btn" onClick={() => { hapticFeedback('light'); onBack(); }}>
          ←
        </button>
        <h2 className="history-title">Мои генерации</h2>
        <span className="history-ttl-hint">хранятся 24ч</span>
      </div>

      {loading ? (
        <div className="history-loading">Загрузка...</div>
      ) : items.length === 0 ? (
        <div className="history-empty">
          <div className="history-empty-icon">🖼️</div>
          <div className="history-empty-text">Генераций пока нет</div>
        </div>
      ) : (
        <div className="history-grid">
          {items.map((item, idx) => {
            const mode = getModeInfo(item.mode);
            const details = getItemDetails(item);
            return (
              <div key={item.id || idx} className="history-item" onClick={() => handleItemClick(item)}>
                {details.isText ? (
                  <div className="history-text-tile">
                    <span>📝</span>
                    <small>Текст</small>
                  </div>
                ) : details.isVideo ? (
                  <>
                    <video src={details.videoUrl || details.primaryUrl} preload="metadata" muted />
                    <div className="history-item-play">▶</div>
                  </>
                ) : (
                  <img
                    src={details.primaryUrl}
                    alt=""
                    loading="lazy"
                    onError={(e) => {
                      e.target.style.opacity = '0.3';
                      e.target.style.background = '#333';
                    }}
                  />
                )}
                <div className="history-item-overlay">
                  <span className="history-item-mode">{mode.emoji}</span>
                  {details.isMixed && <span className="history-item-mode">пакет</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {preview && (
        <div className="history-preview-overlay" onClick={handleClosePreview}>
          <button className="history-preview-close" onClick={handleClosePreview}>✕</button>
          <div className="history-preview-content" onClick={e => e.stopPropagation()}>
            {(() => {
              const details = getItemDetails(preview);
              const previewUrl = details.isVideo ? details.videoUrl || details.primaryUrl : details.primaryUrl;
              if (details.isText) {
                return (
                  <div className="history-preview-text">
                    <div className="listing-result-title">Текст объявления</div>
                    <p>{details.listingText}</p>
                  </div>
                );
              }
              if (details.isVideo) {
                return (
              <video
                src={previewUrl}
                className="history-preview-media"
                controls
                autoPlay
                loop
                playsInline
                muted
              />
                );
              }
              return <img src={previewUrl} alt="" className="history-preview-media" />;
            })()}
            {getItemDetails(preview).imageUrls.length > 1 && (
              <div className="history-preview-gallery">
                {getItemDetails(preview).imageUrls.slice(0, 6).map((url) => (
                  <img key={url} src={url} alt="" />
                ))}
              </div>
            )}
            {getItemDetails(preview).listingText && !getItemDetails(preview).isText && (
              <div className="history-preview-text compact">
                <div className="listing-result-title">Текст объявления</div>
                <p>{getItemDetails(preview).listingText}</p>
              </div>
            )}
            <div className="history-preview-info">
              {getModeInfo(preview.mode).name}
              {preview.prompt ? ` — ${preview.prompt}` : ''}
              {preview.created_at ? ` · ${formatDate(preview.created_at)}` : ''}
            </div>
            <div className="history-preview-actions">
              <button className="action-btn primary" onClick={() => handleDownload(getItemDetails(preview).primaryUrl)}>
                {getItemDetails(preview).primaryUrl ? '💾 Скачать' : 'Скопировать'}
              </button>
              <button
                className="action-btn delete"
                onClick={() => handleDelete(preview)}
                disabled={!!deleting}
              >
                {deleting ? '...' : '🗑 Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
