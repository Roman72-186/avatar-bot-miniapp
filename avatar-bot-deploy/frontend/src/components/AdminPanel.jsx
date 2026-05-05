import { useState, useEffect, useCallback } from 'react';
import { getAdminStats, addStarsByUsername, blockUser, deleteUser, broadcastPreview, broadcastSend, getBroadcastHistory } from '../utils/api';
import { useTelegram } from '../hooks/useTelegram';

export default function AdminPanel({ adminPassword, onClose }) {
  const { hapticFeedback, userId } = useTelegram();
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

  // Broadcast state
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [bcText, setBcText] = useState('');
  const [bcPhotoUrl, setBcPhotoUrl] = useState('');
  const [bcButtons, setBcButtons] = useState([]);
  const [bcFilter, setBcFilter] = useState('all');
  const [bcSchedule, setBcSchedule] = useState('');
  const [bcRecipientCount, setBcRecipientCount] = useState(null);
  const [bcCountLoading, setBcCountLoading] = useState(false);
  const [bcSending, setBcSending] = useState(false);
  const [bcResult, setBcResult] = useState(null);
  const [bcHistory, setBcHistory] = useState([]);
  const [bcHistoryLoading, setBcHistoryLoading] = useState(false);

  const loadRecipientCount = useCallback(async (filter) => {
    setBcCountLoading(true);
    try {
      const res = await broadcastPreview(adminPassword, filter);
      const data = Array.isArray(res) ? res[0] : res;
      setBcRecipientCount(data?.count ?? null);
    } catch { setBcRecipientCount(null); }
    finally { setBcCountLoading(false); }
  }, [adminPassword]);

  useEffect(() => {
    if (showBroadcast) loadRecipientCount(bcFilter);
  }, [showBroadcast, bcFilter, loadRecipientCount]);

  useEffect(() => {
    if (showBroadcast) {
      setBcHistoryLoading(true);
      getBroadcastHistory(adminPassword)
        .then(res => {
          const data = Array.isArray(res) ? res : res ? [res] : [];
          setBcHistory(data);
        })
        .catch(() => setBcHistory([]))
        .finally(() => setBcHistoryLoading(false));
    }
  }, [showBroadcast, adminPassword]);

  const handleBroadcastSend = async (testMode = false) => {
    if (!bcText.trim()) return;
    setBcSending(true);
    setBcResult(null);
    try {
      const res = await broadcastSend(adminPassword, {
        messageText: bcText,
        photoUrl: bcPhotoUrl || undefined,
        buttons: bcButtons.filter(b => b.text && b.url),
        filterType: bcFilter,
        testUserId: testMode ? String(userId) : undefined,
        scheduleAt: !testMode && bcSchedule ? new Date(bcSchedule).toISOString() : undefined,
        adminUserId: String(userId),
      });
      const data = Array.isArray(res) ? res[0] : res;
      setBcResult(data);
    } catch (e) {
      setBcResult({ error: true, message: e.message });
    } finally {
      setBcSending(false);
    }
  };

  const addButton = () => {
    if (bcButtons.length < 3) setBcButtons([...bcButtons, { text: '', url: '' }]);
  };
  const updateButton = (i, field, val) => {
    const copy = [...bcButtons];
    copy[i][field] = val;
    setBcButtons(copy);
  };
  const removeButton = (i) => setBcButtons(bcButtons.filter((_, idx) => idx !== i));

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

  // Broadcast view
  if (showBroadcast) {
    const FILTERS = [
      { value: 'all', label: 'Все' },
      { value: 'has_balance', label: 'С балансом' },
      { value: 'zero_balance', label: 'Нулевой баланс' },
      { value: 'new_7d', label: 'Новые 7д' },
      { value: 'new_24h', label: 'Новые 24ч' },
    ];

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="admin-panel" onClick={(e) => e.stopPropagation()}>
          <div className="admin-header">
            <button
              onClick={() => { setShowBroadcast(false); setBcResult(null); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-hint)', fontSize: '14px', cursor: 'pointer', padding: '4px 8px' }}
            >
              ← Назад
            </button>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600 }}>Рассылка</span>
          </div>

          {/* Broadcast History */}
          {bcHistoryLoading ? (
            <div style={{ fontSize: '12px', color: 'var(--text-hint)', padding: '8px 0' }}>Загрузка истории...</div>
          ) : bcHistory.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-hint)', marginBottom: '6px' }}>Последние рассылки</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {bcHistory.map((b) => {
                  const status = b.status === 'sent' ? '\u2705' : b.status === 'scheduled' ? '\u23f3' : b.status === 'sending' ? '\ud83d\udce4' : '\u274c';
                  const preview = (b.message_preview || b.message_text || '').slice(0, 50);
                  const date = b.completed_at || b.scheduled_at || b.created_at;
                  const dateStr = date ? new Date(date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
                  return (
                    <div key={b.id} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '6px 8px', background: 'var(--card-bg)', borderRadius: '8px',
                      border: '1px solid var(--card-border)', fontSize: '12px',
                    }}>
                      <span style={{ fontSize: '14px', flexShrink: 0 }}>{status}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                        {preview}
                      </span>
                      <span style={{ color: 'var(--accent)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {b.sent_count || 0}/{b.blocked_count || 0}/{b.failed_count || 0}
                      </span>
                      <span style={{ color: 'var(--text-hint)', flexShrink: 0, fontSize: '11px' }}>{dateStr}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Message text */}
          <textarea
            className="admin-input"
            placeholder="Текст сообщения (HTML: <b>, <i>, <a>)..."
            value={bcText}
            onChange={(e) => setBcText(e.target.value)}
            rows={4}
            style={{ resize: 'vertical', minHeight: '80px', marginBottom: '8px' }}
          />

          {/* Photo URL */}
          <input
            className="admin-input"
            placeholder="URL фото (необязательно)"
            value={bcPhotoUrl}
            onChange={(e) => setBcPhotoUrl(e.target.value)}
          />

          {/* Inline buttons */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-hint)', marginBottom: '6px' }}>
              Кнопки ({bcButtons.length}/3)
            </div>
            {bcButtons.map((btn, i) => (
              <div key={i} style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                <input
                  className="admin-input"
                  placeholder="Текст"
                  value={btn.text}
                  onChange={(e) => updateButton(i, 'text', e.target.value)}
                  style={{ flex: 1, marginBottom: 0 }}
                />
                <input
                  className="admin-input"
                  placeholder="URL"
                  value={btn.url}
                  onChange={(e) => updateButton(i, 'url', e.target.value)}
                  style={{ flex: 2, marginBottom: 0 }}
                />
                <button
                  onClick={() => removeButton(i)}
                  style={{ background: 'rgba(255,0,0,0.15)', border: '1px solid rgba(255,0,0,0.3)', color: '#f06060', borderRadius: '8px', padding: '0 10px', cursor: 'pointer', fontSize: '16px' }}
                >×</button>
              </div>
            ))}
            {bcButtons.length < 3 && (
              <button
                onClick={addButton}
                style={{ background: 'none', border: '1px dashed var(--card-border)', color: 'var(--text-hint)', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', width: '100%' }}
              >+ Добавить кнопку</button>
            )}
          </div>

          {/* Filter */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-hint)', marginBottom: '6px' }}>Аудитория</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setBcFilter(f.value)}
                  className={`admin-action-btn${bcFilter === f.value ? ' active-green' : ''}`}
                  style={{ fontSize: '11px', padding: '6px 10px' }}
                >{f.label}</button>
              ))}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '6px' }}>
              {bcCountLoading ? 'Подсчёт...' : bcRecipientCount !== null ? `Получателей: ${bcRecipientCount}` : ''}
            </div>
          </div>

          {/* Schedule */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-hint)', marginBottom: '6px' }}>
              Отложенная отправка
              <span style={{ marginLeft: '6px', opacity: 0.6 }}>
                ({Intl.DateTimeFormat().resolvedOptions().timeZone})
              </span>
            </div>
            <input
              type="datetime-local"
              className="admin-input"
              value={bcSchedule}
              onChange={(e) => setBcSchedule(e.target.value)}
              style={{ marginBottom: 0 }}
            />
            {bcSchedule && (
              <button
                onClick={() => setBcSchedule('')}
                style={{ background: 'none', border: 'none', color: 'var(--text-hint)', fontSize: '11px', cursor: 'pointer', padding: '4px 0' }}
              >Очистить (отправить сейчас)</button>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <button
              className="admin-action-btn"
              onClick={() => handleBroadcastSend(true)}
              disabled={bcSending || !bcText.trim()}
              style={{ fontSize: '12px', padding: '10px' }}
            >
              {bcSending ? '...' : 'Тест себе'}
            </button>
            <button
              className="admin-action-btn active-green"
              onClick={() => {
                const count = bcRecipientCount || '?';
                const action = bcSchedule ? 'запланировать' : 'отправить';
                if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} рассылку ${count} пользователям?`)) return;
                handleBroadcastSend(false);
              }}
              disabled={bcSending || !bcText.trim()}
              style={{ fontSize: '12px', padding: '10px' }}
            >
              {bcSending ? 'Отправка...' : bcSchedule ? 'Запланировать' : 'Отправить'}
            </button>
          </div>

          {/* Result */}
          {bcResult && (
            <div style={{
              padding: '10px',
              background: bcResult.error ? 'rgba(255,0,0,0.1)' : 'rgba(0,255,0,0.1)',
              borderRadius: '8px', fontSize: '13px', lineHeight: '1.5',
            }}>
              {bcResult.error
                ? `Ошибка: ${bcResult.message}`
                : bcResult.status === 'test_sent'
                  ? 'Тестовое сообщение отправлено!'
                  : bcResult.status === 'scheduled'
                    ? `Запланировано! ID: ${bcResult.broadcast_id}`
                    : `Отправлено: ${bcResult.sent || 0}, Ошибки: ${bcResult.failed || 0}, Заблокировали бота: ${bcResult.blocked || 0}`
              }
            </div>
          )}
        </div>
      </div>
    );
  }

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
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{selectedUser.star_balance} кредитов</span>
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
                placeholder="Количество кредитов"
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
                  : actionType === 'credit' ? `Начислить ${actionAmount || '...'} кредитов`
                  : `Снять ${actionAmount || '...'} кредитов`}
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
                <div className="admin-stat-value">{stats.total_star_balance} кредитов</div>
                <div className="admin-stat-label">Общий баланс кредитов</div>
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
                      <span className="admin-user-balance">{user.star_balance} кредитов</span>
                      <span style={{ color: 'var(--text-hint)', fontSize: '14px' }}>›</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '16px' }}>
              <button className="action-btn" onClick={loadStats}>
                Обновить
              </button>
              <button
                className="action-btn primary"
                onClick={() => { setShowBroadcast(true); setBcResult(null); hapticFeedback('medium'); }}
              >
                Рассылка
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
