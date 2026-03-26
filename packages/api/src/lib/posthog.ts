import { PostHog } from "posthog-node";

// Guard: PostHog throws synchronously if the key is missing, which crashes the
// module at import time in local dev. Only instantiate when the key exists.
function createPostHog() {
  const key = process.env.POSTHOG_KEY;
  if (!key) return null;
  return new PostHog(key, {
    host: process.env.POSTHOG_HOST,
    enableExceptionAutocapture: true,
  });
}

const _client = createPostHog();

// Proxy that silently no-ops every method when PostHog is unconfigured so that
// callers never need to null-check.
export const posthog: PostHog = _client ?? (new Proxy({} as PostHog, {
  get: () => () => undefined,
}));
