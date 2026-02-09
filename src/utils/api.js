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
  try {
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
      throw new Error(`Stage: INIT_UPLOAD_URL, Error: Failed to initiate upload, status: ${initResponse.status}`);
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
      throw new Error(`Stage: UPLOAD_FILE, Error: Failed to upload file to signed URL, status: ${uploadResponse.status}`);
    }

    return file_url;
  } catch (error) {
    if (error.message.includes('Stage:')) {
      throw error; // Re-throw with our custom error message
    }
    throw new Error(`Stage: UPLOAD_PROCESS, Error: ${error.message}`);
  }
}

// Конвертация файла в base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]); // Extract base64 part
    reader.onerror = error => reject(error);
  });
}

// Запрос генерации аватарки
export async function generateAvatar(userId, file, style, initData, creativity = 50) {
  try {
    // 1. Пробуем загрузить фото на fal.ai
    let imageUrl;
    let useFallback = false;
    
    try {
      imageUrl = await uploadToFal(file);
    } catch (uploadError) {
      // Check if it's a network error (Failed to fetch) that could benefit from fallback
      if (uploadError.message.includes('Stage: UPLOAD_PROCESS') &&
          uploadError.message.includes('Failed to fetch')) {
        console.warn('Fal upload failed, using fallback method with base64:', uploadError.message);
        useFallback = true;
      } else {
        // Re-throw non-network related upload errors
        throw uploadError;
      }
    }

    let requestData;
    if (useFallback) {
      // Prepare fallback data with base64
      const photoBase64 = await fileToBase64(file);
      requestData = {
        user_id: userId,
        photo_base64: photoBase64,
        mime_type: file.type || 'image/jpeg',
        file_name: file.name || 'photo.jpg',
        style: style,
        init_data: initData,
        creativity: creativity,
      };
    } else {
      // Original flow with image URL
      requestData = {
        user_id: userId,
        image_url: imageUrl,
        style: style,
        init_data: initData,
        creativity: creativity,
      };
    }

    // 2. Отправляем запрос на генерацию в n8n
    const result = await apiRequest('generate', requestData);

    return result;
  } catch (error) {
    if (error.message.includes('Stage:')) {
      throw error; // Re-throw our custom upload errors
    }
    throw new Error(`Stage: N8N_WEBHOOK_CALL, Error: ${error.message}`);
  }
}

// Получить статус пользователя (лимиты, баланс)
export async function getUserStatus(userId, initData) {
  return apiRequest('user-status', {
    user_id: userId,
    init_data: initData,
  });
}
