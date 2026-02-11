const STORAGE_KEY = 'avatar_generations';
const MAX_ITEMS = 20;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function filterExpired(items) {
  const cutoff = Date.now() - TTL_MS;
  return items.filter(item => {
    try {
      return new Date(item.created_at).getTime() > cutoff;
    } catch {
      return false;
    }
  });
}

export function saveGeneration({ mode, result_type, result_url, prompt }) {
  try {
    const items = filterExpired(getGenerationsRaw());
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

function getGenerationsRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function getGenerations() {
  return filterExpired(getGenerationsRaw());
}

export function getLastGeneration() {
  const items = getGenerations();
  return items.length > 0 ? items[0] : null;
}

export function deleteGenerationByUrl(result_url) {
  try {
    const items = getGenerationsRaw().filter(item => item.result_url !== result_url);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    // ignore
  }
}
