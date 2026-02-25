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

  // Ошибки авторизации (initData)
  if (msg.includes('403') || msg.includes('unauthorized') || msg.includes('initData')) {
    return 'Ошибка авторизации Telegram. Закройте и откройте мини-приложение заново.';
  }

  // Ошибки сервера
  if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
    return 'Сервер временно недоступен. Попробуйте через несколько секунд.';
  }

  // Ошибки S3 загрузки
  if (msg.includes('S3') || msg.includes('s3-upload')) {
    return 'Ошибка загрузки файла. Попробуйте ещё раз.';
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
  console.log(`[API] ${endpoint} → sending request...`, { user_id: data.user_id, mode: data.mode, has_init_data: !!data.init_data });

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
      console.log(`[API] ${endpoint} → HTTP ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }

      const result = await response.json();

      // Проверка на ошибки в ответе (бизнес-логика — не ретраим)
      if (result?.error || result?.status === 'error') {
        const msg = result.error || result.message || 'Generation failed';
        console.error(`[API] ${endpoint} → business error:`, msg);
        throw Object.assign(new Error(msg), { _noRetry: true });
      }

      console.log(`[API] ${endpoint} → success`, { sent: result?.sent, has_image: !!result?.image_url, has_video: !!result?.video_url });
      return result;

    } catch (error) {
      clearTimeout(timeout);
      lastError = error;

      // Бизнес-ошибки и HTTP 4xx — не ретраим
      const isBusinessError = error._noRetry || /^HTTP 4\d\d/.test(error.message);
      if (isBusinessError || attempt === maxRetries) {
        const friendlyMsg = getFriendlyErrorMessage(error, endpoint);
        console.error(`[API] ${endpoint} → FAILED (attempt ${attempt + 1}):`, error.message);
        throw new Error(friendlyMsg);
      }

      // Логируем попытку
      console.warn(`[API] ${endpoint} → attempt ${attempt + 1} failed, retrying...`, error.message);

      // Экспоненциальная задержка: 2s, 4s
      const delay = Math.min(2000 * Math.pow(2, attempt), 5000);
      await sleep(delay);
    }
  }

  // На случай если цикл завершился без return (не должно произойти)
  throw lastError || new Error('Unknown error');
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

// Загрузка фото на S3 через микросервис (с таймаутом)
async function uploadToS3(file) {
  const base64 = await fileToBase64(file);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000); // 15 сек таймаут

  try {
    const response = await fetch('https://n8n.creativeanalytic.ru/s3-upload/upload-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photo_base64: base64,
        mime_type: file.type || 'image/jpeg',
        file_name: file.name || 'photo.jpg',
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`S3 upload failed: ${response.status}`);
    }

    const data = await response.json();
    const result = Array.isArray(data) ? data[0] : data;

    if (result?.file_url) {
      console.log('[S3] Фото загружено:', result.file_url);
      return result.file_url;
    }

    throw new Error('Stage: S3_UPLOAD, Error: no file_url in response');
  } catch (error) {
    clearTimeout(timer);
    if (error.name === 'AbortError') {
      throw new Error('Stage: S3_UPLOAD, Error: timeout (S3 микросервис не отвечает)');
    }
    throw error;
  }
}

// Загрузка фото (с fallback)
export async function uploadToFal(file) {
  console.log('[Upload] Загрузка фото на S3...');
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

// Загрузка нескольких файлов на S3 параллельно
export async function uploadMultipleToFal(files) {
  return Promise.all(files.map((f) => uploadToFal(f)));
}

// =====================================================================
// ГЕНЕРАЦИЯ: ВСЕ РЕЖИМЫ ОТПРАВЛЯЮТ BASE64 НАПРЯМУЮ В WEBHOOK
// (S3 микросервис не работает — загрузку на S3 делает n8n backend)
// =====================================================================

// Запрос генерации аватарки (Kie.ai flux-2/pro-image-to-image)
export async function generateAvatar(userId, file, style, initData, creativity = 50, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };

  try {
    step('[1/3] Сжатие фото...');
    const compressedFile = await compressImage(file, 600, 0.80);

    step('[2/3] Подготовка фото...');
    const base64 = await fileToBase64(compressedFile);

    // Найти полный промпт стиля по ID
    const styleObj = STYLES.find(s => s.id === style);
    const stylePrompt = styleObj?.prompt || `${style} style portrait`;

    step('[3/3] Отправка на генерацию...');
    console.log('[Generate] stylize → sending base64 to /generate');
    const requestData = {
      user_id: userId,
      photo_base64: base64,
      mime_type: compressedFile.type || 'image/jpeg',
      file_name: compressedFile.name || 'photo.jpg',
      style: stylePrompt,
      creativity: creativity,
      init_data: initData,
    };

    const result = await apiRequest('generate', requestData, 180000, 0);

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

// Генерация из нескольких фото + промпт (base64 напрямую)
export async function generateMultiPhoto(userId, files, prompt, initData, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };

  try {
    step(`[1/3] Сжатие ${files.length} фото...`);
    const compressed = await Promise.all(files.map((f) => compressImage(f, 600, 0.80)));

    step(`[2/3] Подготовка ${compressed.length} фото...`);
    const photosBase64 = await Promise.all(compressed.map(async (f) => ({
      base64: await fileToBase64(f),
      mime_type: f.type || 'image/jpeg',
    })));

    step('[3/3] Отправка на генерацию...');
    console.log('[Generate] multi_photo → sending base64 to /generate-multi');
    const requestData = {
      user_id: userId,
      mode: 'multi_photo',
      photos_base64: photosBase64,
      prompt,
      init_data: initData,
    };

    return await apiRequest('generate-multi', requestData, 180000, 0);
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) throw error;
    throw new Error(`Stage: MULTI_PHOTO, Error: ${msg}`);
  }
}

// Генерация по референсу (base64 напрямую — n8n загружает на S3)
export async function generateStyleTransfer(userId, files, prompt, resolution, initData, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };

  try {
    step(`[1/3] Сжатие ${files.length} фото...`);
    const compressed = await Promise.all(files.map((f) => compressImage(f)));

    step(`[2/3] Подготовка ${compressed.length} фото...`);
    const photosBase64 = await Promise.all(compressed.map(async (f) => ({
      base64: await fileToBase64(f),
      mime_type: f.type || 'image/jpeg',
    })));

    step('[3/3] Отправка на генерацию...');
    console.log('[Generate] style_transfer → sending base64 to /generate-style-transfer');
    const requestData = {
      user_id: userId,
      mode: 'style_transfer',
      photos_base64: photosBase64,
      resolution: resolution || '2K',
      init_data: initData,
    };

    if (prompt && prompt.trim().length > 0) {
      requestData.prompt = prompt.trim();
    }

    return await apiRequest('generate-style-transfer', requestData, 300000, 0);
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
    step('[1/3] Сжатие фотографий...');
    const [compressedMain, compressedRef] = await Promise.all([
      compressImage(mainFile),
      compressImage(refFile),
    ]);

    step('[2/3] Подготовка фото...');
    const [mainBase64, refBase64] = await Promise.all([
      fileToBase64(compressedMain),
      fileToBase64(compressedRef),
    ]);

    step('[3/3] Отправка на генерацию через Gemini...');
    console.log('[Generate] gemini_style → sending base64 to /generate-gemini-style');
    const requestData = {
      user_id: userId,
      mode: 'gemini_style',
      photo_base64: mainBase64,
      style_ref_base64: refBase64,
      mime_type: 'image/jpeg',
      init_data: initData,
    };

    if (prompt && prompt.trim().length > 0) {
      requestData.prompt = prompt.trim();
    }

    return await apiRequest('generate-gemini-style', requestData, 120000, 0);
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) throw error;
    throw new Error(`Stage: GEMINI_STYLE, Error: ${msg}`);
  }
}

// Генерация видео из фото (base64 напрямую — n8n загружает на S3)
export async function generateVideo(userId, file, prompt, duration, options, initData, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };
  const { quality = 'std', sound = false, aspect = '9:16', lastFrameFile = null } = options || {};

  try {
    step('[1/3] Сжатие фото...');
    const compressedFile = await compressImage(file);

    step('[2/3] Подготовка фото...');
    const base64 = await fileToBase64(compressedFile);
    let lastFrameBase64 = null;
    if (lastFrameFile) {
      const compressedLast = await compressImage(lastFrameFile);
      lastFrameBase64 = await fileToBase64(compressedLast);
    }

    step('[3/3] Отправка на генерацию видео...');
    console.log('[Generate] photo_to_video → sending base64 to /generate-video');
    const requestData = {
      user_id: userId,
      mode: 'photo_to_video',
      photo_base64: base64,
      mime_type: compressedFile.type || 'image/jpeg',
      prompt,
      duration: String(duration),
      quality,
      sound,
      aspect_ratio: aspect,
      init_data: initData,
    };
    if (lastFrameBase64) requestData.last_frame_base64 = lastFrameBase64;

    return await apiRequest('generate-video', requestData, 300000, 0);
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) throw error;
    throw new Error(`Stage: VIDEO_GEN, Error: ${msg}`);
  }
}

// Lip Sync (base64 напрямую — n8n загружает на S3)
export async function generateLipSync(userId, photoFile, audioFile, prompt, initData, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };
  try {
    step('[1/3] Сжатие фото...');
    const compressed = await compressImage(photoFile);

    step('[2/3] Подготовка фото и аудио...');
    const [photoBase64, audioBase64] = await Promise.all([
      fileToBase64(compressed),
      fileToBase64(audioFile),
    ]);

    step('[3/3] Запуск Lip Sync...');
    console.log('[Generate] lip_sync → sending base64 to /generate-lip-sync');
    const requestData = {
      user_id: userId,
      mode: 'lip_sync',
      photo_base64: photoBase64,
      photo_mime_type: compressed.type || 'image/jpeg',
      audio_base64: audioBase64,
      audio_mime_type: audioFile.type || 'audio/mpeg',
      audio_file_name: audioFile.name || 'audio.mp3',
      prompt: prompt || '',
      init_data: initData,
    };

    return await apiRequest('generate-lip-sync', requestData, 300000, 0);
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) throw error;
    throw new Error(`Stage: LIP_SYNC, Error: ${msg}`);
  }
}

// Загрузка аудио на S3 (с таймаутом, используется как fallback)
async function uploadAudioToS3(file) {
  const base64 = await fileToBase64(file);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch('https://n8n.creativeanalytic.ru/s3-upload/upload-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photo_base64: base64,
        mime_type: file.type || 'audio/mpeg',
        file_name: file.name || 'audio.mp3',
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`S3 audio upload failed: ${response.status}`);
    const data = await response.json();
    const result = Array.isArray(data) ? data[0] : data;
    if (result?.file_url) {
      console.log('[S3] Audio uploaded:', result.file_url);
      return result.file_url;
    }
    throw new Error('Stage: S3_AUDIO_UPLOAD, Error: no file_url in response');
  } catch (error) {
    clearTimeout(timer);
    if (error.name === 'AbortError') {
      throw new Error('Stage: S3_AUDIO_UPLOAD, Error: timeout');
    }
    throw error;
  }
}

// Remove Background (base64 напрямую — n8n загружает на S3)
export async function generateRemoveBg(userId, file, initData, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };
  try {
    step('[1/2] Сжатие фото...');
    const compressed = await compressImage(file, 600, 0.80);

    step('[2/2] Удаление фона...');
    const base64 = await fileToBase64(compressed);
    console.log('[Generate] remove_bg → sending base64 to /generate-remove-bg');
    const requestData = {
      user_id: userId,
      mode: 'remove_bg',
      photo_base64: base64,
      mime_type: compressed.type || 'image/jpeg',
      init_data: initData,
    };
    return await apiRequest('generate-remove-bg', requestData, 120000, 0);
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) throw error;
    throw new Error(`Stage: REMOVE_BG, Error: ${msg}`);
  }
}

// Enhance / Upscale (base64 напрямую — n8n загружает на S3)
export async function generateEnhance(userId, file, initData, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };
  try {
    step('[1/2] Подготовка фото...');
    const compressed = await compressImage(file, 1024, 0.85);

    step('[2/2] Улучшение качества...');
    const base64 = await fileToBase64(compressed);
    console.log('[Generate] enhance → sending base64 to /generate-enhance');
    const requestData = {
      user_id: userId,
      mode: 'enhance',
      photo_base64: base64,
      mime_type: compressed.type || 'image/jpeg',
      init_data: initData,
    };
    return await apiRequest('generate-enhance', requestData, 120000, 0);
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) throw error;
    throw new Error(`Stage: ENHANCE, Error: ${msg}`);
  }
}

// Text to Image (без загрузки файлов)
export async function generateTextToImage(userId, prompt, initData, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };
  try {
    step('[1/2] Отправка промпта...');
    console.log('[Generate] text_to_image → sending to /generate-text-to-image');
    const requestData = { user_id: userId, mode: 'text_to_image', prompt, init_data: initData };
    step('[2/2] Генерация изображения...');
    return await apiRequest('generate-text-to-image', requestData, 180000, 0);
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

// История платежей пользователя
export async function getPaymentHistory(userId, initData) {
  return apiRequest('payment-history', { user_id: userId, init_data: initData }, 15000, 0);
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

// AI Фотосессия (10 фото по образу, nano-banana-pro)
export async function generatePhotosession(userId, file, theme, initData, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };

  try {
    step('[1/3] Сжатие фото...');
    const compressedFile = await compressImage(file);

    step('[2/3] Подготовка фото...');
    const base64 = await fileToBase64(compressedFile);

    step('[3/3] Запуск фотосессии...');
    console.log('[Generate] photosession → sending base64 to /generate-photosession');
    const requestData = {
      user_id: userId,
      mode: 'photosession',
      photo_base64: base64,
      mime_type: compressedFile.type || 'image/jpeg',
      theme,
      init_data: initData,
    };

    return await apiRequest('generate-photosession', requestData, 360000, 0);
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) throw error;
    throw new Error(`Stage: PHOTOSESSION, Error: ${msg}`);
  }
}

// NanoBanana Pro AI Avatar Generation (base64 напрямую)
export async function generateNanoBanana(userId, files, prompt, initData, onStep) {
  const step = (msg) => { if (onStep) onStep(msg); };

  try {
    step(`[1/3] Сжатие ${files.length} фото...`);
    const compressed = await Promise.all(files.map((f) => compressImage(f)));

    step(`[2/3] Подготовка ${compressed.length} фото...`);
    const photosBase64 = await Promise.all(compressed.map(async (f) => ({
      base64: await fileToBase64(f),
      mime_type: f.type || 'image/jpeg',
    })));

    step('[3/3] Отправка на генерацию AI-аватара...');
    console.log('[Generate] ai_magic → sending base64 to /generate-nanobanana');
    const requestData = {
      user_id: userId,
      mode: 'ai_magic',
      photos_base64: photosBase64,
      prompt: prompt || 'Professional high-quality portrait photo of this person, studio lighting, sharp focus',
      init_data: initData,
    };

    return await apiRequest('generate-nanobanana', requestData, 120000, 0);
  } catch (error) {
    const msg = error?.message || String(error);
    if (msg.includes('Stage:')) throw error;
    throw new Error(`Stage: NANOBANANA, Error: ${msg}`);
  }
}
