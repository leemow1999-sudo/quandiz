import * as claude from './claude.js';
import * as google from './google.js';

export const PROVIDERS = { claude, google };

export function getProvider(name) {
  return PROVIDERS[name];
}

export function providerStatus() {
  return Object.values(PROVIDERS).map((p) => ({
    name: p.name,
    ready: p.isConfigured(),
  }));
}
