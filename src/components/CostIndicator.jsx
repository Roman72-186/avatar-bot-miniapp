export default function CostIndicator({ starCost, freeLeft, hasFreeGenerations, starBalance }) {
  const hasFree = hasFreeGenerations && freeLeft > 0;

  return (
    <div className="cost-indicator">
      {hasFree ? (
        <span className="cost-indicator-free">
          Бесплатно ({freeLeft} осталось)
        </span>
      ) : (
        <span className="cost-indicator-paid">
          Стоимость: <strong>{starCost} ⭐</strong>
        </span>
      )}
    </div>
  );
}
