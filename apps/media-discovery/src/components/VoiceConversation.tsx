'use client';

/**
 * Voice Conversation Component
 * Real-time bidirectional voice conversation with Deepgram Voice Agent
 */

import { useState, useEffect, useRef } from 'react';
import { HybridVoiceAgent, type ConversationMessage } from '@/lib/voice-agent-hybrid';
import type { SearchResult } from '@/types/media';

interface VoiceConversationProps {
  onComplete?: (conversation: ConversationMessage[]) => void;
}

export default function VoiceConversation({ onComplete }: VoiceConversationProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [status, setStatus] = useState<string>('Ready to start');
  const [error, setError] = useState<string | null>(null);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendations, setRecommendations] = useState<SearchResult[]>([]);

  const agentRef = useRef<HybridVoiceAgent | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  const SYSTEM_PROMPT = `You are a friendly media discovery assistant helping users find movies and TV shows they'll love.

Your goal: Have a natural 5-7 question conversation to understand their preferences.

Ask about (naturally, one at a time):
1. What's the last movie or show you really enjoyed? Why?
2. What mood are you in? (exciting, relaxing, thought-provoking, funny, etc.)
3. Do you prefer movies or TV shows right now?
4. Any specific genres you're craving?
5. Time period preference? (modern, classic, etc.)
6. Anything you want to avoid?
7. Watching alone or with someone?

Guidelines:
- Keep responses under 25 words
- Ask ONE question at a time
- Be enthusiastic and conversational
- After 5-7 questions, say "Perfect! Let me find some great matches for you." and END the conversation
- Don't be robotic - be natural and friendly

Important: After about 5-7 exchanges, wrap up the conversation naturally.`;

  /**
   * Start voice conversation
   */
  const startConversation = async () => {
    try {
      setError(null);
      setStatus('Connecting to voice agent...');

      // Get API key from environment
      const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY || process.env.DEEPGRAM_API_KEY;

      if (!apiKey) {
        throw new Error('Deepgram API key not configured');
      }

      // Create hybrid voice agent
      const agent = new HybridVoiceAgent({
        apiKey,
        systemPrompt: SYSTEM_PROMPT,
        greeting: "Hi! I'm your personal movie and TV show assistant. I'd love to learn what kind of content you enjoy. Ready to chat?",
        llmModel: 'gemini-2.0-flash-exp',
        voiceModel: 'aura-asteria-en', // Natural female voice
      });

      // Setup event handlers
      agent.on('Ready', () => {
        console.log('✅ Ready!');
        setIsConnected(true);
        setStatus('Ready to talk - Start speaking!');
      });

      agent.on('UserSpeaking', (data) => {
        setUserSpeaking(true);
        setStatus(`Listening: "${data.transcript.slice(0, 50)}..."`);
      });

      agent.on('UserStoppedSpeaking', (data) => {
        console.log('🤐 User stopped');
        setUserSpeaking(false);
        setStatus('Processing...');
      });

      agent.on('AgentThinking', () => {
        console.log('🤔 Agent thinking...');
        setStatus('Thinking...');
      });

      agent.on('AgentStartedSpeaking', () => {
        console.log('🗣️ Agent speaking...');
        setAgentSpeaking(true);
        setStatus('Speaking...');
      });

      agent.on('AgentStoppedSpeaking', () => {
        console.log('🤫 Agent stopped');
        setAgentSpeaking(false);
        setStatus('Listening...');
      });

      agent.on('ConversationText', (data) => {
        console.log(`💬 ${data.role}: ${data.content}`);

        setConversation(prev => [
          ...prev,
          {
            role: data.role,
            content: data.content,
            timestamp: Date.now(),
          },
        ]);

        // Check if conversation is ending
        if (data.role === 'assistant' &&
            (data.content.toLowerCase().includes('let me find') ||
             data.content.toLowerCase().includes('great matches'))) {
          setTimeout(() => {
            stopConversation();
          }, 3000);
        }
      });

      agent.on('Error', (data) => {
        console.error('❌ Agent error:', data);
        setError(data.error?.message || 'Voice agent error');
        setStatus('Error');
      });

      agent.on('Close', () => {
        console.log('👋 Connection closed');
        setIsConnected(false);
        setStatus('Disconnected');
      });

      // Start agent (includes recording)
      const stream = await agent.start();
      agentRef.current = agent;
      streamRef.current = stream;
      setIsRecording(true);

    } catch (err) {
      console.error('Failed to start conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to start conversation');
      setStatus('Error');
    }
  };

  /**
   * Stop voice conversation
   */
  const stopConversation = () => {
    // Stop recording
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setStatus('Conversation ended');

    // Stop agent
    if (agentRef.current) {
      const finalConversation = agentRef.current.getConversation();
      setConversation(finalConversation);

      agentRef.current.stop();
      agentRef.current = null;
    }

    setIsConnected(false);

    // Analyze preferences
    if (conversation.length > 0) {
      analyzeAndRecommend();
    }
  };

  /**
   * Analyze conversation and get recommendations
   */
  const analyzeAndRecommend = async () => {
    setIsAnalyzing(true);
    setStatus('Analyzing your preferences...');

    try {
      const userResponses = conversation
        .filter(msg => msg.role === 'user')
        .map(msg => ({
          transcript: msg.content,
          timestamp: msg.timestamp,
        }));

      const response = await fetch('/api/voice-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: userResponses }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze preferences');
      }

      const data = await response.json();
      setRecommendations(data.recommendations);
      setStatus('Here are your personalized recommendations!');

      if (onComplete) {
        onComplete(conversation);
      }
    } catch (err) {
      console.error('Analysis failed:', err);
      setError('Failed to generate recommendations');
      setStatus('Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Auto-scroll to latest message
   */
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopConversation();
    };
  }, []);

  return (
    <div className="voice-conversation-container max-w-4xl mx-auto p-6">
      <div className="card bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <span className="text-3xl">🎤</span>
              Voice Discovery
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Have a natural conversation about what you love
            </p>
          </div>

          {!isConnected && (
            <button
              onClick={startConversation}
              disabled={isAnalyzing}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Voice Chat
            </button>
          )}

          {isConnected && (
            <button
              onClick={stopConversation}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
            >
              End Conversation
            </button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200 flex items-center gap-2">
              <span>⚠️</span>
              {error}
            </p>
          </div>
        )}

        {/* Status Bar */}
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}></div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {status}
              </span>
            </div>

            <div className="flex items-center gap-4">
              {userSpeaking && (
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping"></div>
                  <span className="text-xs font-medium">You're speaking</span>
                </div>
              )}

              {agentSpeaking && (
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                  <div className="w-2 h-2 bg-purple-600 rounded-full animate-ping"></div>
                  <span className="text-xs font-medium">Agent speaking</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Conversation Display */}
        <div className="conversation-area mb-6 space-y-4 max-h-[500px] overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg">
          {conversation.length === 0 && !isConnected && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎙️</div>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Click "Start Voice Chat" to begin your personalized discovery session
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Just talk naturally - I'll ask questions to understand what you love
              </p>
            </div>
          )}

          {conversation.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              <div className="flex items-start gap-3 max-w-[80%]">
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0 text-white">
                    🤖
                  </div>
                )}

                <div
                  className={`px-4 py-3 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-br-sm'
                      : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 rounded-bl-sm'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.content}</p>
                  <p className="text-xs mt-1 opacity-60">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>

                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 text-white">
                    👤
                  </div>
                )}
              </div>
            </div>
          ))}

          {isAnalyzing && (
            <div className="flex justify-center py-8">
              <div className="flex flex-col items-center gap-3 text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce"></div>
                  <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-3 h-3 bg-cyan-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm font-medium">Analyzing your preferences...</span>
              </div>
            </div>
          )}

          <div ref={conversationEndRef} />
        </div>

        {/* Recording Indicator */}
        {isRecording && (
          <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center justify-center gap-3">
              <div className="relative">
                <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-4 h-4 bg-red-500 rounded-full animate-ping"></div>
              </div>
              <span className="text-sm font-medium text-red-800 dark:text-red-200">
                Recording - Speak naturally, I'm listening!
              </span>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="mt-6 animate-fade-in">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span>✨</span>
              Your Personalized Recommendations
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {recommendations.map((rec) => (
                <div
                  key={`${rec.content.mediaType}-${rec.content.id}`}
                  className="group cursor-pointer transform transition-transform hover:scale-105"
                >
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 shadow-lg">
                    {rec.content.posterPath ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w342${rec.content.posterPath}`}
                        alt={rec.content.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        No Image
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <div className="text-white text-sm font-semibold mb-1 line-clamp-2">
                          {rec.content.title}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-200">
                          <span>⭐ {rec.content.voteAverage.toFixed(1)}</span>
                          {rec.content.releaseDate && (
                            <span>• {new Date(rec.content.releaseDate).getFullYear()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
