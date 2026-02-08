import { useTelegram } from '../hooks/useTelegram';

export default function ResultScreen({ imageUrl, style, onNewGeneration }) {
  const { hapticFeedback, tg } = useTelegram();

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
    const botUsername = 'those_are_the_gifts_bot';
    const shareText = `Смотри какую аватарку я сделал! 🎨 Попробуй тоже: https://t.me/${botUsername}`;

    if (tg) {
      // Отправляем через Telegram
      tg.switchInlineQuery('Сделай крутую аватарку! 🎨', ['users', 'groups']);
    } else {
      // Fallback
      navigator.clipboard?.writeText(shareText);
    }
  };

  const handleNewGeneration = () => {
    hapticFeedback('light');
    onNewGeneration();
  };

  return (
    <div className="result-screen">
      <h2 className="result-title">Готово! 🎉</h2>
      <div className="result-image-container">
        <img src={imageUrl} alt="Generated avatar" className="result-image" />
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
