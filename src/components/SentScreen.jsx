export default function SentScreen({ onBack }) {
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
        Откройте чат с ботом, чтобы увидеть результат
      </p>
      <button className="action-btn primary sent-btn" onClick={onBack}>
        Создать ещё
      </button>
    </div>
  );
}
