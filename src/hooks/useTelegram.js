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
        tg.switchInlineQuery(text || 'Сделай себе крутую аватарку! 🎨', ['users', 'groups']);
      }
    } catch (e) {
      // ignore
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
