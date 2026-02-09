// n8n webhook base URL
const API_BASE = import.meta.env.VITE_API_BASE || 'https://n8n.creativeanalytic.ru/webhook';

// fal.ai credentials
const FAL_KEY = '0945b3eb-a693-44de-a7cb-85d3a8a1a437:6391f113a7c37f4da6a2e1ebda28d7bd';

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

// Загрузка фото на fal.ai storage
async function uploadToFal(file) {
  // 1. Получаем upload URL
  const initResponse = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file_name: file.name || 'photo.jpg',
      content_type: file.type || 'image/jpeg',
    }),
  });

  if (!initResponse.ok) {
    throw new Error('Failed to initiate upload');
  }

  const { file_url, upload_url } = await initResponse.json();

  // 2. Загружаем файл
  const uploadResponse = await fetch(upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'image/jpeg',
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload file');
  }

  return file_url;
}

// Запрос генерации аватарки
export async function generateAvatar(userId, file, style, initData) {
  // 1. Загружаем фото на fal.ai
  const imageUrl = await uploadToFal(file);

  // 2. Отправляем запрос на генерацию в n8n
  return apiRequest('generate', {
    user_id: userId,
    image_url: imageUrl,
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
