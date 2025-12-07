/**
 * Content Discovery Agent
 *
 * Responsibilities:
 * - Natural language query understanding
 * - Semantic search across content database
 * - Mood and context interpretation
 * - Genre and theme extraction
 */

import { semanticSearch, parseSearchQuery } from '@/lib/natural-language-search';

export interface DiscoveryQuery {
  text: string;
  context?: {
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
    dayOfWeek?: string;
    mood?: string;
    occasion?: string;
  };
  filters?: {
    mediaType?: 'movie' | 'tv' | 'all';
    genres?: number[];
    ratingMin?: number;
  };
}

export interface DiscoveryResult {
  id: number;
  title: string;
  mediaType: 'movie' | 'tv';
  overview: string;
  genres: number[];
  rating: number;
  releaseDate: string;
  matchScore: number;
  matchReasons: string[];
}

export class ContentDiscoveryAgent {
  private name = 'content-discovery-agent';
  private version = '1.0.0';

  /**
   * Discover content based on natural language query
   */
  async discover(query: DiscoveryQuery): Promise<DiscoveryResult[]> {
    console.log(`[${this.name}] Processing query:`, query.text);

    // Parse the query to understand intent
    const parsed = await parseSearchQuery(query.text);

    // Enhance query with context
    const enhancedQuery = this.enhanceQueryWithContext(query);

    // Perform semantic search
    const results = await semanticSearch(enhancedQuery, query.filters?.genres);

    // Score and rank results
    const rankedResults = this.rankResults(results, query);

    console.log(`[${this.name}] Found ${rankedResults.length} results`);

    return rankedResults;
  }

  /**
   * Enhance query with contextual information
   */
  private enhanceQueryWithContext(query: DiscoveryQuery): string {
    let enhanced = query.text;

    // Add time-of-day context
    if (query.context?.timeOfDay === 'night') {
      enhanced += ' suitable for evening viewing';
    } else if (query.context?.timeOfDay === 'morning') {
      enhanced += ' light and uplifting';
    }

    // Add day-of-week context
    if (query.context?.dayOfWeek === 'Friday' || query.context?.dayOfWeek === 'Saturday') {
      enhanced += ' perfect for weekend watching';
    }

    // Add mood context
    if (query.context?.mood) {
      enhanced += ` matching ${query.context.mood} mood`;
    }

    return enhanced;
  }

  /**
   * Rank results based on multiple factors
   */
  private rankResults(results: any[], query: DiscoveryQuery): DiscoveryResult[] {
    return results.map(result => ({
      id: result.id,
      title: result.title || result.name,
      mediaType: result.media_type as 'movie' | 'tv',
      overview: result.overview || '',
      genres: result.genre_ids || [],
      rating: result.vote_average || 0,
      releaseDate: result.release_date || result.first_air_date || '',
      matchScore: result.matchScore || 0,
      matchReasons: result.matchReasons || [],
    }))
    .sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Get agent metadata
   */
  getMetadata() {
    return {
      name: this.name,
      version: this.version,
      capabilities: [
        'natural-language-understanding',
        'semantic-search',
        'context-awareness',
        'genre-extraction',
      ],
    };
  }
}

export const contentDiscoveryAgent = new ContentDiscoveryAgent();
