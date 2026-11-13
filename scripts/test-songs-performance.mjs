import assert from 'node:assert/strict';

// Run with test-v30-loader so Node resolves the extensionless Next.js library imports.
delete process.env.SONGS_API_BASE;
const { getTrendingSongs, getTrendingArtists, searchSongs, songsMirrors } = await import('../lib/songsServer.js');
let release;
const gate = new Promise((resolve) => { release = resolve; });
const calls = [];
const queryIds = new Map();
globalThis.fetch = async (url) => {
  calls.push(url);
  const query = new URL(url).searchParams.get('query');
  if (!queryIds.has(query)) queryIds.set(query, queryIds.size);
  const n = queryIds.get(query);
  await gate;
  return {
    ok: true,
    async json() {
      return { data: { results: Array.from({ length: 12 }, (_, i) => ({
        id: `track${n}${i}`, name: `Track ${n} ${i}`, artists: { primary: [{ name: `Artist ${n}` }] },
      })) } };
    },
  };
};

const songsPromise = getTrendingSongs(24);
const artistsPromise = getTrendingArtists(10);
await new Promise((resolve) => setImmediate(resolve));
assert.equal(calls.length, 6 * songsMirrors().length, 'overlapping trending songs/artists must share each mirror request');
assert.equal(new Set(calls).size, calls.length, 'no identical upstream URL is requested twice');
release();
const [songs, artists] = await Promise.all([songsPromise, artistsPromise]);
assert.equal(songs.length, 24);
assert.ok(artists.length > 0, 'artist results still work');
await getTrendingSongs(12);
assert.equal(calls.length, 6 * songsMirrors().length, 'a fresh trending result uses the cache');

let failed = 0;
globalThis.fetch = async () => { failed += 1; throw new Error('mirror offline'); };
await searchSongs('unique-unavailable-query', 12);
await searchSongs('unique-unavailable-query', 12);
assert.equal(failed, 2 * songsMirrors().length, 'failed mirror results are not permanently cached');
console.log('Songs performance: overlapping mirror requests deduplicated; failures remain retryable.');
