/**
 * Voice Preference Analysis API
 * Analyzes conversation history and generates recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeConversation, profileToSearchQuery, type UserResponse } from '@/lib/preference-analyzer';
import { semanticSearch } from '@/lib/natural-language-search';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { responses } = body as { responses: UserResponse[] };

    if (!responses || !Array.isArray(responses) || responses.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: responses array required' },
        { status: 400 }
      );
    }

    console.log(`🎤 Analyzing ${responses.length} user responses...`);

    // Analyze conversation
    const analysis = await analyzeConversation(responses);

    console.log('📊 Analysis complete:', {
      genres: analysis.profile.genres,
      moods: analysis.profile.moods,
      enthusiasmLevel: analysis.profile.enthusiasmLevel,
      engagementScore: analysis.engagementScore,
    });

    // Generate search query from profile
    const searchQuery = profileToSearchQuery(analysis.profile);
    console.log(`🔍 Generated search query: "${searchQuery}"`);

    // Get recommendations using semantic search
    const recommendations = await semanticSearch(
      searchQuery,
      analysis.profile.genres.length > 0 ? undefined : undefined // Can pass genre IDs if needed
    );

    // Filter and rank by profile fit
    const rankedRecommendations = recommendations
      .slice(0, 20) // Top 20 candidates
      .map(rec => ({
        ...rec,
        profileFit: calculateProfileFit(rec, analysis.profile),
      }))
      .sort((a, b) => b.profileFit - a.profileFit)
      .slice(0, 10); // Top 10 final recommendations

    return NextResponse.json({
      success: true,
      analysis: {
        profile: analysis.profile,
        insights: analysis.keyInsights,
        sentimentTrend: analysis.sentimentTrend,
        engagementScore: analysis.engagementScore,
      },
      recommendations: rankedRecommendations,
      metadata: {
        searchQuery,
        totalResponses: responses.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Voice preference analysis error:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze preferences',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate how well a recommendation fits the user's profile
 */
function calculateProfileFit(rec: any, profile: any): number {
  let score = rec.relevance || 0.5; // Base relevance

  // Boost for media type match
  if (profile.mediaType !== 'all' && rec.mediaType === profile.mediaType) {
    score += 0.1;
  }

  // Boost for high ratings if user has positive sentiment
  if (profile.enthusiasmLevel > 0.6 && rec.voteAverage > 7.5) {
    score += 0.15;
  }

  // Penalty for elements to avoid
  if (profile.avoidElements && profile.avoidElements.length > 0) {
    // This would require checking against content warnings, genres, etc.
    // Simplified for now
  }

  return Math.min(score, 1.0);
}
