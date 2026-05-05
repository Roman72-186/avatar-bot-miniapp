export const LEGACY_MODES = {
  stylize: {
    id: 'stylize',
    name: 'Стилизация',
    emoji: '🎨',
    description: 'Преврати фото в арт',
    starCost: 8,
    hasFree: true,
    freeKey: 'free_stylize',
    resultType: 'image',
    endpoint: 'generate',
  },
  multi_photo: {
    id: 'multi_photo',
    name: 'Мульти-фото',
    emoji: '🖼️',
    description: 'Объедини 2–4 фото с промптом',
    starCost: 10,
    hasFree: false,
    resultType: 'image',
    endpoint: 'generate-multi',
    minPhotos: 2,
    maxPhotos: 4,
  },
  style_transfer: {
    id: 'style_transfer',
    name: 'По референсу',
    emoji: '🪄',
    description: 'Перенеси стиль с референса',
    starCost: { '2_2K': 30, '2_4K': 40, '3_2K': 30, '3_4K': 40 },
    hasFree: false,
    resultType: 'image',
    endpoint: 'generate-style-transfer',
    minPhotos: 1,
    maxPhotos: 4,
  },
  photo_to_video: {
    id: 'photo_to_video',
    name: 'Фото в видео',
    emoji: '🎬',
    description: 'Оживи фото в видео',
    starCost: {
      '5_std_off': 155, '5_std_on': 235, '5_pro_off': 210, '5_pro_on': 310,
      '10_std_off': 310, '10_std_on': 465, '10_pro_off': 420, '10_pro_on': 620,
    },
    hasFree: false,
    resultType: 'video',
    endpoint: 'generate-video',
  },
  lip_sync: {
    id: 'lip_sync',
    name: 'Lip Sync',
    emoji: '🗣️',
    description: 'Фото говорит твоим голосом',
    starCost: 250,
    hasFree: false,
    resultType: 'video',
    endpoint: 'generate-lip-sync',
  },
  remove_bg: {
    id: 'remove_bg',
    name: 'Убрать фон',
    emoji: '✂️',
    description: 'Удали фон с фотографии',
    starCost: 3,
    hasFree: true,
    freeKey: 'free_remove_bg',
    resultType: 'image',
    endpoint: 'generate-remove-bg',
  },
  enhance: {
    id: 'enhance',
    name: 'Улучшить',
    emoji: '✨',
    description: 'Улучши качество фото',
    starCost: 8,
    hasFree: true,
    freeKey: 'free_enhance',
    resultType: 'image',
    endpoint: 'generate-enhance',
  },
  text_to_image: {
    id: 'text_to_image',
    name: 'Текст в фото',
    emoji: '💬',
    description: 'Создай изображение по описанию',
    starCost: 8,
    hasFree: true,
    freeKey: 'free_text_to_image',
    resultType: 'image',
    endpoint: 'generate-text-to-image',
  },
  photosession: {
    id: 'photosession',
    name: 'Фотосессия',
    emoji: '📸',
    description: 'AI фотосессия — 10 фото по вашему образу',
    starCost: 200,
    hasFree: false,
    resultType: 'image',
    endpoint: 'generate-photosession',
    minPhotos: 1,
    maxPhotos: 2,
  },
};

export const MODES = {
  real_estate_renovation: {
    id: 'real_estate_renovation',
    name: 'AI-ремонт',
    emoji: '🏠',
    description: 'Визуализация ремонта и мебели по фото комнаты',
    starCost: 8,
    hasFree: false,
    resultType: 'image',
    endpoint: 'generate',
    minPhotos: 1,
    maxPhotos: 1,
  },
  real_estate_enhance: {
    id: 'real_estate_enhance',
    name: 'Улучшить фото',
    emoji: '📷',
    description: 'Свет, резкость и цвет без изменения планировки и мебели',
    starCost: 8,
    hasFree: false,
    resultType: 'image',
    endpoint: 'generate-enhance',
    minPhotos: 1,
    maxPhotos: 1,
  },
  real_estate_video: {
    id: 'real_estate_video',
    name: 'Видео объекта',
    emoji: '🎥',
    description: 'Вертикальный ролик для объявления из 3–10 фото',
    starCost: 155,
    hasFree: false,
    resultType: 'video',
    endpoint: 'generate-video',
    minPhotos: 3,
    maxPhotos: 10,
  },
  real_estate_listing_text: {
    id: 'real_estate_listing_text',
    name: 'Текст объявления',
    emoji: '📝',
    description: 'Продающий текст для Авито, Циан, Домклик или Telegram',
    starCost: 0,
    hasFree: false,
    resultType: 'text',
    endpoint: 'local-listing-text',
  },
  real_estate_full_package: {
    id: 'real_estate_full_package',
    name: 'Полный пакет',
    emoji: '💼',
    description: 'AI-фото, видео объекта и готовый текст объявления',
    starCost: 155,
    hasFree: false,
    resultType: 'mixed',
    endpoint: 'generate-video',
    minPhotos: 3,
    maxPhotos: 10,
  },
};

export const MODE_LIST = Object.values(MODES);
export const DEFAULT_MODE = 'real_estate_renovation';

export function getStarCost(modeId, options = {}) {
  const mode = MODES[modeId] || LEGACY_MODES[modeId];
  if (!mode) return 0;
  if (typeof mode.starCost === 'number') return mode.starCost;
  if (typeof mode.starCost === 'object') {
    if (modeId === 'style_transfer') {
      const photoCount = options.photoCount || 2;
      const resolution = options.resolution || '2K';
      const bucket = photoCount <= 2 ? '2' : '3';
      return mode.starCost[`${bucket}_${resolution}`] || 30;
    }
    if (options.duration && options.videoQuality !== undefined) {
      const key = `${options.duration}_${options.videoQuality}_${options.videoSound ? 'on' : 'off'}`;
      return mode.starCost[key] || 155;
    }
  }
  return 25;
}
