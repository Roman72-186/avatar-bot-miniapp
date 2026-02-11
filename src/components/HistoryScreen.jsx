import { useState, useEffect } from 'react';
import { getUserGenerations } from '../utils/api';
import { getGenerations as getCachedGenerations } from '../utils/generationCache';
import { MODES } from '../utils/modes';
import { useTelegram } from '../hooks/useTelegram';

export default function HistoryScreen({ userId, onBack }) {
  const { hapticFeedback, tg } = useTelegram();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    // Сначала показываем кэш из localStorage
    const cached = getCachedGenerations();
    if (cached.length > 0) {
      setItems(cached);
      setLoading(false);
    }

    // Затем загружаем из БД
    if (userId) {
      getUserGenerations(userId)
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
      const diffD = Math.floor(diffH / 24);
      if (diffD < 7) return `${diffD} дн назад`;
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
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
      if (tg) tg.openLink(url);
      else window.open(url, '_blank');
    } catch {
      window.open(url, '_blank');
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
            const isVideo = item.result_type === 'video';
            return (
              <div key={item.id || idx} className="history-item" onClick={() => handleItemClick(item)}>
                {isVideo ? (
                  <>
                    <video src={item.result_url} preload="metadata" muted />
                    <div className="history-item-play">▶</div>
                  </>
                ) : (
                  <img src={item.result_url} alt="" loading="lazy" />
                )}
                <div className="history-item-overlay">
                  <span className="history-item-mode">{mode.emoji}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {preview && (
        <div className="history-preview-overlay" onClick={handleClosePreview}>
          <button className="history-preview-close" onClick={handleClosePreview}>✕</button>
          <div onClick={e => e.stopPropagation()}>
            {preview.result_type === 'video' ? (
              <video
                src={preview.result_url}
                className="history-preview-media"
                controls
                autoPlay
                loop
                playsInline
                muted
              />
            ) : (
              <img src={preview.result_url} alt="" className="history-preview-media" />
            )}
            <div className="history-preview-info">
              {getModeInfo(preview.mode).name}
              {preview.prompt ? ` — ${preview.prompt}` : ''}
              {preview.created_at ? ` · ${formatDate(preview.created_at)}` : ''}
            </div>
            <div className="history-preview-actions">
              <button className="action-btn primary" onClick={() => handleDownload(preview.result_url)}>
                💾 Скачать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
