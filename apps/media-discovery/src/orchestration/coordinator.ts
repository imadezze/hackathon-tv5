/**
 * Multi-Agent Orchestration Coordinator
 *
 * Coordinates all agents to solve the "45-minute decision problem"
 * Reduces content discovery time from 45 minutes to under 2 minutes
 */

import { contentDiscoveryAgent, type DiscoveryQuery, type DiscoveryResult } from '@/agents/content-discovery';
import { platformAvailabilityAgent, type PlatformSubscription, type AvailabilityResult } from '@/agents/platform-availability';
import { preferenceLearningAgent, type UserPreferenceProfile } from '@/agents/preference-learning';

export interface DecisionRequest {
  userId: string;
  query: string;
  context?: {
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
    dayOfWeek?: string;
    mood?: string;
    occasion?: string;
    groupMode?: boolean;
    groupMembers?: string[];
  };
  userSubscriptions: PlatformSubscription[];
  preferences?: {
    mediaType?: 'movie' | 'tv' | 'all';
    genres?: number[];
    ratingMin?: number;
  };
}

export interface EnhancedRecommendation {
  // Content info
  id: number;
  title: string;
  mediaType: 'movie' | 'tv';
  overview: string;
  genres: number[];
  rating: number;
  releaseDate: string;

  // Scoring
  matchScore: number; // Semantic match from content discovery
  personalizedScore: number; // User preference match
  availabilityScore: number; // How easily accessible
  finalScore: number; // Combined score

  // Match reasons
  matchReasons: string[];
  whyRecommended: string; // AI-generated explanation

  // Availability
  availability: AvailabilityResult;

  // Confidence
  confidence: 'high' | 'medium' | 'low';
}

export interface DecisionResponse {
  userId: string;
  query: string;
  processingTimeMs: number;
  recommendations: EnhancedRecommendation[];
  userProfile?: UserPreferenceProfile;
  metadata: {
    totalCandidates: number;
    agentsUsed: string[];
    decisionPath: string[];
  };
}

export class MediaDiscoveryCoordinator {
  private name = 'media-discovery-coordinator';
  private version = '2.0.0';

