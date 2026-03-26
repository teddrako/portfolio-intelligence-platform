/**
 * SSR/Edge-safe polyfills for Next.js 15.
 * DO NOT import node-only modules like 'path' or 'fs' here as it will
 * break the frontend hydration build.
 */
export function register() {
  if (typeof globalThis !== 'undefined') {
    const _g = globalThis as any;
    const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
    if (isNode || typeof window === 'undefined') {
      if (!_g.localStorage || typeof _g.localStorage.getItem !== 'function') {
        _g.localStorage = {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
          clear: () => {},
          key: () => null,
          length: 0,
        };
      }
    }
  }
}
