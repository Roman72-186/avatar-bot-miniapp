import { useState } from 'react';

const MODE_HELP = {
  real_estate_renovation: {
    title: 'AI-ремонт квартиры',
    text: 'Загрузите фото комнаты, укажите тип помещения и стиль. AI должен сохранить планировку, окна, двери и геометрию, а результат использовать как визуализацию возможного ремонта.',
  },
  real_estate_enhance: {
    title: 'Улучшить фото объекта',
    text: 'Подходит для быстрых объявлений: AI улучшает свет, цвет, резкость и перспективу, но не должен менять ремонт, мебель или реальные характеристики объекта.',
  },
  real_estate_video: {
    title: 'Видео объекта',
    text: 'Загрузите 3–10 фото квартиры. Для MVP это вертикальный ролик из фотографий с плавным движением и переходами.',
  },
  real_estate_listing_text: {
    title: 'Текст объявления',
    text: 'Заполните параметры объекта и преимущества. AI подготовит продающий текст для Авито, Циан, Домклик или Telegram.',
  },
  real_estate_full_package: {
    title: 'Полный пакет',
    text: 'Один заказ для объекта: AI-визуализации, видео и текст объявления с обязательной пометкой, что изображения являются визуализацией.',
  },
};

export default function CostIndicator({ starCost, freeLeft, hasFreeGenerations, starBalance, modeId }) {
  const [showHelp, setShowHelp] = useState(false);
  const hasFree = hasFreeGenerations && freeLeft > 0;
  const canAfford = hasFree || starBalance >= starCost;
  const help = MODE_HELP[modeId];

  return (
    <div className="cost-indicator-wrapper">
      <div className="cost-indicator">
        {hasFree ? (
          <span className="cost-indicator-free">
            Бесплатно ({freeLeft} осталось)
          </span>
        ) : canAfford ? (
          <span className="cost-indicator-paid">
            Стоимость: <strong>{starCost} кредитов</strong> (у вас {starBalance})
          </span>
        ) : (
          <span className="cost-indicator-insufficient">
            Стоимость: <strong>{starCost} кредитов</strong> — не хватает (у вас {starBalance})
          </span>
        )}
      </div>
      {help && (
        <button
          className="help-btn-corner"
          onClick={() => setShowHelp(!showHelp)}
          aria-label="Подсказка"
        >
          ?
        </button>
      )}
      {showHelp && help && (
        <div className="help-popup-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-popup" onClick={(e) => e.stopPropagation()}>
            <button className="help-popup-close" onClick={() => setShowHelp(false)}>&times;</button>
            <div className="help-popup-title">{help.title}</div>
            <div className="help-popup-text">{help.text}</div>
          </div>
        </div>
      )}
    </div>
  );
}
