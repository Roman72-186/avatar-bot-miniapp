import { useTelegram } from '../hooks/useTelegram';

export default function SentScreen({ onBack }) {
  const { tg, hapticFeedback } = useTelegram();

  const handleViewResult = () => {
    hapticFeedback('light');
    if (tg) {
      tg.close();
    }
  };

  return (
    <div className="sent-screen">
      <div className="sent-animation">
        <div className="sent-circle">
          <div className="sent-checkmark">&#10003;</div>
        </div>
        <div className="sent-ring"></div>
        <div className="sent-ring delay"></div>
      </div>
      <h2 className="sent-title">Готово!</h2>
      <p className="sent-subtitle">
        Результат отправлен в чат с ботом
      </p>
      <p className="sent-hint">
        Закройте приложение, чтобы увидеть результат
      </p>
      <div className="sent-actions">
        <button className="sent-view-btn" onClick={handleViewResult}>
          Посмотреть результат
        </button>
        <button className="sent-new-btn" onClick={onBack}>
          Создать ещё
        </button>
      </div>
    </div>
  );
}
