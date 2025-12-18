/**
 * Request/Response caching for OpenRouter API calls
 *
 * This module provides caching to avoid hitting the API repeatedly during development.
 * Cache is keyed by a hash of the request body.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CACHE_DIR = join(__dirname, '../../../.cache/requests');

export interface CachedResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
}

export interface CacheEntry {
  request: {
    url: string;
    method: string;
    body: unknown;
  };
  response: CachedResponse;
}

/**
 * Generate a cache key from request details
 */
function getCacheKey(url: string, body: unknown): string {
  const hash = createHash('sha256');
  hash.update(url);
  hash.update(JSON.stringify(body));
  return hash.digest('hex').slice(0, 16);
}

/**
 * Get the cache file path for a given key
 */
function getCachePath(key: string): string {
  return join(CACHE_DIR, `${key}.json`);
}

/**
 * Check if a cached response exists and is valid
 */
export function getCachedResponse(url: string, body: unknown): CacheEntry | null {
  const key = getCacheKey(url, body);
  const cachePath = getCachePath(key);

  if (!existsSync(cachePath)) {
    return null;
  }

  try {
    const cached = JSON.parse(readFileSync(cachePath, 'utf-8')) as CacheEntry;
    return cached;
  } catch {
    return null;
  }
}

/**
 * Save a response to the cache
 */
export function cacheResponse(
  url: string,
  requestBody: unknown,
  response: CachedResponse,
): void {
  const key = getCacheKey(url, requestBody);
  const cachePath = getCachePath(key);

  // Ensure cache directory exists
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }

  const entry: CacheEntry = {
    request: {
      url,
      method: 'POST',
      body: requestBody,
    },
    response,
  };

  writeFileSync(cachePath, JSON.stringify(entry, null, 2));
}

/**
 * Create a cached fetch function for OpenRouter API calls
 *
 * @param options.enabled - Whether caching is enabled (default: true)
 * @param options.ttlMs - Cache TTL in milliseconds (default: 1 hour)
 * @returns A fetch function that caches responses
 */
export function createCachedFetch(
  options: { enabled?: boolean; ttlMs?: number } = {},
): typeof fetch {
  const { enabled = true, ttlMs = 60 * 60 * 1000 } = options;

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();

    // Only cache POST requests with JSON body
    if (!enabled || init?.method !== 'POST' || !init.body) {
      return fetch(input, init);
    }

    let requestBody: unknown;
    try {
      requestBody = JSON.parse(init.body as string);
    } catch {
      return fetch(input, init);
    }

    // Check cache
    const cached = getCachedResponse(url, requestBody);
    if (cached) {
      const age = Date.now() - cached.response.timestamp;
      if (age < ttlMs) {
        console.log(`[CACHE HIT] ${url} (age: ${Math.round(age / 1000)}s)`);
        return new Response(cached.response.body, {
          status: cached.response.status,
          statusText: cached.response.statusText,
          headers: cached.response.headers,
        });
      }
      console.log(`[CACHE EXPIRED] ${url}`);
    }

    // Make actual request
    console.log(`[CACHE MISS] ${url}`);
    const response = await fetch(input, init);

    // Clone response to read body without consuming it
    const clone = response.clone();
    const body = await clone.text();

    // Cache the response
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    cacheResponse(url, requestBody, {
      status: response.status,
      statusText: response.statusText,
      headers,
      body,
      timestamp: Date.now(),
    });

    // Return a new response with the same body
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

/**
 * Truncate base64 data in objects for logging
 */
export function truncateForLog(obj: unknown, maxLen = 100): unknown {
  if (typeof obj === 'string') {
    return obj.length > maxLen ? obj.slice(0, maxLen) + `... [${obj.length} chars]` : obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => truncateForLog(item, maxLen));
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = truncateForLog(value, maxLen);
    }
    return result;
  }
  return obj;
}
