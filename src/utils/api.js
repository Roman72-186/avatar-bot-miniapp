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
export async function uploadToFal(file) {
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
export function compressImage(file, maxWidth = 1024, quality = 0.8) {
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
export async function generateAvatar(userId, file, style, initData, creativity = 50, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };

  try {
    step('[1/5] Сжатие фото...');
    const compressedFile = await compressImage(file);
    step(`[2/5] Фото сжато (${Math.round(compressedFile.size / 1024)} КБ). Загрузка на fal.ai...`);

    let imageUrl;
    let useFallback = false;

    try {
      imageUrl = await uploadToFal(compressedFile);
      step('[3/5] Фото загружено. Отправка на генерацию...');
    } catch (uploadError) {
      step(`[3/5] fal.ai недоступен (${uploadError?.message?.slice(0, 50)}). Используем base64...`);
      useFallback = true;
    }

    let requestData;
    if (useFallback) {
      step('[3/5] Кодирование в base64...');
      const photoBase64 = await fileToBase64(compressedFile);
      step(`[4/5] Base64 готов (${Math.round(photoBase64.length / 1024)} КБ). Отправка на n8n...`);
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
      step('[4/5] Отправка запроса на n8n...');
      requestData = {
        user_id: userId,
        image_url: imageUrl,
        style: style,
        init_data: initData,
        creativity: creativity,
      };
    }

    step('[5/5] Ожидание генерации от AI...');
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

// Создать инвойс для оплаты звёздами
export async function createInvoice(userId, starCount) {
  return apiRequest('create-invoice', { user_id: userId, star_count: starCount });
}

// Получить статус пользователя (лимиты, баланс)
export async function getUserStatus(userId, initData, username) {
  return apiRequest('user-status', {
    user_id: userId,
    username: username || '',
    init_data: initData,
  });
}

// Загрузка нескольких файлов на fal.ai параллельно
export async function uploadMultipleToFal(files) {
  return Promise.all(files.map((f) => uploadToFal(f)));
}

// Генерация из нескольких фото + промпт (fal-ai/flux-2-pro/edit)
export async function generateMultiPhoto(userId, files, prompt, initData, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };

  try {
    step(`[1/4] Сжатие ${files.length} фото...`);
    const compressed = await Promise.all(files.map((f) => compressImage(f)));

    step(`[2/4] Загрузка ${compressed.length} фото на fal.ai...`);
    const imageUrls = await uploadMultipleToFal(compressed);

    step('[3/4] Все фото загружены. Отправка на генерацию...');
    const requestData = {
      user_id: userId,
      mode: 'multi_photo',
      image_urls: imageUrls,
      prompt,
      init_data: initData,
    };

    step('[4/4] Ожидание генерации от AI...');
    return await apiRequest('generate-multi', requestData, 120000);
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) throw error;
    throw new Error(`Stage: MULTI_PHOTO, Error: ${msg}`);
  }
}

// Генерация по референсу (fal-ai/image-apps-v2/style-transfer)
export async function generateStyleTransfer(userId, mainFile, refFile, initData, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };

  try {
    step('[1/4] Сжатие фотографий...');
    const [compressedMain, compressedRef] = await Promise.all([
      compressImage(mainFile),
      compressImage(refFile),
    ]);

    step('[2/4] Загрузка фото на fal.ai...');
    const [mainUrl, refUrl] = await Promise.all([
      uploadToFal(compressedMain),
      uploadToFal(compressedRef),
    ]);

    step('[3/4] Фото загружены. Отправка на генерацию...');
    const requestData = {
      user_id: userId,
      mode: 'style_transfer',
      image_url: mainUrl,
      style_reference_image_url: refUrl,
      init_data: initData,
    };

    step('[4/4] Ожидание генерации от AI...');
    return await apiRequest('generate-style-transfer', requestData, 120000);
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) throw error;
    throw new Error(`Stage: STYLE_TRANSFER, Error: ${msg}`);
  }
}

// Генерация видео из фото + промпт (fal-ai/minimax/hailuo-2.3)
export async function generateVideo(userId, file, prompt, duration, initData, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };

  try {
    step('[1/4] Сжатие фото...');
    const compressedFile = await compressImage(file);

    step('[2/4] Загрузка фото на fal.ai...');
    const imageUrl = await uploadToFal(compressedFile);

    step('[3/4] Фото загружено. Отправка на генерацию видео...');
    const requestData = {
      user_id: userId,
      mode: 'photo_to_video',
      image_url: imageUrl,
      prompt,
      duration: String(duration),
      init_data: initData,
    };

    step('[4/4] Генерация видео (может занять 1–3 минуты)...');
    return await apiRequest('generate-video', requestData, 300000);
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) throw error;
    throw new Error(`Stage: VIDEO_GEN, Error: ${msg}`);
  }
}

// Face Swap (fal-ai/face-swap)
export async function generateFaceSwap(userId, sourceFile, targetFile, initData, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };
  try {
    step('[1/4] Сжатие фотографий...');
    const [compSrc, compTgt] = await Promise.all([compressImage(sourceFile), compressImage(targetFile)]);
    step('[2/4] Загрузка фото на fal.ai...');
    const [srcUrl, tgtUrl] = await Promise.all([uploadToFal(compSrc), uploadToFal(compTgt)]);
    step('[3/4] Фото загружены. Замена лица...');
    const requestData = { user_id: userId, mode: 'face_swap', source_url: srcUrl, target_url: tgtUrl, init_data: initData };
    step('[4/4] Ожидание генерации...');
    return await apiRequest('generate-face-swap', requestData, 120000);
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) throw error;
    throw new Error(`Stage: FACE_SWAP, Error: ${msg}`);
  }
}

// Remove Background (fal-ai/birefnet)
export async function generateRemoveBg(userId, file, initData, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };
  try {
    step('[1/3] Сжатие фото...');
    const compressed = await compressImage(file);
    step('[2/3] Загрузка на fal.ai...');
    const imageUrl = await uploadToFal(compressed);
    step('[3/3] Удаление фона...');
    const requestData = { user_id: userId, mode: 'remove_bg', image_url: imageUrl, init_data: initData };
    return await apiRequest('generate-remove-bg', requestData, 60000);
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) throw error;
    throw new Error(`Stage: REMOVE_BG, Error: ${msg}`);
  }
}

// Enhance / Upscale (fal-ai/clarity-upscaler)
export async function generateEnhance(userId, file, initData, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };
  try {
    step('[1/3] Подготовка фото...');
    const compressed = await compressImage(file, 2048, 0.9);
    step('[2/3] Загрузка на fal.ai...');
    const imageUrl = await uploadToFal(compressed);
    step('[3/3] Улучшение качества...');
    const requestData = { user_id: userId, mode: 'enhance', image_url: imageUrl, init_data: initData };
    return await apiRequest('generate-enhance', requestData, 120000);
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) throw error;
    throw new Error(`Stage: ENHANCE, Error: ${msg}`);
  }
}

// Text to Image (fal-ai/flux/dev/text-to-image)
export async function generateTextToImage(userId, prompt, initData, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };
  try {
    step('[1/2] Отправка промпта...');
    const requestData = { user_id: userId, mode: 'text_to_image', prompt, init_data: initData };
    step('[2/2] Генерация изображения...');
    return await apiRequest('generate-text-to-image', requestData, 120000);
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) throw error;
    throw new Error(`Stage: TEXT_TO_IMAGE, Error: ${msg}`);
  }
}

// Admin stats
export async function getAdminStats(password) {
  return apiRequest('admin-stats', { password });
}
