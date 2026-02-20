// Импорт стилей для получения полных промптов
import { STYLES } from './styles.js';

// n8n webhook base URL
const API_BASE = import.meta.env.VITE_API_BASE || 'https://n8n.creativeanalytic.ru/webhook';

// Задержка между повторными попытками
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Преобразование технических ошибок в понятные сообщения
function getFriendlyErrorMessage(error, endpoint) {
  const msg = error?.message || String(error);

  // Таймаут
  if (error.name === 'AbortError' || msg.includes('TIMEOUT')) {
    return 'Генерация заняла слишком много времени. Попробуйте снова.';
  }

  // Сетевые ошибки
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'Проблема с подключением. Проверьте интернет и попробуйте снова.';
  }

  // Ошибки сервера
  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
    return 'Сервер временно недоступен. Попробуйте через несколько секунд.';
  }

  // Ошибки AI генерации
  if (msg.includes('fal.ai') || msg.includes('kie.ai') || msg.includes('generation_failed')) {
    return 'Ошибка генерации AI. Попробуйте снова или выберите другие параметры.';
  }

  // Ошибки баланса
  if (msg.includes('balance') || msg.includes('stars')) {
    return msg; // Показываем как есть
  }

  // Общая ошибка
  return 'Что-то пошло не так. Попробуйте ещё раз.';
}

// API запрос с автоматическими повторными попытками
export async function apiRequest(endpoint, data = {}, timeoutMs = 60000, maxRetries = 2) {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const result = await response.json();

      // Проверка на ошибки в ответе (бизнес-логика — не ретраим)
      if (result?.error || result?.status === 'error') {
        const msg = result.error || result.message || 'Generation failed';
        throw Object.assign(new Error(msg), { _noRetry: true });
      }

      return result;

    } catch (error) {
      clearTimeout(timeout);
      lastError = error;

      // Бизнес-ошибки и HTTP 4xx — не ретраим
      const isBusinessError = error._noRetry || /^HTTP 4\d\d/.test(error.message);
      if (isBusinessError || attempt === maxRetries) {
        const friendlyMsg = getFriendlyErrorMessage(error, endpoint);
        console.error(`API request failed:`, error);
        throw new Error(friendlyMsg);
      }

      // Логируем попытку
      console.warn(`API request attempt ${attempt + 1} failed, retrying...`, error);

      // Экспоненциальная задержка: 2s, 4s
      const delay = Math.min(2000 * Math.pow(2, attempt), 5000);
      await sleep(delay);
    }
  }

  // На случай если цикл завершился без return (не должно произойти)
  throw lastError || new Error('Unknown error');
}

// Загрузка фото на S3 через микросервис
async function uploadToS3(file) {
  const base64 = await fileToBase64(file);

  // Используем прямой fetch к S3 микросервису (не через apiRequest)
  const response = await fetch('https://n8n.creativeanalytic.ru/s3-upload/upload-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      photo_base64: base64,
      mime_type: file.type || 'image/jpeg',
      file_name: file.name || 'photo.jpg',
    }),
  });

  if (!response.ok) {
    throw new Error(`S3 upload failed: ${response.status}`);
  }

  const data = await response.json();
  const result = Array.isArray(data) ? data[0] : data;

  if (result?.file_url) {
    console.log('✅ Фото загружено на S3:', result.file_url);
    return result.file_url;
  }

  throw new Error('Stage: S3_UPLOAD, Error: no file_url in response');
}

// Загрузка фото (теперь на S3 вместо fal.ai)
export async function uploadToFal(file) {
  // Загружаем на S3 через микросервис
  // Результат доступен без VPN и блокировок
  console.log('Загрузка фото на S3...');
  return await uploadToS3(file);
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

// Запрос генерации аватарки (Kie.ai flux-2/pro-image-to-image)
export async function generateAvatar(userId, file, style, initData, creativity = 50, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };

  try {
    step('[1/4] Сжатие фото...');
    const compressedFile = await compressImage(file, 600, 0.80);

    step('[2/4] Загрузка фото на S3...');
    const imageUrl = await uploadToS3(compressedFile);

    // Найти полный промпт стиля по ID
    const styleObj = STYLES.find(s => s.id === style);
    const stylePrompt = styleObj?.prompt || `${style} style portrait`;

    step('[3/4] Фото загружено. Отправка на генерацию...');
    const requestData = {
      user_id: userId,
      image_url: imageUrl,
      style: stylePrompt,
      creativity: creativity,
      init_data: initData,
    };

    step('[4/4] Ожидание генерации от AI...');
    const result = await apiRequest('generate', requestData, 180000);

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
export async function createInvoice(userId, starCount, initData) {
  return apiRequest('create-invoice', { user_id: userId, star_count: starCount, init_data: initData });
}

// Получить статус пользователя (лимиты, баланс) — без retry для быстрой загрузки
export async function getUserStatus(userId, initData, username, referredBy) {
  const data = {
    user_id: userId,
    username: username || '',
    init_data: initData,
  };
  if (referredBy) data.referred_by = referredBy;
  return apiRequest('user-status', data, 15000, 0);
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
    return await apiRequest('generate-multi', requestData, 180000);
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) throw error;
    throw new Error(`Stage: MULTI_PHOTO, Error: ${msg}`);
  }
}

