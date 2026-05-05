import { useState, useEffect } from 'react';

const MESSAGES_BY_MODE = {
  real_estate_renovation: [
    'Анализирую планировку...',
    'Сохраняю геометрию комнаты...',
    'Подбираю ремонт и мебель...',
    'Выставляю свет...',
    'Готовлю визуализацию...',
  ],
  real_estate_enhance: [
    'Анализирую качество фото...',
    'Выравниваю свет и цвет...',
    'Повышаю резкость...',
    'Сохраняю реальное состояние объекта...',
  ],
  real_estate_video: [
    'Проверяю фотографии объекта...',
    'Собираю маршрут показа...',
    'Готовлю вертикальный ролик...',
    'Добавляю плавные переходы...',
    'Рендерю видео...',
  ],
  real_estate_listing_text: [
    'Собираю данные объекта...',
    'Выделяю преимущества...',
    'Пишу текст объявления...',
    'Добавляю пометку о визуализации...',
  ],
  real_estate_full_package: [
    'Анализирую объект...',
    'Готовлю AI-визуализации...',
    'Собираю видео...',
    'Пишу текст объявления...',
    'Формирую полный пакет...',
  ],
  stylize: [
    'Анализирую лицо... 🔍',
    'Применяю магию стиля... 🎨',
    'Добавляю детали... ✏️',
    'Почти готово... ⚡',
    'Финальные штрихи... 🌟',
  ],
  multi_photo: [
    'Анализирую фотографии... 🔍',
    'Объединяю элементы... 🧩',
    'Создаю композицию... 🎨',
    'Добавляю детали... ✏️',
    'Финальные штрихи... 🌟',
  ],
  style_transfer: [
    'Анализирую стиль референса... 🔍',
    'Извлекаю палитру... 🎨',
    'Переношу стиль... 🪄',
    'Обрабатываю детали... ✏️',
    'Рендерю результат... ⚡',
    'Почти готово... 🌟',
  ],
  photo_to_video: [
    'Анализирую фото... 🔍',
    'Планирую движение... 🎬',
    'Создаю кадры... 🖼️',
    'Анимирую сцену... 🌊',
    'Рендерю видео... ⚡',
    'Почти готово... 🌟',
  ],
  lip_sync: [
    'Анализирую фото... 🔍',
    'Обрабатываю аудио... 🎵',
    'Синхронизирую губы... 🗣️',
    'Создаю анимацию... 🎬',
    'Рендерю видео... ⚡',
    'Почти готово... 🌟',
  ],
  remove_bg: [
    'Анализирую фото... 🔍',
    'Выделяю объект... ✂️',
    'Удаляю фон... 🖌️',
  ],
  enhance: [
    'Анализирую качество... 🔍',
    'Улучшаю детали... ✨',
    'Повышаю чёткость... 🔬',
    'Почти готово... 🌟',
  ],
  text_to_image: [
    'Анализирую промпт... 🔍',
    'Создаю композицию... 🎨',
    'Рисую детали... ✏️',
    'Финальные штрихи... 🌟',
  ],
  photosession: [
    'Анализирую ваше фото... 🔍',
    'Подготовка фотосессии... 📸',
    'Генерация образа 1/10... 🎨',
    'Генерация образа 3/10... 🖌️',
    'Генерация образа 5/10... ✨',
    'Генерация образа 7/10... 🌟',
    'Генерация образа 9/10... ⚡',
    'Финальная обработка... 🎬',
    'Собираю альбом... 📷',
    'Почти готово... 🌟',
  ],
};

const HINTS = {
  real_estate_renovation: 'Визуализация может занять 1–3 минуты',
  real_estate_enhance: 'Обычно занимает 20–60 секунд',
  real_estate_video: 'Видео из фото может занять несколько минут',
  real_estate_listing_text: 'Обычно занимает до минуты',
  real_estate_full_package: 'Полный пакет может занять несколько минут',
  stylize: 'Обычно занимает 20–40 секунд',
  multi_photo: 'Обычно занимает 30–60 секунд',
  style_transfer: 'Генерация может занять несколько минут',
  photo_to_video: 'Обычно занимает 1–3 минуты',
  lip_sync: 'Обычно занимает 1–3 минуты',
  remove_bg: 'Обычно занимает 15–30 секунд',
  enhance: 'Обычно занимает 15–30 секунд',
  text_to_image: 'Обычно занимает 20–40 секунд',
  photosession: 'Генерация 10 фото — обычно 3–6 минут',
};

export default function LoadingScreen({ mode = 'stylize' }) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const messages = MESSAGES_BY_MODE[mode] || MESSAGES_BY_MODE.stylize;
  const hint = HINTS[mode] || HINTS.stylize;
  const isSlowMode = mode === 'photo_to_video'
    || mode === 'style_transfer'
    || mode === 'multi_photo'
    || mode === 'text_to_image'
    || mode === 'stylize'
    || mode === 'lip_sync'
    || mode === 'photosession'
    || mode === 'real_estate_renovation'
    || mode === 'real_estate_video'
    || mode === 'real_estate_full_package';

  useEffect(() => {
    setMessageIndex(0);
    setProgress(0);
  }, [mode]);

  useEffect(() => {
    const msgInterval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % messages.length);
    }, isSlowMode ? 5000 : 3000);

    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * (isSlowMode ? 3 : 8), 95));
    }, isSlowMode ? 1000 : 500);

    return () => {
      clearInterval(msgInterval);
      clearInterval(progressInterval);
    };
  }, [messages.length, isSlowMode]);

  return (
    <div className="loading-screen">
      <div className="loading-orb">
        <div className="orb-inner"></div>
        <div className="orb-ring"></div>
        <div className="orb-ring delay"></div>
      </div>
      <div className="loading-message">{messages[messageIndex]}</div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
      </div>
      <div className="loading-hint">{hint}</div>
    </div>
  );
}
