import { useState, useEffect } from 'react';

const MESSAGES_BY_MODE = {
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
    'Добавляю детали... ✏️',
    'Финальные штрихи... 🌟',
  ],
  photo_to_video: [
    'Анализирую фото... 🔍',
    'Планирую движение... 🎬',
    'Создаю кадры... 🖼️',
    'Анимирую сцену... 🌊',
    'Рендерю видео... ⚡',
    'Почти готово... 🌟',
  ],
  face_swap: [
    'Анализирую лица... 🔍',
    'Выделяю черты... 🎭',
    'Совмещаю лица... 🔄',
    'Финальные штрихи... 🌟',
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
};

const HINTS = {
  stylize: 'Обычно занимает 10–20 секунд',
  multi_photo: 'Обычно занимает 15–30 секунд',
  style_transfer: 'Обычно занимает 10–20 секунд',
  photo_to_video: 'Обычно занимает 1–3 минуты',
  face_swap: 'Обычно занимает 10–20 секунд',
  remove_bg: 'Обычно занимает 5–10 секунд',
  enhance: 'Обычно занимает 15–30 секунд',
  text_to_image: 'Обычно занимает 10–20 секунд',
};

export default function LoadingScreen({ mode = 'stylize' }) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const messages = MESSAGES_BY_MODE[mode] || MESSAGES_BY_MODE.stylize;
  const hint = HINTS[mode] || HINTS.stylize;
  const isVideo = mode === 'photo_to_video';

  useEffect(() => {
    setMessageIndex(0);
    setProgress(0);
  }, [mode]);

  useEffect(() => {
    const msgInterval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % messages.length);
    }, isVideo ? 5000 : 3000);

    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * (isVideo ? 3 : 8), 95));
    }, isVideo ? 1000 : 500);

    return () => {
      clearInterval(msgInterval);
      clearInterval(progressInterval);
    };
  }, [messages.length, isVideo]);

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