  /**
   * Main orchestration method - solves the 45-minute problem
   */
  async decide(request: DecisionRequest): Promise<DecisionResponse> {
    const startTime = Date.now();
    const decisionPath: string[] = [];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎬 MEDIA DISCOVERY ORCHESTRATOR v${this.version}`);
    console.log(`Query: "${request.query}"`);
    console.log(`User: ${request.userId}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Step 1: Content Discovery (parallel with preference loading)
      decisionPath.push('content-discovery');
      const [discoveryResults, userProfile] = await Promise.all([
        this.runContentDiscovery(request),
        this.loadUserProfile(request.userId),
      ]);

      console.log(`✓ Found ${discoveryResults.length} candidates`);
      if (userProfile) {
        console.log(`✓ Loaded user profile with ${userProfile.favoriteGenres.length} genre preferences`);
      }

      // Step 2: Personalization
      decisionPath.push('preference-learning');
      const personalizedResults = await this.applyPersonalization(
        request.userId,
        discoveryResults
      );

      console.log(`✓ Applied personalization scoring`);

      // Step 3: Platform Availability (batch check top candidates)
      decisionPath.push('platform-availability');
      const topCandidates = personalizedResults.slice(0, 20); // Check top 20
      const withAvailability = await this.checkAvailability(
        topCandidates,
        request.userSubscriptions
      );

      console.log(`✓ Checked availability across platforms`);

      // Step 4: Final Scoring & Ranking
      decisionPath.push('decision-optimizer');
      const finalRecommendations = this.computeFinalScores(withAvailability);

      // Step 5: Generate Explanations
      const explained = await this.addExplanations(
        finalRecommendations,
        request.query
      );

      console.log(`✓ Generated ${explained.length} recommendations`);

      const processingTimeMs = Date.now() - startTime;

      console.log(`\n${'='.repeat(60)}`);
      console.log(`✅ DECISION COMPLETE in ${processingTimeMs}ms`);
      console.log(`🎯 Top Recommendation: ${explained[0]?.title || 'None'}`);
      console.log(`${'='.repeat(60)}\n`);

      return {
        userId: request.userId,
        query: request.query,
        processingTimeMs,
        recommendations: explained.slice(0, 10), // Return top 10
        userProfile: userProfile || undefined,
        metadata: {
          totalCandidates: discoveryResults.length,
          agentsUsed: [
            'content-discovery',
            'preference-learning',
            'platform-availability',
            'decision-optimizer',
          ],
          decisionPath,
        },
      };

    } catch (error) {
      console.error(`❌ Orchestration error:`, error);
      throw error;
    }
  }

  /**
   * Step 1: Run content discovery agent
   */
  private async runContentDiscovery(
    request: DecisionRequest
  ): Promise<DiscoveryResult[]> {
    const discoveryQuery: DiscoveryQuery = {
      text: request.query,
      context: request.context,
      filters: request.preferences,
    };

    return await contentDiscoveryAgent.discover(discoveryQuery);
  }

  /**
   * Load user profile from preference learning agent
   */
  private async loadUserProfile(
    userId: string
  ): Promise<UserPreferenceProfile | null> {
    return await preferenceLearningAgent.getProfile(userId);
  }

  /**
   * Step 2: Apply personalization to discovered content
   */
  private async applyPersonalization(
    userId: string,
    candidates: DiscoveryResult[]
  ): Promise<Array<DiscoveryResult & { personalizedScore: number }>> {
    return await preferenceLearningAgent.getRecommendations(userId, candidates);
  }

  /**
   * Step 3: Check platform availability for top candidates
   */
  private async checkAvailability(
    candidates: Array<DiscoveryResult & { personalizedScore: number }>,
    subscriptions: PlatformSubscription[]
  ): Promise<Array<DiscoveryResult & { personalizedScore: number; availability: AvailabilityResult }>> {
    // Check availability in parallel
    const withAvailability = await Promise.all(
      candidates.map(async (candidate) => {
        const availability = await platformAvailabilityAgent.checkAvailability(
          candidate.id,
          candidate.title,
          subscriptions
        );

        return {
          ...candidate,
          availability,
        };
      })
    );

    return withAvailability;
  }

  /**
   * Step 4: Compute final scores combining all factors
   */
  private computeFinalScores(
    candidates: Array<DiscoveryResult & { personalizedScore: number; availability: AvailabilityResult }>
  ): Array<DiscoveryResult & {
    personalizedScore: number;
    availability: AvailabilityResult;
    availabilityScore: number;
    finalScore: number;
  }> {
    return candidates.map(candidate => {
      // Calculate availability score
      const availabilityScore = this.calculateAvailabilityScore(candidate.availability);

      // Weighted final score:
      // - 40% semantic match (matchScore)
      // - 35% personalization (personalizedScore)
      // - 25% availability (availabilityScore)
      const finalScore =
        (candidate.matchScore * 0.40) +
        (candidate.personalizedScore * 0.35) +
        (availabilityScore * 0.25);

      return {
        ...candidate,
        availabilityScore,
        finalScore,
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * Calculate availability score based on platform access
   */
  private calculateAvailabilityScore(availability: AvailabilityResult): number {
    if (!availability.available) return 0;

    // Has subscription access = 1.0
    const hasSubscription = availability.platforms.some(
      p => p.userHasAccess && p.type === 'subscription'
    );
    if (hasSubscription) return 1.0;

    // Free access = 0.8
    const hasFree = availability.platforms.some(
      p => p.userHasAccess && p.type === 'free'
    );
    if (hasFree) return 0.8;

    // Can rent = 0.5
    const canRent = availability.platforms.some(p => p.type === 'rent');
    if (canRent) return 0.5;

    // Can buy = 0.3
    const canBuy = availability.platforms.some(p => p.type === 'buy');
    if (canBuy) return 0.3;

    return 0.1; // Platform exists but unclear access
  }

  /**
   * Step 5: Add AI-generated explanations
   */
  private async addExplanations(
    recommendations: Array<any>,
    query: string
  ): Promise<EnhancedRecommendation[]> {
    return recommendations.map(rec => {
      // Generate explanation
      const whyRecommended = this.generateExplanation(rec, query);

      // Determine confidence level
      const confidence =
        rec.finalScore > 0.8 ? 'high' :
        rec.finalScore > 0.6 ? 'medium' : 'low';

      return {
        ...rec,
        whyRecommended,
        confidence,
      } as EnhancedRecommendation;
    });
  }

  /**
   * Generate human-readable explanation for recommendation
   */
  private generateExplanation(recommendation: any, query: string): string {
    const reasons: string[] = [];

    // Match quality
    if (recommendation.matchScore > 0.8) {
      reasons.push(`Excellent match for "${query}"`);
    } else if (recommendation.matchScore > 0.6) {
      reasons.push(`Good match for your search`);
    }

    // Personalization
    if (recommendation.personalizedScore > 0.8) {
      reasons.push(`Matches your viewing preferences`);
    } else if (recommendation.personalizedScore > 0.6) {
      reasons.push(`Similar to content you've enjoyed`);
    }

    // Availability
    if (recommendation.availability.bestOption) {
      reasons.push(recommendation.availability.bestOption.reason);
    }

    // Rating
    if (recommendation.rating > 8.0) {
      reasons.push(`Highly rated (${recommendation.rating.toFixed(1)}/10)`);
    }

    return reasons.join(' • ');
  }

  /**
   * Get orchestrator metadata
   */
  getMetadata() {
    return {
      name: this.name,
      version: this.version,
      problem: '45-minute decision problem',
      solution: 'Multi-agent orchestration with parallel execution',
      targetTime: '< 2 minutes',
      agents: [
        contentDiscoveryAgent.getMetadata(),
        platformAvailabilityAgent.getMetadata(),
        preferenceLearningAgent.getMetadata(),
      ],
    };
  }
}

export const coordinator = new MediaDiscoveryCoordinator();
