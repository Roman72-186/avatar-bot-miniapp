export const MODES = {
  stylize: {
    id: 'stylize',
    name: 'Стилизация',
    emoji: '🎨',
    description: 'Преврати фото в арт',
    starCost: 5,
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
    starCost: { '2_2K': 8, '2_4K': 16, '3_2K': 12, '3_4K': 24 },
    hasFree: false,
    resultType: 'image',
    endpoint: 'generate-style-transfer',
    minPhotos: 2,
    maxPhotos: 4,
  },
  photo_to_video: {
    id: 'photo_to_video',
    name: 'Фото в видео',
    emoji: '🎬',
    description: 'Оживи фото в видео',
    starCost: {
      '5_std_off': 50, '5_std_on': 70, '5_pro_off': 65, '5_pro_on': 95,
      '10_std_off': 100, '10_std_on': 140, '10_pro_off': 130, '10_pro_on': 190,
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
    starCost: 50,
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
    starCost: 6,
    hasFree: false,
    resultType: 'image',
    endpoint: 'generate-text-to-image',
  },
  // ai_magic: {
  //   id: 'ai_magic',
  //   name: 'AI Магия',
  //   emoji: '🌟',
  //   description: 'AI-аватары по фото',
  //   starCost: 15,
  //   hasFree: false,
  //   resultType: 'image',
  //   endpoint: 'generate-nanobanana',
  //   minPhotos: 2,
  //   maxPhotos: 8,
  // },
};

export const MODE_LIST = Object.values(MODES);
export const DEFAULT_MODE = 'stylize';

export function getStarCost(modeId, options = {}) {
  const mode = MODES[modeId];
  if (!mode) return 0;
  if (typeof mode.starCost === 'number') return mode.starCost;
  if (typeof mode.starCost === 'object') {
    // Video pricing: duration + quality + sound
    if (options.duration && options.videoQuality !== undefined) {
      const key = `${options.duration}_${options.videoQuality}_${options.videoSound ? 'on' : 'off'}`;
      return mode.starCost[key] || 50;
    }
    // Style transfer: photoCount + resolution
    if (options.photoCount !== undefined && options.resolution) {
      const bucket = options.photoCount <= 2 ? '2' : '3';
      return mode.starCost[`${bucket}_${options.resolution}`] || 8;
    }
  }
  return 25;
}
