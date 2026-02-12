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

// Read file/blob as ArrayBuffer (Android WebView compatible)
function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    if (typeof file.arrayBuffer === 'function') {
      file.arrayBuffer().then(resolve).catch(reject);
      return;
    }
    // Fallback for older Android WebView
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsArrayBuffer(file);
  });
}

// Определяем Android Telegram WebView (CORS блокирует прямую загрузку на fal.ai)
function isAndroidTelegram() {
  try {
    const ua = navigator.userAgent || '';
    return /Android/i.test(ua) && (/TelegramWebview/i.test(ua) || /Telegram/i.test(ua) || window.Telegram?.WebApp);
  } catch { return false; }
}

// Загрузка через сервер n8n (обход CORS для Android)
async function uploadViaServer(file) {
  const base64 = await fileToBase64(file);
  const resp = await apiRequest('upload-photo', {
    photo_base64: base64,
    content_type: file.type || 'image/jpeg',
    file_name: file.name || 'photo.jpg',
  }, 45000);
  const data = Array.isArray(resp) ? resp[0] : resp;
  if (data?.file_url) return data.file_url;
  throw new Error('Stage: SERVER_UPLOAD, Error: no file_url in response');
}

// Загрузка фото на fal.ai storage (всегда через n8n для надежности)
export async function uploadToFal(file) {
  // Всегда используем серверную загрузку через n8n
  // Это надежнее и работает без блокировок
  console.log('Загрузка через сервер n8n');
  return await uploadViaServer(file);
}

// Сжатие изображения через canvas
export function compressImage(file, maxWidth = 1024, quality = 0.85) {
  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (val) => { if (!resolved) { resolved = true; resolve(val); } };

    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      const cleanup = () => { try { URL.revokeObjectURL(objectUrl); } catch(e) {} };

      // Safety timeout — fires even if toBlob callback errors/hangs (Android WebView)
      const timer = setTimeout(() => { cleanup(); safeResolve(file); }, 8000);

      img.onload = () => {
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

          const makeFile = (blob) => {
            try {
              return new File([blob], file.name || 'photo.jpg', { type: 'image/jpeg' });
            } catch (e) {
              // File constructor not supported on some Android WebView — use Blob
              const b = new Blob([blob], { type: 'image/jpeg' });
              b.name = file.name || 'photo.jpg';
              return b;
            }
          };

          if (typeof canvas.toBlob === 'function') {
            canvas.toBlob(
              (blob) => {
                clearTimeout(timer);
                cleanup();
                try {
                  safeResolve(blob ? makeFile(blob) : file);
                } catch (e) {
                  safeResolve(file);
                }
              },
              'image/jpeg',
              quality
            );
          } else {
            clearTimeout(timer);
            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            const byteString = atob(dataUrl.split(',')[1]);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            cleanup();
            safeResolve(makeFile(new Blob([ab], { type: 'image/jpeg' })));
          }
        } catch (e) {
          clearTimeout(timer);
          cleanup();
          safeResolve(file);
        }
      };

      img.onerror = () => { clearTimeout(timer); cleanup(); safeResolve(file); };
      img.src = objectUrl;
    } catch (e) {
      safeResolve(file);
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
    const compressedFile = await compressImage(file, 600, 0.80);
    step(`[2/5] Фото сжато (${Math.round(compressedFile.size / 1024)} КБ). Загрузка на fal.ai...`);

    // Всегда используем base64 - это надежнее
    step('[3/5] Кодирование в base64...');
    const photoBase64 = await fileToBase64(compressedFile);
    step(`[4/5] Base64 готов (${Math.round(photoBase64.length / 1024)} КБ). Отправка на n8n...`);

    const requestData = {
      user_id: userId,
      photo_base64: photoBase64,
      mime_type: compressedFile.type || 'image/jpeg',
      file_name: compressedFile.name || 'photo.jpg',
      style: style,
      init_data: initData,
      creativity: creativity,
    };

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
    const compressed = await compressImage(file, 600, 0.80);
    step('[2/3] Кодирование в base64...');
    const photoBase64 = await fileToBase64(compressed);
    step('[3/3] Удаление фона...');
    const requestData = {
      user_id: userId,
      mode: 'remove_bg',
      photo_base64: photoBase64,
      mime_type: compressed.type || 'image/jpeg',
      file_name: compressed.name || 'photo.jpg',
      init_data: initData
    };
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
    const compressed = await compressImage(file, 1024, 0.85);
    step('[2/3] Кодирование в base64...');
    const photoBase64 = await fileToBase64(compressed);
    step('[3/3] Улучшение качества...');
    const requestData = {
      user_id: userId,
      mode: 'enhance',
      photo_base64: photoBase64,
      mime_type: compressed.type || 'image/jpeg',
      file_name: compressed.name || 'photo.jpg',
      init_data: initData
    };
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

// История генераций пользователя
export async function getUserGenerations(userId) {
  return apiRequest('user-generations', { user_id: userId });
}

// Удалить генерацию из БД
export async function deleteUserGeneration(userId, generationId) {
  return apiRequest('delete-generation', { user_id: userId, generation_id: generationId });
}

// Реферальная статистика
export async function getReferralStats(userId) {
  return apiRequest('referral-stats', { user_id: userId });
}

// Admin stats
export async function getAdminStats(password) {
  return apiRequest('admin-stats', { password });
}
