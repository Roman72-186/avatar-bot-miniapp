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

export function getPrimaryResultUrl(item) {
  const metadata = item?.metadata || {};
  const imageUrls = item?.image_urls || metadata.image_urls || [];
  return item?.result_url || item?.video_url || metadata.video_url || imageUrls[0] || '';
}

export function saveGeneration({
  mode,
  result_type,
  result_url,
  image_urls,
  video_url,
  listing_text,
  prompt,
  metadata,
}) {
  try {
    const items = filterExpired(getGenerationsRaw());
    const normalizedMetadata = metadata || {};
    const normalizedImageUrls = image_urls || normalizedMetadata.image_urls || [];
    items.unshift({
      mode,
      result_type,
      result_url: result_url || video_url || normalizedImageUrls[0] || '',
      image_urls: normalizedImageUrls,
      video_url: video_url || normalizedMetadata.video_url || '',
      listing_text: listing_text || normalizedMetadata.listing_text || '',
      prompt: prompt || '',
      metadata: normalizedMetadata,
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
    const items = getGenerationsRaw().filter(item => {
      if (!result_url) return true;
      const metadata = item?.metadata || {};
      const urls = [
        item.result_url,
        item.video_url,
        metadata.video_url,
        ...(item.image_urls || []),
        ...(metadata.image_urls || []),
      ].filter(Boolean);
      return !urls.includes(result_url);
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    // ignore
  }
}
