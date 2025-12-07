#!/usr/bin/env tsx
/**
 * Pre-Indexing Script
 *
 * Generates and stores embeddings for popular movies and TV shows
 * Run this before deployment to populate the vector database
 *
 * Usage:
 *   npm run pre-index              # Index 200 items (5 pages each)
 *   npm run pre-index -- --pages 10 # Index 400 items (10 pages each)
 *   npm run pre-index -- --full     # Index 1000 items (50 pages each)
 */

import 'dotenv/config';
import { getPopularMovies, getPopularTVShows } from '../src/lib/tmdb';
import { getContentEmbedding, batchStoreEmbeddings, getVectorCount } from '../src/lib/vector-search';
import type { MediaContent } from '../src/types/media';

// Parse command line arguments
const args = process.argv.slice(2);
const pagesArg = args.findIndex(arg => arg === '--pages');
const fullMode = args.includes('--full');

const PAGES_PER_TYPE = fullMode ? 50 : pagesArg !== -1 ? parseInt(args[pagesArg + 1]) : 5;
const BATCH_SIZE = 10; // Process embeddings in batches for better progress reporting

console.log('\n' + '='.repeat(70));
console.log('🎬 MEDIA DISCOVERY - PRE-INDEXING SCRIPT');
console.log('='.repeat(70));
console.log(`Mode: ${fullMode ? 'FULL' : 'STANDARD'}`);
console.log(`Pages per type: ${PAGES_PER_TYPE}`);
console.log(`Expected items: ~${PAGES_PER_TYPE * 20 * 2} (${PAGES_PER_TYPE * 20} movies + ${PAGES_PER_TYPE * 20} TV shows)`);
console.log('='.repeat(70) + '\n');

async function main() {
  const startTime = Date.now();

  try {
    // Check initial database state
    console.log('📊 Checking database status...');
    const initialCount = await getVectorCount();
    console.log(`   Current vectors: ${initialCount}\n`);

    // Step 1: Fetch Movies
    console.log(`🎬 Fetching popular movies (${PAGES_PER_TYPE} pages)...`);
    const movieBatches: any[] = [];
    for (let page = 1; page <= PAGES_PER_TYPE; page++) {
      const { results } = await getPopularMovies(page);
      movieBatches.push(...results);
      process.stdout.write(`   Progress: ${page}/${PAGES_PER_TYPE} pages (${movieBatches.length} movies)\r`);
    }
    console.log(`\n   ✓ Fetched ${movieBatches.length} movies\n`);

    // Step 2: Generate Movie Embeddings
    console.log('🧠 Generating movie embeddings...');
    const movieEmbeddings: Array<{ content: MediaContent; embedding: Float32Array }> = [];
    for (let i = 0; i < movieBatches.length; i++) {
      const movie = movieBatches[i];
      const text = `${movie.title}. ${movie.overview}`;
      const embedding = await getContentEmbedding(text);

      if (embedding) {
        movieEmbeddings.push({ content: movie as MediaContent, embedding });
      }

      // Progress update every item
      const percentage = ((i + 1) / movieBatches.length * 100).toFixed(1);
      process.stdout.write(`   Progress: ${i + 1}/${movieBatches.length} (${percentage}%)\r`);
    }
    console.log(`\n   ✓ Generated ${movieEmbeddings.length} movie embeddings\n`);

    // Step 3: Store Movie Embeddings
    console.log('💾 Storing movie embeddings...');
    await batchStoreEmbeddings(movieEmbeddings);
    console.log(`   ✓ Stored ${movieEmbeddings.length} movie embeddings\n`);

    // Step 4: Fetch TV Shows
    console.log(`📺 Fetching popular TV shows (${PAGES_PER_TYPE} pages)...`);
    const tvBatches: any[] = [];
    for (let page = 1; page <= PAGES_PER_TYPE; page++) {
      const { results } = await getPopularTVShows(page);
      tvBatches.push(...results);
      process.stdout.write(`   Progress: ${page}/${PAGES_PER_TYPE} pages (${tvBatches.length} shows)\r`);
    }
    console.log(`\n   ✓ Fetched ${tvBatches.length} TV shows\n`);

    // Step 5: Generate TV Show Embeddings
    console.log('🧠 Generating TV show embeddings...');
    const tvEmbeddings: Array<{ content: MediaContent; embedding: Float32Array }> = [];
    for (let i = 0; i < tvBatches.length; i++) {
      const show = tvBatches[i];
      const text = `${show.title}. ${show.overview}`;
      const embedding = await getContentEmbedding(text);

      if (embedding) {
        tvEmbeddings.push({ content: show as MediaContent, embedding });
      }

      // Progress update every item
      const percentage = ((i + 1) / tvBatches.length * 100).toFixed(1);
      process.stdout.write(`   Progress: ${i + 1}/${tvBatches.length} (${percentage}%)\r`);
    }
    console.log(`\n   ✓ Generated ${tvEmbeddings.length} TV show embeddings\n`);

    // Step 6: Store TV Show Embeddings
    console.log('💾 Storing TV show embeddings...');
    await batchStoreEmbeddings(tvEmbeddings);
    console.log(`   ✓ Stored ${tvEmbeddings.length} TV show embeddings\n`);

    // Final Stats
    const finalCount = await getVectorCount();
    const indexed = finalCount - initialCount;
    const duration = Date.now() - startTime;

    console.log('='.repeat(70));
    console.log('✅ PRE-INDEXING COMPLETE');
    console.log('='.repeat(70));
    console.log(`Movies indexed:     ${movieEmbeddings.length}`);
    console.log(`TV shows indexed:   ${tvEmbeddings.length}`);
    console.log(`Total new vectors:  ${indexed}`);
    console.log(`Database size:      ${finalCount} vectors`);
    console.log(`Duration:           ${Math.round(duration / 1000)}s (${duration}ms)`);
    console.log(`Avg per item:       ${Math.round(duration / indexed)}ms`);
    console.log('='.repeat(70) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Pre-indexing failed:', error);
    process.exit(1);
  }
}

main();
