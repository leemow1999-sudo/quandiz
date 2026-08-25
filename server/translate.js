import { config } from './config.js';
import { createCache } from './cache.js';
import { getProvider } from './providers/index.js';
import { isUntranslatable, resolveDirection } from './lang.js';

const cache = createCache(config.cacheSize);

function cacheKey({ text, source, target, provider }) {
  return `${provider}|${source}>${target}|${text}`;
}

/**
 * Chuỗi provider sẽ thử: provider chính -> provider dự phòng.
 * Provider chưa cấu hình (vd. claude thiếu API key) bị bỏ qua.
 */
function providerChain() {
  const names = [config.provider, config.fallbackProvider];
  const chain = [];
  for (const name of names) {
    const provider = getProvider(name);
    if (provider && provider.isConfigured() && !chain.includes(provider)) {
      chain.push(provider);
    }
  }
  return chain;
}

export function availableProviders() {
  return providerChain().map((p) => p.name);
}

export async function translateText({ text, direction = 'auto', context = [] }) {
  const trimmed = String(text ?? '').trim();

  if (!trimmed) {
    const err = new Error('Chưa có nội dung để dịch.');
    err.status = 400;
    throw err;
  }
  if (trimmed.length > config.maxInputChars) {
    const err = new Error(`Tin nhắn quá dài (tối đa ${config.maxInputChars} ký tự).`);
    err.status = 413;
    throw err;
  }

  const { source, target } = resolveDirection(trimmed, direction);

  // Chỉ có số / ký hiệu / link -> giữ nguyên, khỏi tốn một lượt gọi API.
  if (isUntranslatable(trimmed)) {
    return { original: trimmed, translated: trimmed, source, target, provider: 'passthrough', cached: false };
  }

  const chain = providerChain();
  if (chain.length === 0) {
    const err = new Error(
      'Chưa có công cụ dịch nào khả dụng. Đặt ANTHROPIC_API_KEY trong file .env hoặc chuyển TRANSLATE_PROVIDER=google.'
    );
    err.status = 503;
    throw err;
  }

  const trimmedContext = Array.isArray(context) ? context.slice(-config.contextTurns) : [];
  const errors = [];

  for (const provider of chain) {
    const key = cacheKey({ text: trimmed, source, target, provider: provider.name });
    const hit = cache.get(key);
    if (hit) {
      return { ...hit, original: trimmed, source, target, cached: true };
    }

    try {
      const result = await provider.translate({ text: trimmed, source, target, context: trimmedContext });
      // Chỉ cache khi không kèm ngữ cảnh — có ngữ cảnh thì cùng câu có thể ra khác.
      if (trimmedContext.length === 0) cache.set(key, result);
      return { ...result, original: trimmed, source, target, cached: false };
    } catch (err) {
      errors.push(`${provider.name}: ${err.message}`);
    }
  }

  const err = new Error(`Dịch thất bại. ${errors.join(' | ')}`);
  err.status = 502;
  throw err;
}

export function clearCache() {
  cache.clear();
}
