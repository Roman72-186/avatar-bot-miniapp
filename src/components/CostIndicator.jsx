export default function CostIndicator({ starCost, freeLeft, hasFreeGenerations, starBalance }) {
  const hasFree = hasFreeGenerations && freeLeft > 0;
  const canAfford = hasFree || starBalance >= starCost;

  return (
    <div className="cost-indicator">
      {hasFree ? (
        <span className="cost-indicator-free">
          Бесплатно ({freeLeft} осталось)
        </span>
      ) : canAfford ? (
        <span className="cost-indicator-paid">
          Стоимость: <strong>{starCost} ⭐</strong> (у вас {starBalance} ⭐)
        </span>
      ) : (
        <span className="cost-indicator-insufficient">
          Стоимость: <strong>{starCost} ⭐</strong> — не хватает (у вас {starBalance} ⭐)
        </span>
      )}
    </div>
  );
}
