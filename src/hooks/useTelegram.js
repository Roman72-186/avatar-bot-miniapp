// Telegram Web App integration
const tg = window.Telegram?.WebApp;

export function useTelegram() {
  const initTelegram = () => {
    if (tg) {
      tg.ready();
      tg.expand();
    }
  };

  const user = tg?.initDataUnsafe?.user || null;
  const userId = user?.id || null;
  const username = user?.username || null;
  const startParam = tg?.initDataUnsafe?.start_param || null;
  const initData = tg?.initData || '';

  const themeParams = tg?.themeParams || {};
  const colorScheme = tg?.colorScheme || 'dark';

  const hapticFeedback = (type = 'medium') => {
    try {
      const validTypes = ['light', 'medium', 'heavy'];
      const safeType = validTypes.includes(type) ? type : 'medium';
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred(safeType);
      }
    } catch (e) {
      // ignore haptic errors
    }
  };

  const shareResult = (url, text) => {
    try {
      if (tg) {
        // Используем Telegram WebApp API для открытия окна шеринга
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        tg.openTelegramLink(shareUrl);
      } else {
        // Fallback для веб-браузера - используем Web Share API если доступна
        if (navigator.share) {
          navigator.share({
            title: 'Моя аватарка',
            text: text,
            url: url
          });
        } else {
          // Альтернатива - копируем ссылку в буфер обмена
          navigator.clipboard?.writeText(`${text}\n${url}`);
        }
      }
    } catch (e) {
      // Если все способы не работают, копируем в буфер обмена
      navigator.clipboard?.writeText(`${text}\n${url}`);
    }
  };

  const close = () => {
    if (tg) {
      tg.close();
    }
  };

  return {
    tg,
    user,
    userId,
    username,
    startParam,
    initData,
    themeParams,
    colorScheme,
    initTelegram,
    hapticFeedback,
    shareResult,
    close,
  };
}
