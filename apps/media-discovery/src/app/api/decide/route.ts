/**
 * Smart Decision API
 * POST /api/decide
 *
 * Solves the "45-minute decision problem" using multi-agent orchestration
 * Returns personalized recommendations in under 2 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { coordinator } from '@/orchestration/coordinator';
import type { DecisionRequest } from '@/orchestration/coordinator';

// Request schema
const DecisionRequestSchema = z.object({
  userId: z.string().min(1),
  query: z.string().min(1).max(500),
  context: z.object({
    timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'night']).optional(),
    dayOfWeek: z.string().optional(),
    mood: z.string().optional(),
    occasion: z.string().optional(),
    groupMode: z.boolean().optional(),
    groupMembers: z.array(z.string()).optional(),
  }).optional(),
  userSubscriptions: z.array(z.object({
    platform: z.enum([
      'netflix',
      'hulu',
      'disney-plus',
      'prime-video',
      'hbo-max',
      'apple-tv',
      'paramount-plus',
      'peacock',
    ]),
    active: z.boolean(),
    region: z.string().default('US'),
  })).default([]),
  preferences: z.object({
    mediaType: z.enum(['movie', 'tv', 'all']).optional(),
    genres: z.array(z.number()).optional(),
    ratingMin: z.number().min(0).max(10).optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const validatedRequest = DecisionRequestSchema.parse(body);

    // Auto-detect context if not provided
    const now = new Date();
    const hour = now.getHours();
    const context = validatedRequest.context || {
      timeOfDay:
        hour < 12 ? 'morning' :
        hour < 17 ? 'afternoon' :
        hour < 21 ? 'evening' : 'night',
      dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
    };

    // Build decision request
    const decisionRequest: DecisionRequest = {
      ...validatedRequest,
      context,
    };

    // Run multi-agent orchestration
    const response = await coordinator.decide(decisionRequest);

    const totalTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: `Decision made in ${(totalTime / 1000).toFixed(2)}s`,
      data: response,
      performance: {
        totalTimeMs: totalTime,
        agentProcessingMs: response.processingTimeMs,
        overheadMs: totalTime - response.processingTimeMs,
      },
    });

  } catch (error) {
    console.error('Decision API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process decision request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint for simple queries (for testing)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const userId = searchParams.get('userId') || 'demo-user';

  if (!query) {
    return NextResponse.json(
      {
        success: false,
        error: 'Query parameter "q" is required',
        example: '/api/decide?q=funny movie for family night&userId=user123',
      },
      { status: 400 }
    );
  }

  try {
    // Auto-detect context
    const now = new Date();
    const hour = now.getHours();

    const decisionRequest: DecisionRequest = {
      userId,
      query,
      context: {
        timeOfDay:
          hour < 12 ? 'morning' :
          hour < 17 ? 'afternoon' :
          hour < 21 ? 'evening' : 'night',
        dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
      },
      userSubscriptions: [
        { platform: 'netflix', active: true, region: 'US' },
        { platform: 'hulu', active: true, region: 'US' },
      ],
    };

    const response = await coordinator.decide(decisionRequest);

    return NextResponse.json({
      success: true,
      data: response,
    });

  } catch (error) {
    console.error('Decision API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
