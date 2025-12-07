/**
 * Preference Analyzer
 * Combines user responses and sentiment analysis to build preference profile
 */

import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

// User response from voice conversation
export interface UserResponse {
  transcript: string;
  timestamp: number;
  sentiment?: {
    sentiment: 'positive' | 'negative' | 'neutral';
    sentiment_score: number;
  };
}

// Schema for analyzed preferences
const PreferenceProfileSchema = z.object({
  genres: z.array(z.string()).describe('Preferred genres based on conversation'),
  moods: z.array(z.string()).describe('Emotional preferences'),
  themes: z.array(z.string()).describe('Story themes they enjoy'),
  mediaType: z.enum(['movie', 'tv', 'all']).describe('Format preference'),
  pacing: z.enum(['slow', 'medium', 'fast']).optional(),
  era: z.string().optional().describe('Time period preference'),
  avoidElements: z.array(z.string()).optional().describe('Things to avoid'),
  viewingContext: z.string().optional().describe('Viewing situation'),
  enthusiasmLevel: z.number().min(0).max(1).describe('Overall enthusiasm (0-1)'),
  confidenceScore: z.number().min(0).max(1).describe('Confidence in preferences'),
});

export type PreferenceProfile = z.infer<typeof PreferenceProfileSchema>;

export interface ConversationAnalysis {
  profile: PreferenceProfile;
  keyInsights: string[];
  sentimentTrend: 'improving' | 'declining' | 'stable';
  engagementScore: number;
}

/**
 * Analyze conversation history and build preference profile
 */
export async function analyzeConversation(
  responses: UserResponse[]
): Promise<ConversationAnalysis> {
  // Calculate sentiment trend
  const sentimentScores = responses
    .map(r => r.sentiment?.sentiment_score || 0)
    .filter(s => s !== 0);

  const avgSentiment = sentimentScores.length > 0
    ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
    : 0;

  const earlyAvg = sentimentScores.slice(0, Math.ceil(sentimentScores.length / 2))
    .reduce((a, b) => a + b, 0) / Math.max(1, Math.ceil(sentimentScores.length / 2));

  const lateAvg = sentimentScores.slice(Math.floor(sentimentScores.length / 2))
    .reduce((a, b) => a + b, 0) / Math.max(1, Math.floor(sentimentScores.length / 2));

  const sentimentTrend = lateAvg > earlyAvg + 0.1 ? 'improving'
    : lateAvg < earlyAvg - 0.1 ? 'declining'
    : 'stable';

  // Build conversation text
  const conversationText = responses
    .map((r, i) => `User Response ${i + 1}: "${r.transcript}"`)
    .join('\n\n');

  // Use AI to extract structured preferences
  const { object: profile } = await generateObject({
    model: google('gemini-2.5-flash'),
    schema: PreferenceProfileSchema,
    maxTokens: 500,
    prompt: `Analyze this user's conversation about movie/TV preferences and extract their profile.

${conversationText}

Average sentiment score: ${avgSentiment.toFixed(2)} (range: -1 to 1)
Sentiment trend: ${sentimentTrend}

Extract:
- Genres they mentioned or implied
- Emotional moods they're seeking
- Themes they enjoy
- Media type preference (movie/tv/all)
- Pacing preference if mentioned
- Era/time period if mentioned
- Elements to avoid
- Viewing context (alone, with others, etc.)
- Enthusiasm level (0-1, based on sentiment and language)
- Confidence score (0-1, how clear are their preferences)

Be specific but concise. Focus on actionable preferences for recommendations.`,
  });

  // Extract key insights
  const keyInsights = extractKeyInsights(responses, profile);

  // Calculate engagement score (combination of response length, sentiment, and conversation flow)
  const engagementScore = calculateEngagementScore(responses, avgSentiment);

  return {
    profile,
    keyInsights,
    sentimentTrend,
    engagementScore,
  };
}

/**
 * Extract key insights from conversation
 */
function extractKeyInsights(responses: UserResponse[], profile: PreferenceProfile): string[] {
  const insights: string[] = [];

  // High enthusiasm detection
  if (profile.enthusiasmLevel > 0.7) {
    insights.push('User is highly enthusiastic and engaged');
  }

  // Clear preferences
  if (profile.confidenceScore > 0.8) {
    insights.push('Strong, clear preferences expressed');
  }

  // Specific content mentions
  const mentionsContent = responses.some(r =>
    r.transcript.toLowerCase().includes('movie') ||
    r.transcript.toLowerCase().includes('show')
  );
  if (mentionsContent) {
    insights.push('Referenced specific content they enjoyed');
  }

  // Mood-based preferences
  if (profile.moods.length > 0) {
    insights.push(`Seeking ${profile.moods.join(', ')} content`);
  }

  // Avoidance patterns
  if (profile.avoidElements && profile.avoidElements.length > 0) {
    insights.push(`Wants to avoid: ${profile.avoidElements.join(', ')}`);
  }

  return insights;
}

/**
 * Calculate overall engagement score
 */
function calculateEngagementScore(responses: UserResponse[], avgSentiment: number): number {
  // Factors:
  // 1. Response count (more responses = more engaged)
  // 2. Average response length (longer = more engaged)
  // 3. Sentiment (positive = more engaged)
  // 4. Sentiment consistency (stable positive = highly engaged)

  const responseCountScore = Math.min(responses.length / 7, 1); // Normalized to 7 responses

  const avgLength = responses.reduce((sum, r) => sum + r.transcript.length, 0) / responses.length;
  const lengthScore = Math.min(avgLength / 100, 1); // Normalized to 100 chars

  const sentimentScore = (avgSentiment + 1) / 2; // Convert -1..1 to 0..1

  // Sentiment consistency (lower variance = more consistent)
  const sentimentVariance = responses.reduce((sum, r) => {
    const score = r.sentiment?.sentiment_score || 0;
    return sum + Math.pow(score - avgSentiment, 2);
  }, 0) / responses.length;
  const consistencyScore = Math.max(0, 1 - sentimentVariance);

  // Weighted average
  return (
    responseCountScore * 0.25 +
    lengthScore * 0.25 +
    sentimentScore * 0.35 +
    consistencyScore * 0.15
  );
}

/**
 * Generate search query from preference profile
 */
export function profileToSearchQuery(profile: PreferenceProfile): string {
  const parts: string[] = [];

  // Add moods
  if (profile.moods.length > 0) {
    parts.push(profile.moods.join(' '));
  }

  // Add genres
  if (profile.genres.length > 0) {
    parts.push(profile.genres.join(' '));
  }

  // Add themes
  if (profile.themes.length > 0) {
    parts.push(profile.themes.join(' '));
  }

  // Add era
  if (profile.era) {
    parts.push(profile.era);
  }

  // Add media type
  if (profile.mediaType !== 'all') {
    parts.push(profile.mediaType);
  }

  return parts.join(' ');
}