// Генерация по референсу (Kie.ai Nano Banana Pro) — 2-4 фото + разрешение
export async function generateStyleTransfer(userId, files, prompt, resolution, initData, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };

  try {
    step(`[1/4] Сжатие ${files.length} фото...`);
    const compressed = await Promise.all(files.map((f) => compressImage(f)));

    step(`[2/4] Загрузка ${compressed.length} фото на S3...`);
    const imageUrls = await uploadMultipleToFal(compressed);

    step('[3/4] Фото загружены. Отправка на генерацию через Kie.ai...');
    const requestData = {
      user_id: userId,
      mode: 'style_transfer',
      image_urls: imageUrls,
      resolution: resolution || '2K',
      init_data: initData,
    };

    if (prompt && prompt.trim().length > 0) {
      requestData.prompt = prompt.trim();
    }

    step('[4/4] Ожидание генерации (может занять несколько минут)...');
    return await apiRequest('generate-style-transfer', requestData, 300000);
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) throw error;
    throw new Error(`Stage: STYLE_TRANSFER, Error: ${msg}`);
  }
}

// Генерация с Google Gemini (gemini-1.5-flash)
export async function generateGeminiStyle(userId, mainFile, refFile, prompt, initData, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };

  try {
    step('[1/4] Сжатие фотографий...');
    const [compressedMain, compressedRef] = await Promise.all([
      compressImage(mainFile),
      compressImage(refFile),
    ]);

    step('[2/4] Загрузка фото на S3...');
    const [mainUrl, refUrl] = await Promise.all([
      uploadToFal(compressedMain),
      uploadToFal(compressedRef),
    ]);

    step('[3/4] Фото загружены. Отправка на генерацию через Gemini...');
    const requestData = {
      user_id: userId,
      mode: 'gemini_style',
      image_url: mainUrl,
      style_reference_image_url: refUrl,
      init_data: initData,
    };

    // Добавляем промпт, если он указан
    if (prompt && prompt.trim().length > 0) {
      requestData.prompt = prompt.trim();
    }

    step('[4/4] Ожидание генерации от Gemini AI...');
    return await apiRequest('generate-gemini-style', requestData, 120000);
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) throw error;
    throw new Error(`Stage: GEMINI_STYLE, Error: ${msg}`);
  }
}

// Генерация видео из фото (Kie.ai Kling 3.0)
export async function generateVideo(userId, file, prompt, duration, options, initData, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };
  const { quality = 'std', sound = false, aspect = '9:16', lastFrameFile = null } = options || {};

  try {
    step('[1/4] Сжатие фото...');
    const compressedFile = await compressImage(file);

    step('[2/4] Загрузка фото на S3...');
    const uploads = [uploadToFal(compressedFile)];
    if (lastFrameFile) {
      const compressedLast = await compressImage(lastFrameFile);
      uploads.push(uploadToFal(compressedLast));
    }
    const [imageUrl, lastFrameUrl] = await Promise.all(uploads);

    step('[3/4] Фото загружено. Отправка на генерацию видео...');
    const requestData = {
      user_id: userId,
      mode: 'photo_to_video',
      image_url: imageUrl,
      prompt,
      duration: String(duration),
      quality,
      sound,
      aspect_ratio: aspect,
      init_data: initData,
    };
    if (lastFrameUrl) requestData.last_frame_url = lastFrameUrl;

    step('[4/4] Генерация видео (может занять 1–3 минуты)...');
    return await apiRequest('generate-video', requestData, 300000);
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) throw error;
    throw new Error(`Stage: VIDEO_GEN, Error: ${msg}`);
  }
}

// Lip Sync (Kie.ai Kling AI Avatar Pro)
export async function generateLipSync(userId, photoFile, audioFile, prompt, initData, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };
  try {
    step('[1/4] Сжатие фото...');
    const compressed = await compressImage(photoFile);

    step('[2/4] Загрузка фото и аудио на S3...');
    const [imageUrl, audioUrl] = await Promise.all([
      uploadToFal(compressed),
      uploadAudioToS3(audioFile),
    ]);

    step('[3/4] Файлы загружены. Запуск Lip Sync...');
    const requestData = {
      user_id: userId,
      mode: 'lip_sync',
      image_url: imageUrl,
      audio_url: audioUrl,
      prompt: prompt || '',
      init_data: initData,
    };

    step('[4/4] Генерация видео (может занять 1–3 минуты)...');
    return await apiRequest('generate-lip-sync', requestData, 300000);
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) throw error;
    throw new Error(`Stage: LIP_SYNC, Error: ${msg}`);
  }
}

