import { useState, useEffect } from 'react';
import { getAdminStats } from '../utils/api';

export default function AdminPanel({ onClose }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminStats('123hors456');
      const data = Array.isArray(result) ? result[0] : result;
      if (data?.error) {
        setError(data.message || 'Access denied');
        return;
      }
      setStats(data);
    } catch (e) {
      setError(e.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="admin-panel" onClick={(e) => e.stopPropagation()}>
        <div className="admin-header">
          <h3>Admin Panel</h3>
          <button className="admin-close" onClick={onClose}>✕</button>
        </div>

        {loading && <div className="admin-loading">Загрузка статистики...</div>}

        {error && (
          <div className="admin-error">
            <p>{error}</p>
            <button className="action-btn primary" onClick={loadStats}>Повторить</button>
          </div>
        )}

        {stats && (
          <div className="admin-stats">
            <div className="admin-stat-grid">
              <div className="admin-stat-card">
                <div className="admin-stat-value">{stats.total_users}</div>
                <div className="admin-stat-label">Пользователей</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-value">{stats.paying_users}</div>
                <div className="admin-stat-label">С балансом</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-value">{stats.new_users_24h}</div>
                <div className="admin-stat-label">Новых за 24ч</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-value">{stats.new_users_7d}</div>
                <div className="admin-stat-label">Новых за 7д</div>
              </div>
              <div className="admin-stat-card wide">
                <div className="admin-stat-value">{stats.total_star_balance} ⭐</div>
                <div className="admin-stat-label">Общий баланс звёзд</div>
              </div>
            </div>

            {stats.top_users && stats.top_users.length > 0 && (
              <div className="admin-top-users">
                <h4>Топ пользователей</h4>
                <div className="admin-user-list">
                  {stats.top_users.map((user, i) => (
                    <div key={user.user_id} className="admin-user-row">
                      <span className="admin-user-rank">#{i + 1}</span>
                      <span className="admin-user-name">{user.username || user.user_id}</span>
                      <span className="admin-user-balance">{user.star_balance} ⭐</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button className="action-btn" onClick={loadStats} style={{ marginTop: '16px', width: '100%' }}>
              Обновить
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
