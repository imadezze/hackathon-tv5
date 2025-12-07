/**
 * Content Indexing API
 * POST /api/index-content
 *
 * Pre-populates the vector database with popular movies and TV shows
 * This dramatically speeds up semantic search by avoiding real-time indexing
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPopularMovies, getPopularTVShows } from '@/lib/tmdb';
import { getContentEmbedding, batchStoreEmbeddings, getVectorCount } from '@/lib/vector-search';
import type { MediaContent } from '@/types/media';

interface IndexProgress {
  phase: string;
  current: number;
  total: number;
  percentage: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const progress: IndexProgress[] = [];

  try {
    console.log('🚀 Starting content indexing...');

    // Check current database size
    const initialCount = await getVectorCount();
    console.log(`📊 Current vectors in database: ${initialCount}`);

    // Index popular movies (top 5 pages = 100 movies)
    console.log('🎬 Indexing popular movies...');
    const movieBatches = [];
    for (let page = 1; page <= 5; page++) {
      const { results } = await getPopularMovies(page);
      movieBatches.push(...results);
      progress.push({
        phase: 'movies',
        current: page,
        total: 5,
        percentage: (page / 5) * 100,
      });
      console.log(`  Page ${page}/5: ${results.length} movies`);
    }

    // Generate embeddings for movies
    console.log('🧠 Generating movie embeddings...');
    const movieEmbeddings = [];
    for (let i = 0; i < movieBatches.length; i++) {
      const movie = movieBatches[i];
      const text = `${movie.title}. ${movie.overview}`;
      const embedding = await getContentEmbedding(text);

      if (embedding) {
        movieEmbeddings.push({ content: movie as MediaContent, embedding });
      }

      if ((i + 1) % 10 === 0) {
        console.log(`  Generated ${i + 1}/${movieBatches.length} movie embeddings`);
      }
    }

    // Store movie embeddings
    console.log('💾 Storing movie embeddings...');
    await batchStoreEmbeddings(movieEmbeddings);

    // Index popular TV shows (top 5 pages = 100 shows)
    console.log('📺 Indexing popular TV shows...');
    const tvBatches = [];
    for (let page = 1; page <= 5; page++) {
      const { results } = await getPopularTVShows(page);
      tvBatches.push(...results);
      progress.push({
        phase: 'tv',
        current: page,
        total: 5,
        percentage: (page / 5) * 100,
      });
      console.log(`  Page ${page}/5: ${results.length} TV shows`);
    }

    // Generate embeddings for TV shows
    console.log('🧠 Generating TV show embeddings...');
    const tvEmbeddings = [];
    for (let i = 0; i < tvBatches.length; i++) {
      const show = tvBatches[i];
      const text = `${show.title}. ${show.overview}`;
      const embedding = await getContentEmbedding(text);

      if (embedding) {
        tvEmbeddings.push({ content: show as MediaContent, embedding });
      }

      if ((i + 1) % 10 === 0) {
        console.log(`  Generated ${i + 1}/${tvBatches.length} TV embeddings`);
      }
    }

    // Store TV show embeddings
    console.log('💾 Storing TV show embeddings...');
    await batchStoreEmbeddings(tvEmbeddings);

    // Final count
    const finalCount = await getVectorCount();
    const indexed = finalCount - initialCount;
    const duration = Date.now() - startTime;

    console.log(`✅ Indexing complete!`);
    console.log(`   - Indexed: ${indexed} items`);
    console.log(`   - Total vectors: ${finalCount}`);
    console.log(`   - Duration: ${duration}ms`);

    return NextResponse.json({
      success: true,
      indexed: {
        movies: movieEmbeddings.length,
        tv: tvEmbeddings.length,
        total: indexed,
      },
      database: {
        initialCount,
        finalCount,
      },
      duration: {
        ms: duration,
        seconds: Math.round(duration / 1000),
      },
    });
  } catch (error) {
    console.error('❌ Indexing error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Indexing failed',
        progress,
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check indexing status
export async function GET() {
  try {
    const count = await getVectorCount();

    return NextResponse.json({
      success: true,
      vectorCount: count,
      status: count > 0 ? 'indexed' : 'empty',
      recommendation: count === 0 ? 'Run POST /api/index-content to populate database' : 'Database ready',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get database status',
      },
      { status: 500 }
    );
  }
}