// Загрузка аудио на S3
async function uploadAudioToS3(file) {
  const base64 = await fileToBase64(file);
  const response = await fetch('https://n8n.creativeanalytic.ru/s3-upload/upload-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      photo_base64: base64,
      mime_type: file.type || 'audio/mpeg',
      file_name: file.name || 'audio.mp3',
    }),
  });
  if (!response.ok) throw new Error(`S3 audio upload failed: ${response.status}`);
  const data = await response.json();
  const result = Array.isArray(data) ? data[0] : data;
  if (result?.file_url) {
    console.log('Audio uploaded to S3:', result.file_url);
    return result.file_url;
  }
  throw new Error('Stage: S3_AUDIO_UPLOAD, Error: no file_url in response');
}

// Remove Background (fal-ai/birefnet)
export async function generateRemoveBg(userId, file, initData, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };
  try {
    step('[1/3] Сжатие фото...');
    const compressed = await compressImage(file, 600, 0.80);
    step('[2/3] Загрузка фото...');
    const imageUrl = await uploadToFal(compressed);
    step('[3/3] Удаление фона...');
    const requestData = {
      user_id: userId,
      mode: 'remove_bg',
      image_url: imageUrl,
      init_data: initData
    };
    return await apiRequest('generate-remove-bg', requestData, 120000);
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
    step('[2/3] Загрузка фото...');
    const imageUrl = await uploadToFal(compressed);
    step('[3/3] Улучшение качества...');
    const requestData = {
      user_id: userId,
      mode: 'enhance',
      image_url: imageUrl,
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
    return await apiRequest('generate-text-to-image', requestData, 180000);
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) throw error;
    throw new Error(`Stage: TEXT_TO_IMAGE, Error: ${msg}`);
  }
}

// История генераций пользователя
export async function getUserGenerations(userId, initData) {
  return apiRequest('user-generations', { user_id: userId, init_data: initData });
}

// Удалить генерацию из БД
export async function deleteUserGeneration(userId, generationId, initData) {
  return apiRequest('delete-generation', { user_id: userId, generation_id: generationId, init_data: initData });
}

// Реферальная статистика
export async function getReferralStats(userId, initData) {
  return apiRequest('referral-stats', { user_id: userId, init_data: initData });
}

// Validate admin password via server (returns admin stats on success, error on failure)
export async function validateAdminPassword(password) {
  return apiRequest('admin-stats', { password });
}

// Admin stats
export async function getAdminStats(password) {
  return apiRequest('admin-stats', { password });
}

// Add stars to user by username or user_id (admin only)
export async function addStarsByUsername(password, username, amount, userId) {
  return apiRequest('add-stars', { password, username: username || undefined, user_id: userId, amount });
}

// Block/unblock user (admin only)
export async function blockUser(password, username, blocked, userId) {
  return apiRequest('block-user', { password, username: username || undefined, user_id: userId, blocked });
}

// Delete user (admin only)
export async function deleteUser(password, username, userId) {
  return apiRequest('delete-user', { password, username: username || undefined, user_id: userId });
}

// Broadcast: preview recipient count
export async function broadcastPreview(password, filterType) {
  return apiRequest('admin-broadcast-preview', { password, filter_type: filterType || 'all' }, 15000, 0);
}

// Broadcast: send or schedule
export async function broadcastSend(password, { messageText, photoUrl, buttons, filterType, testUserId, scheduleAt }) {
  return apiRequest('admin-broadcast', {
    password,
    message_text: messageText,
    photo_url: photoUrl || undefined,
    buttons: buttons?.length ? buttons : undefined,
    filter_type: filterType || 'all',
    test_user_id: testUserId || undefined,
    schedule_at: scheduleAt || undefined,
  }, 300000, 0);
}

// NanoBanana Pro AI Avatar Generation (2-8 photos)
export async function generateNanoBanana(userId, files, prompt, initData, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };

  try {
    step(`[1/4] Сжатие ${files.length} фото...`);
    const compressed = await Promise.all(files.map((f) => compressImage(f)));

    step(`[2/4] Загрузка ${compressed.length} фото на S3...`);
    const photoUrls = await uploadMultipleToFal(compressed);

    step('[3/4] Все фото загружены. Отправка на генерацию AI-аватара...');
    const requestData = {
      user_id: userId,
      mode: 'ai_magic',
      photos: photoUrls,
      prompt: prompt || 'Professional high-quality portrait photo of this person, studio lighting, sharp focus',
      init_data: initData,
    };

    step('[4/4] Генерация AI-аватара запущена. Ожидайте результат через 30-60 секунд...');
    return await apiRequest('generate-nanobanana', requestData, 120000);
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) throw error;
    throw new Error(`Stage: NANOBANANA, Error: ${msg}`);
  }
}
