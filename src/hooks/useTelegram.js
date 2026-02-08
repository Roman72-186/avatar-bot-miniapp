// Telegram Web App integration
const tg = window.Telegram?.WebApp;

export function useTelegram() {
  const initTelegram = () => {
    if (tg) {
      tg.ready();
      tg.expand();
      tg.enableClosingConfirmation();
    }
  };

  const user = tg?.initDataUnsafe?.user || null;
  const userId = user?.id || null;
  const username = user?.username || null;
  const startParam = tg?.initDataUnsafe?.start_param || null;
  const initData = tg?.initData || '';

  const themeParams = tg?.themeParams || {};
  const colorScheme = tg?.colorScheme || 'dark';

  const showMainButton = (text, callback) => {
    if (tg?.MainButton) {
      tg.MainButton.text = text;
      tg.MainButton.show();
      tg.MainButton.onClick(callback);
    }
  };

  const hideMainButton = () => {
    if (tg?.MainButton) {
      tg.MainButton.hide();
    }
  };

  const hapticFeedback = (type = 'medium') => {
    if (tg?.HapticFeedback) {
      tg.HapticFeedback.impactOccurred(type);
    }
  };

  const shareResult = (url, text) => {
    if (tg) {
      tg.switchInlineQuery(text || 'Сделай себе крутую аватарку! 🎨', ['users', 'groups']);
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
    showMainButton,
    hideMainButton,
    hapticFeedback,
    shareResult,
    close,
  };
}
