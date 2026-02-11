export const MODES = {
  stylize: {
    id: 'stylize',
    name: 'Стилизация',
    emoji: '🎨',
    description: 'Преврати фото в арт',
    starCost: 5,
    hasFree: true,
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
    starCost: 7,
    hasFree: false,
    resultType: 'image',
    endpoint: 'generate-style-transfer',
  },
  photo_to_video: {
    id: 'photo_to_video',
    name: 'Фото в видео',
    emoji: '🎬',
    description: 'Оживи фото в видео',
    starCost: { 6: 25, 10: 50 },
    hasFree: false,
    resultType: 'video',
    endpoint: 'generate-video',
  },
};

export const MODE_LIST = Object.values(MODES);
export const DEFAULT_MODE = 'stylize';

export function getStarCost(modeId, options = {}) {
  const mode = MODES[modeId];
  if (!mode) return 0;
  if (typeof mode.starCost === 'number') return mode.starCost;
  if (typeof mode.starCost === 'object' && options.duration) {
    return mode.starCost[options.duration] || 25;
  }
  return 25;
}
