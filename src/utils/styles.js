// Конфигурация стилей генерации
// Каждый стиль маппится на конкретную модель/промпт fal.ai

export const STYLES = [
  {
    id: 'anime',
    name: 'Аниме',
    emoji: '🌸',
    description: 'Стиль японской анимации',
    prompt: 'anime style portrait, same person, preserve gender and facial features, high quality anime art, detailed anime face, vibrant colors, studio ghibli inspired',
    color: '#FF6B9D',
    premium: false,
  },
  {
    id: 'pixel',
    name: 'Пиксель-арт',
    emoji: '👾',
    description: '8-bit ретро стиль',
    prompt: 'pixel art portrait, same person, preserve gender, retro 8-bit style, pixelated face, vibrant pixel colors, game character portrait, detailed pixel art',
    color: '#00D4AA',
    premium: false,
  },
  {
    id: 'gta',
    name: 'GTA',
    emoji: '🔫',
    description: 'В стиле загрузочных экранов GTA',
    prompt: 'GTA V loading screen art style portrait, same person, preserve gender, grand theft auto art, comic book style, bold outlines, saturated colors, rockstar games art style, urban background',
    color: '#FF8C00',
    premium: false,
  },
  {
    id: '3d_cartoon',
    name: '3D Мультяшный',
    emoji: '🧸',
    description: 'Стиль Pixar / Disney',
    prompt: '3D cartoon character portrait, same person, preserve gender and age, pixar style, disney animation style, soft lighting, detailed 3d render, smooth skin, expressive eyes',
    color: '#7C5CFC',
    premium: false,
  },
];

// Модель fal.ai для генерации
export const FAL_MODEL = 'fal-ai/face-to-sticker';

// Параметры генерации по умолчанию
export const GENERATION_DEFAULTS = {
  num_inference_steps: 20,
  guidance_scale: 4.5,
  instant_id_strength: 0.7,
  ip_adapter_weight: 0.2,
  image_size: 'square', // 512x512 - оптимально для Telegram WebApp
};

// Лимиты
export const FREE_GENERATIONS_PER_DAY = 3;
export const STARS_PER_GENERATION = 5;
