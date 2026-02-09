import { useState, useEffect } from 'react';

const LOADING_MESSAGES = [
  'Анализирую лицо... 🔍',
  'Применяю магию стиля... 🎨',
  'Добавляю детали... ✏️',
  'Почти готово... ⚡',
  'Финальные штрихи... 🌟',
];

export default function LoadingScreen({ debugStep }) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const msgInterval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 3000);

    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 8, 95));
    }, 500);

    return () => {
      clearInterval(msgInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div className="loading-screen">
      <div className="loading-orb">
        <div className="orb-inner"></div>
        <div className="orb-ring"></div>
        <div className="orb-ring delay"></div>
      </div>
      <div className="loading-message">{LOADING_MESSAGES[messageIndex]}</div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
      </div>
      <div className="loading-hint">Обычно занимает 10–20 секунд</div>
      {debugStep && (
        <div style={{ marginTop: 12, fontSize: 11, color: '#888', wordBreak: 'break-all', padding: '0 16px' }}>
          {debugStep}
        </div>
      )}
    </div>
  );
}
