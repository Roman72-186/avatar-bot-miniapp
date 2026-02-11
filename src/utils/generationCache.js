const STORAGE_KEY = 'avatar_generations';
const MAX_ITEMS = 20;

export function saveGeneration({ mode, result_type, result_url, prompt }) {
  try {
    const items = getGenerations();
    items.unshift({
      mode,
      result_type,
      result_url,
      prompt: prompt || '',
      created_at: new Date().toISOString(),
    });
    if (items.length > MAX_ITEMS) items.length = MAX_ITEMS;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    // localStorage может быть недоступен
  }
}

export function getGenerations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function getLastGeneration() {
  const items = getGenerations();
  return items.length > 0 ? items[0] : null;
}
