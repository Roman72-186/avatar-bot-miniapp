// n8n webhook base URL
const API_BASE = import.meta.env.VITE_API_BASE || 'https://n8n.creativeanalytic.ru/webhook';

// fal.ai credentials
const FAL_KEY = '0945b3eb-a693-44de-a7cb-85d3a8a1a437:6391f113a7c37f4da6a2e1ebda28d7bd';

export async function apiRequest(endpoint, data = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Stage: TIMEOUT, Error: Сервер не ответил за 60 секунд. Попробуйте ещё раз.');
    }
    console.error('API request failed:', error);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// Загрузка фото на fal.ai storage (таймаут 15 сек)
async function uploadToFal(file) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

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
      signal: controller.signal,
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
      signal: controller.signal,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Stage: UPLOAD_FILE, Error: Failed to upload file to signed URL, status: ${uploadResponse.status}`);
    }

    return file_url;
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) {
      throw error;
    }
    throw new Error(`Stage: UPLOAD_PROCESS, Error: ${msg}`);
  } finally {
    clearTimeout(timer);
  }
}

// Сжатие изображения через canvas
function compressImage(file, maxWidth = 1024, quality = 0.8) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      const cleanup = () => { try { URL.revokeObjectURL(objectUrl); } catch(e) {} };
      const fallback = () => { cleanup(); resolve(file); };

      // Таймаут на случай если Image не загрузится
      const timer = setTimeout(fallback, 5000);

      img.onload = () => {
        clearTimeout(timer);
        try {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Fallback: toBlob может не поддерживаться на старых Android
          if (typeof canvas.toBlob === 'function') {
            canvas.toBlob(
              (blob) => {
                cleanup();
                if (blob) {
                  resolve(new File([blob], file.name || 'photo.jpg', { type: 'image/jpeg' }));
                } else {
                  resolve(file);
                }
              },
              'image/jpeg',
              quality
            );
          } else {
            // Используем toDataURL как запасной вариант
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            const byteString = atob(dataUrl.split(',')[1]);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: 'image/jpeg' });
            cleanup();
            resolve(new File([blob], file.name || 'photo.jpg', { type: 'image/jpeg' }));
          }
        } catch (e) {
          fallback();
        }
      };

      img.onerror = () => { clearTimeout(timer); fallback(); };
      img.src = objectUrl;
    } catch (e) {
      resolve(file);
    }
  });
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
    // 0. Сжимаем изображение
    const compressedFile = await compressImage(file);

    // 1. Пробуем загрузить фото на fal.ai
    let imageUrl;
    let useFallback = false;

    try {
      imageUrl = await uploadToFal(compressedFile);
    } catch (uploadError) {
      // Check if it's a network error (Failed to fetch) that could benefit from fallback
      console.warn('Fal upload failed, using fallback method with base64:', uploadError.message);
      useFallback = true;
    }

    let requestData;
    if (useFallback) {
      // Prepare fallback data with base64
      const photoBase64 = await fileToBase64(compressedFile);
      requestData = {
        user_id: userId,
        photo_base64: photoBase64,
        mime_type: compressedFile.type || 'image/jpeg',
        file_name: compressedFile.name || 'photo.jpg',
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
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) {
      throw error;
    }
    throw new Error(`Stage: N8N_WEBHOOK_CALL, Error: ${msg}`);
  }
}

// Получить статус пользователя (лимиты, баланс)
export async function getUserStatus(userId, initData) {
  return apiRequest('user-status', {
    user_id: userId,
    init_data: initData,
  });
}
