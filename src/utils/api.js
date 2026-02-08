// n8n webhook base URL — замени на свой
const API_BASE = import.meta.env.VITE_API_BASE || 'https://YOUR_N8N_DOMAIN/webhook';

export async function apiRequest(endpoint, data = {}) {
  try {
    const response = await fetch(`${API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// Загрузка фото на сервер
export async function uploadPhoto(file, userId) {
  const formData = new FormData();
  formData.append('photo', file);
  formData.append('user_id', userId);

  try {
    const response = await fetch(`${API_BASE}/upload-photo`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

// Запрос генерации аватарки
export async function generateAvatar(userId, photoUrl, style, initData) {
  return apiRequest('generate', {
    user_id: userId,
    photo_url: photoUrl,
    style: style,
    init_data: initData,
  });
}

// Получить статус пользователя (лимиты, баланс)
export async function getUserStatus(userId, initData) {
  return apiRequest('user-status', {
    user_id: userId,
    init_data: initData,
  });
}

// Проверить статус генерации
export async function checkGeneration(requestId) {
  return apiRequest('check-generation', {
    request_id: requestId,
  });
}
