export const REAL_ESTATE_DISCLAIMER = 'Визуализация возможного ремонта. Реальное состояние объекта может отличаться.';

export const ROOM_TYPES = [
  { id: 'auto', name: 'Определить автоматически', hint: 'AI сам выберет тип помещения' },
  { id: 'living_room', name: 'Гостиная', hint: 'Главная комната, зал, общая зона' },
  { id: 'kitchen', name: 'Кухня', hint: 'Кухня или кухня-гостиная' },
  { id: 'bedroom', name: 'Спальня', hint: 'Комната отдыха' },
  { id: 'kids_room', name: 'Детская', hint: 'Комната для ребёнка' },
  { id: 'bathroom', name: 'Ванная', hint: 'Ванная или санузел' },
  { id: 'hallway', name: 'Прихожая', hint: 'Коридор, холл, входная зона' },
  { id: 'studio', name: 'Студия', hint: 'Открытая планировка' },
  { id: 'commercial', name: 'Коммерческое', hint: 'Офис, салон, помещение под бизнес' },
];

export const RENOVATION_STYLES = [
  {
    id: 'modern_bright',
    name: 'Современный светлый',
    hint: 'Светлые стены, аккуратная мебель, простор и чистота',
  },
  {
    id: 'scandinavian',
    name: 'Скандинавский',
    hint: 'Дерево, белый фон, спокойный уют',
  },
  {
    id: 'minimalism',
    name: 'Минимализм',
    hint: 'Меньше деталей, больше воздуха',
  },
  {
    id: 'premium',
    name: 'Премиум',
    hint: 'Дорогие материалы, выразительный свет',
  },
  {
    id: 'rental_ready',
    name: 'Для аренды',
    hint: 'Практично, свежо, универсально',
  },
  {
    id: 'cosmetic_fast',
    name: 'Косметический ремонт',
    hint: 'Быстро освежить без капитальных изменений',
  },
  {
    id: 'family_warm',
    name: 'Тёплый семейный',
    hint: 'Мягкий свет, уют, жилое ощущение',
  },
  {
    id: 'neutral_sale',
    name: 'Нейтральный для продажи',
    hint: 'Подойдёт большинству покупателей',
  },
];

export const DEFAULT_ROOM_TYPE = 'auto';
export const DEFAULT_RENOVATION_STYLE = 'modern_bright';

export const EMPTY_OBJECT_INFO = {
  city: '',
  district: '',
  rooms: '',
  area: '',
  floor: '',
  price: '',
  highlights: '',
};
