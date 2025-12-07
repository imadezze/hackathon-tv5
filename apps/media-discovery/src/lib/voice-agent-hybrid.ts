/**
 * Hybrid Voice Agent
 * Combines Deepgram Live STT + AI + Deepgram TTS for conversational experience
 */

import { createClient } from '@deepgram/sdk';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

export interface VoiceAgentConfig {
  apiKey: string;
  systemPrompt: string;
  greeting: string;
  llmModel?: string;
  voiceModel?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export class HybridVoiceAgent {
  private deepgram: any;
  private sttConnection: any = null;
  private config: VoiceAgentConfig;
  private conversation: ConversationMessage[] = [];
  private eventHandlers: Map<string, ((data: any) => void)[]> = new Map();
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private isListening = false;
  private isSpeaking = false;
  private currentTranscript = '';
  private silenceTimeout: NodeJS.Timeout | null = null;

  constructor(config: VoiceAgentConfig) {
    this.config = config;
    this.deepgram = createClient(config.apiKey);
  }

  /**
   * Start the voice agent
   */
  async start(): Promise<MediaStream> {
    console.log('🎤 Starting hybrid voice agent...');

    // Get microphone access
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Initialize audio context for playback
    this.audioContext = new AudioContext({ sampleRate: 24000 });

    // Setup speech-to-text
    await this.setupSTT(stream);

    // Speak greeting
    if (this.config.greeting) {
      await this.speak(this.config.greeting, 'assistant');
    }

    this.isListening = true;
    this.emit('Ready', {});

    return stream;
  }

  /**
   * Setup live speech-to-text
   */
  private async setupSTT(stream: MediaStream): Promise<void> {
    console.log('🔊 Setting up speech-to-text...');

    this.sttConnection = this.deepgram.listen.live({
      model: 'nova-2',
      language: 'en',
      smart_format: true,
      interim_results: true,
      punctuate: true,
      endpointing: 300, // 300ms silence detection
    });

    this.sttConnection.on('open', () => {
      console.log('✅ STT connected');

      // Setup media recorder
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.sttConnection.getReadyState() === 1) {
          this.sttConnection.send(event.data);
        }
      };

      this.mediaRecorder.start(250); // Send chunks every 250ms
    });

    this.sttConnection.on('Results', (data: any) => {
      console.log('📊 Results event:', data);
      this.handleTranscript(data);
    });

    this.sttConnection.on('transcript', (data: any) => {
      console.log('📊 Transcript event:', data);
      this.handleTranscript(data);
    });

    this.sttConnection.on('Metadata', (data: any) => {
      console.log('📊 Metadata:', data);
    });

    this.sttConnection.on('error', (error: any) => {
      console.error('❌ STT error:', error);
      this.emit('Error', { error });
    });

    this.sttConnection.on('Error', (error: any) => {
      console.error('❌ STT Error event:', error);
      this.emit('Error', { error });
    });

    this.sttConnection.on('close', () => {
      console.log('🔌 STT closed');
    });

    this.sttConnection.on('Close', () => {
      console.log('🔌 STT Close event');
    });
  }

  /**
   * Handle incoming transcripts
   */
  private handleTranscript(data: any): void {
    console.log('📝 Transcript data:', JSON.stringify(data, null, 2));

    const transcript = data.channel?.alternatives?.[0]?.transcript;
    const isFinal = data.is_final || data.speech_final;

    console.log(`📝 Transcript: "${transcript}" (final: ${isFinal}, speaking: ${this.isSpeaking})`);

    if (!transcript || transcript.trim() === '' || this.isSpeaking) {
      return;
    }

    if (isFinal) {
      console.log(`👤 User (final): "${transcript}"`);

      this.currentTranscript = transcript;

      // Clear previous timeout
      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout);
      }

      // Wait for silence before responding
      this.silenceTimeout = setTimeout(() => {
        if (this.currentTranscript.trim()) {
          this.processUserInput(this.currentTranscript);
          this.currentTranscript = '';
        }
      }, 1500); // 1.5 second of silence

      this.emit('UserStoppedSpeaking', { transcript });
    } else {
      // Interim results
      console.log(`👤 User (interim): "${transcript}"`);
      this.emit('UserSpeaking', { transcript });
    }
  }

  /**
   * Process user input and generate response
   */
  private async processUserInput(transcript: string): Promise<void> {
    console.log(`🤔 Processing user input: "${transcript}"`);

    if (!transcript.trim()) {
      console.log('⚠️  Empty transcript, skipping');
      return;
    }

    // Add to conversation
    this.conversation.push({
      role: 'user',
      content: transcript,
      timestamp: Date.now(),
    });

    this.emit('ConversationText', {
      role: 'user',
      content: transcript,
    });

    // Check if we should end conversation
    if (this.conversation.filter(m => m.role === 'user').length >= 7) {
      await this.speak("Perfect! Let me find some great matches for you based on what you've told me.", 'assistant');
      this.stop();
      return;
    }

    // Generate AI response
    this.emit('AgentThinking', {});

    try {
      const { text: response } = await generateText({
        model: google(this.config.llmModel || 'gemini-2.0-flash-exp'),
        maxTokens: 150,
        messages: [
          {
            role: 'system',
            content: this.config.systemPrompt,
          },
          ...this.conversation.map(msg => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })),
        ],
      });

      console.log(`🤖 Assistant: "${response}"`);

      // Speak the response
      await this.speak(response, 'assistant');

    } catch (error) {
      console.error('Failed to generate response:', error);
      this.emit('Error', { error });
    }
  }

  /**
   * Speak text using Deepgram TTS
   */
  private async speak(text: string, role: 'user' | 'assistant'): Promise<void> {
    this.isSpeaking = true;
    this.emit('AgentStartedSpeaking', {});

    try {
      // Add to conversation
      if (role === 'assistant') {
        this.conversation.push({
          role,
          content: text,
          timestamp: Date.now(),
        });

        this.emit('ConversationText', {
          role,
          content: text,
        });
      }

      // Generate speech using Deepgram TTS
      const response = await fetch(
        `https://api.deepgram.com/v1/speak?model=${this.config.voiceModel || 'aura-asteria-en'}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Token ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
        }
      );

      if (!response.ok) {
        throw new Error(`TTS failed: ${response.statusText}`);
      }

      // Get audio data
      const audioBlob = await response.blob();
      const arrayBuffer = await audioBlob.arrayBuffer();

      // Play audio
      await this.playAudio(arrayBuffer);

      this.emit('AgentStoppedSpeaking', {});
    } catch (error) {
      console.error('Failed to speak:', error);
      this.emit('Error', { error });
    } finally {
      this.isSpeaking = false;
    }
  }

  /**
   * Play audio buffer
   */
  private async playAudio(arrayBuffer: ArrayBuffer): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    return new Promise((resolve) => {
      source.onended = () => resolve();
      source.start(0);
    });
  }

  /**
   * Event listener
   */
  on(event: string, handler: (data: any) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Emit event
   */
  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  /**
   * Get conversation history
   */
  getConversation(): ConversationMessage[] {
    return [...this.conversation];
  }

  /**
   * Stop the voice agent
   */
  stop(): void {
    console.log('🛑 Stopping voice agent...');

    this.isListening = false;

    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }

    if (this.sttConnection) {
      this.sttConnection.finish();
      this.sttConnection = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.emit('Close', {});
  }
}
