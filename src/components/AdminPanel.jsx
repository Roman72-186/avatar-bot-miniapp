import { useState, useEffect } from 'react';
import { getAdminStats, addStarsByUsername, blockUser, deleteUser } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';

export default function AdminPanel({ adminPassword, onClose }) {
  const { hapticFeedback } = useTelegram();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionType, setActionType] = useState(null); // 'credit' | 'deduct'
  const [actionAmount, setActionAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [blockLoading, setBlockLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminStats(adminPassword);
      const data = Array.isArray(result) ? result[0] : result;
      if (data?.error) {
        setError(data.message || 'Access denied');
        return;
      }
      setStats(data);
      // Update selectedUser if it's open
      if (selectedUser && data?.top_users) {
        const updated = data.top_users.find(u => u.user_id === selectedUser.user_id);
        if (updated) setSelectedUser(updated);
        else setSelectedUser(null); // user was deleted
      }
    } catch (e) {
      setError(e.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = stats?.top_users?.filter(user => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (user.username || '').toLowerCase().includes(q)
      || String(user.user_id).includes(q);
  }) || [];

  const handleAction = async () => {
    if (!selectedUser) return;
    const amount = Number(actionAmount);
    if (!amount || amount <= 0) {
      setActionMessage('Введите корректное количество');
      return;
    }

    setActionLoading(true);
    setActionMessage('');
    try {
      const finalAmount = actionType === 'deduct' ? -amount : amount;
      const result = await addStarsByUsername(adminPassword, selectedUser.username, finalAmount, selectedUser.user_id);
      const data = Array.isArray(result) ? result[0] : result;
      if (data?.error) {
        setActionMessage(data.message);
      } else if (data?.username) {
        const verb = actionType === 'credit' ? 'Начислено' : 'Снято';
        setActionMessage(`${verb} ${amount}. Баланс: ${data.star_balance}`);
        setSelectedUser(prev => ({ ...prev, star_balance: data.star_balance }));
        setActionAmount('');
        loadStats();
      } else {
        setActionMessage('Пользователь не найден');
      }
    } catch (e) {
      setActionMessage(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!selectedUser) return;
    const shouldBlock = !selectedUser.blocked;
    const action = shouldBlock ? 'заблокировать' : 'разблокировать';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} @${selectedUser.username}?`)) return;

    setBlockLoading(true);
    try {
      const result = await blockUser(adminPassword, selectedUser.username, shouldBlock, selectedUser.user_id);
      const data = Array.isArray(result) ? result[0] : result;
      if (data?.username) {
        setSelectedUser(prev => ({ ...prev, blocked: shouldBlock }));
        loadStats();
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setBlockLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    if (!confirm(`УДАЛИТЬ пользователя @${selectedUser.username}? Это необратимо!`)) return;

    setActionLoading(true);
    setActionMessage('');
    try {
      const result = await deleteUser(adminPassword, selectedUser.username, selectedUser.user_id);
      const data = Array.isArray(result) ? result[0] : result;
      if (data?.deleted) {
        setSelectedUser(null);
        setActionType(null);
        loadStats();
      } else {
        setActionMessage(data?.message || 'Не удалось удалить');
      }
    } catch (e) {
      setActionMessage(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // User detail view
  if (selectedUser) {
    const date = selectedUser.created_at
      ? new Date(selectedUser.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : null;

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="admin-panel" onClick={(e) => e.stopPropagation()}>
          <div className="admin-header">
            <button
              onClick={() => { setSelectedUser(null); setActionType(null); setActionMessage(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-hint)', fontSize: '14px', cursor: 'pointer', padding: '4px 8px' }}
            >
              ← Назад
            </button>
            <span style={{ fontSize: '11px', color: 'var(--text-hint)' }}>
              {selectedUser.blocked ? '\uD83D\uDD34 Заблокирован' : '\uD83D\uDFE2 Активен'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px' }}>
            <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', margin: 0 }}>
              {selectedUser.username ? `@${selectedUser.username}` : selectedUser.user_id}
            </h4>
            <button
              onClick={() => {
                navigator.clipboard.writeText(selectedUser.username || String(selectedUser.user_id));
                hapticFeedback('light');
              }}
              style={{
                padding: '2px 8px', fontSize: '12px',
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '4px', color: '#fff', cursor: 'pointer',
              }}
            >
              📋
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            <div className="admin-detail-row">
              <span style={{ color: 'var(--text-hint)' }}>Дата регистрации</span>
              <span>{date || '—'}</span>
            </div>
            <div className="admin-detail-row">
              <span style={{ color: 'var(--text-hint)' }}>Приглашён</span>
              <span>{selectedUser.referred_by || '—'}</span>
            </div>
            <div className="admin-detail-row">
              <span style={{ color: 'var(--text-hint)' }}>Баланс</span>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{selectedUser.star_balance} ⭐</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            <button
              className={`admin-action-btn ${actionType === 'credit' ? 'active-green' : ''}`}
              onClick={() => { setActionType('credit'); setActionAmount(''); setActionMessage(''); }}
            >
              Пополнить
            </button>
            <button
              className={`admin-action-btn ${actionType === 'deduct' ? 'active-orange' : ''}`}
              onClick={() => { setActionType('deduct'); setActionAmount(''); setActionMessage(''); }}
            >
              Снять
            </button>
          </div>

          {actionType && (
            <div style={{ marginBottom: '16px' }}>
              <input
                type="number"
                placeholder="Количество звёзд"
                value={actionAmount}
                onChange={(e) => setActionAmount(e.target.value)}
                className="admin-input"
              />
              <button
                className="action-btn primary"
                onClick={handleAction}
                disabled={actionLoading}
                style={{ width: '100%', padding: '12px', fontSize: '14px' }}
              >
                {actionLoading ? 'Обработка...'
                  : actionType === 'credit' ? `Начислить ${actionAmount || '...'} ⭐`
                  : `Снять ${actionAmount || '...'} ⭐`}
              </button>
            </div>
          )}

          <button
            className={`admin-action-btn full ${selectedUser.blocked ? 'active-green' : 'active-orange'}`}
            onClick={handleBlock}
            disabled={blockLoading}
            style={{ marginBottom: '8px' }}
          >
            {blockLoading ? '...' : (selectedUser.blocked ? 'Разблокировать' : 'Заблокировать')}
          </button>

          <button
            className="admin-action-btn full active-red"
            onClick={handleDelete}
            disabled={actionLoading}
          >
            {actionLoading ? 'Удаление...' : 'Удалить пользователя'}
          </button>

          {actionMessage && (
            <div style={{
              marginTop: '12px', padding: '8px',
              background: actionMessage.includes('Баланс') || actionMessage.includes('Начислено') || actionMessage.includes('Снято')
                ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)',
              borderRadius: '6px', fontSize: '13px', lineHeight: '1.4',
            }}>
              {actionMessage}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Main list view
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="admin-panel" onClick={(e) => e.stopPropagation()}>
        <div className="admin-header">
          <h3>Admin Panel</h3>
          <button className="admin-close" onClick={onClose}>✕</button>
        </div>

        {loading && <div className="admin-loading">Загрузка...</div>}

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

            <input
              type="text"
              placeholder="Поиск по username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="admin-input"
              style={{ marginTop: '16px' }}
            />

            {filteredUsers.length > 0 && (
              <div className="admin-top-users">
                <h4>Пользователи ({filteredUsers.length})</h4>
                <div className="admin-user-list">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.user_id}
                      className="admin-user-row"
                      onClick={() => {
                        setSelectedUser(user);
                        setActionType(null);
                        setActionAmount('');
                        setActionMessage('');
                        hapticFeedback('light');
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <span className="admin-user-status">{user.blocked ? '🔴' : '🟢'}</span>
                      <span className="admin-user-name">{user.username || user.user_id}</span>
                      <span className="admin-user-balance">{user.star_balance} ⭐</span>
                      <span style={{ color: 'var(--text-hint)', fontSize: '14px' }}>›</span>
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
