/**
 * Deepgram Voice Agent with Managed LLM
 * Uses Deepgram's fully managed conversational AI (STT + LLM + TTS)
 */

import { createClient } from '@deepgram/sdk';
import { AgentEvents } from '@deepgram/sdk';

export interface VoiceAgentConfig {
  apiKey: string;
  systemPrompt: string;
  greeting: string;
  llmProvider?: 'openai' | 'open_ai' | 'anthropic' | 'google' | 'groq';
  llmModel?: string;
  ttsVoice?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export type AgentState = 'idle' | 'listening' | 'thinking' | 'speaking';

export class ManagedVoiceAgent {
  private deepgram: any;
  private connection: any = null;
  private config: VoiceAgentConfig;
  private conversation: ConversationMessage[] = [];
  private eventHandlers: Map<string, ((data: any) => void)[]> = new Map();
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private state: AgentState = 'idle';
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private startTimeRef: { current: number } = { current: 0 };
  private activeSourceNodes: AudioBufferSourceNode[] = [];

  constructor(config: VoiceAgentConfig) {
    this.config = {
      llmProvider: 'open_ai',
      llmModel: 'gpt-4o-mini',
      ttsVoice: 'aura-asteria-en',
      ...config,
    };
    this.deepgram = createClient(config.apiKey);
  }

  /**
   * Start the voice agent
   */
  async start(): Promise<MediaStream> {
    console.log('🎤 Starting Deepgram Voice Agent with managed LLM...');

    // Get microphone access
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Initialize audio context at 16kHz for microphone processing
    // This automatically downsamples microphone from browser native (48kHz) to 16kHz
    this.audioContext = new AudioContext({ sampleRate: 16000 });

    // Setup Voice Agent connection
    await this.setupVoiceAgent();

    return this.mediaStream;
  }

  /**
   * Setup Deepgram Voice Agent connection
   */
  private async setupVoiceAgent(): Promise<void> {
    console.log('🔊 Setting up Voice Agent connection...');

    // Create Voice Agent connection - this automatically establishes WebSocket
    this.connection = this.deepgram.agent();

    // Setup event handlers
    this.connection.on(AgentEvents.Open, () => {
      console.log('✅ Voice Agent connected');

      // Configure agent once connection is established
      this.connection!.configure({
        audio: {
          input: {
            encoding: 'linear16',
            sample_rate: 16000,
          },
          output: {
            encoding: 'linear16',
            sample_rate: 24000,
          },
        },
        agent: {
          listen: {
            provider: {
              type: 'deepgram',
              model: 'nova-3',
            },
          },
          think: {
            provider: {
              type: this.config.llmProvider || 'open_ai',
              model: this.config.llmModel || 'gpt-4o-mini',
            },
            prompt: this.config.systemPrompt,
          },
          speak: {
            provider: {
              type: 'deepgram',
              model: this.config.ttsVoice || 'aura-asteria-en',
            },
          },
          greeting: this.config.greeting,
        },
      });

      this.emit('Ready', {});

      // Start keep-alive
      this.startKeepAlive();

      // Start streaming audio (async)
      this.startAudioStreaming().catch(err => {
        console.error('Failed to start audio streaming:', err);
      });
    });

    this.connection.on(AgentEvents.Welcome, (data: any) => {
      console.log('👋 Welcome:', data);
      this.state = 'listening';
      this.emit('AgentStateChange', { state: 'listening' });
    });

    this.connection.on(AgentEvents.ConversationText, (data: any) => {
      console.log('💬 Conversation:', data);

      const message: ConversationMessage = {
        role: data.role === 'assistant' ? 'assistant' : 'user',
        content: data.content,
        timestamp: Date.now(),
      };

      this.conversation.push(message);

      if (data.role === 'user') {
        this.emit('UserMessage', { text: data.content });
      } else {
        this.emit('AgentUtterance', { text: data.content });

        // Only check for conversation end after agent speaks
        // This allows agent to respond to the final user message
        if (this.shouldEndConversation(message)) {
          setTimeout(() => {
            this.stop();
          }, 3000);
        }
      }
    });

    this.connection.on(AgentEvents.AgentStartedSpeaking, (data: any) => {
      console.log('🗣️ Agent started speaking:', data);
      this.state = 'speaking';
      this.emit('AgentStateChange', { state: 'speaking' });
    });

    this.connection.on(AgentEvents.AgentAudioDone, () => {
      console.log('🤫 Agent finished speaking');
      this.state = 'listening';
      this.emit('AgentStateChange', { state: 'listening' });
    });

    this.connection.on(AgentEvents.UserStartedSpeaking, () => {
      console.log('👤 User started speaking');
      this.state = 'listening';
      this.emit('AgentStateChange', { state: 'listening' });
    });

    this.connection.on(AgentEvents.Audio, async (audio: any) => {
      console.log('🔊 Received audio chunk');
      await this.playAudioChunk(audio);
    });

    this.connection.on(AgentEvents.Error, (error: any) => {
      console.error('❌ Voice Agent error:', error);
      this.emit('Error', { error });
    });

    this.connection.on(AgentEvents.Close, () => {
      console.log('🔌 Voice Agent disconnected');
      this.stopKeepAlive();
      this.emit('Close', {});
    });

    this.connection.on(AgentEvents.SettingsApplied, () => {
      console.log('✅ Settings applied');
    });

    this.connection.on(AgentEvents.Unhandled, (data: any) => {
      console.log('📊 Unhandled event:', data);
    });
  }

  /**
   * Start streaming microphone audio to Voice Agent
   * Uses AudioWorklet approach from dg_react_agent for Linear16 PCM
   */
  private async startAudioStreaming(): Promise<void> {
    if (!this.mediaStream || !this.connection || !this.audioContext) {
      return;
    }

    console.log('🎙️ Starting audio streaming with AudioWorklet...');

    try {
      // Create AudioWorklet processor for Linear16 PCM conversion
      const workletCode = this.getAudioWorkletCode();
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);

      await this.audioContext.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      // Create worklet node
      const workletNode = new AudioWorkletNode(this.audioContext, 'microphone-processor');

      // Connect microphone to worklet
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(workletNode);
      workletNode.connect(this.audioContext.destination);

      // Handle audio data from worklet
      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio' && this.connection) {
          // Send raw PCM data to Voice Agent
          this.connection.send(event.data.data);
        }
      };

      // Start recording
      workletNode.port.postMessage({ type: 'start' });
      console.log('✅ Audio streaming started with Linear16 PCM');

    } catch (error) {
      console.error('Failed to start audio worklet:', error);
      // Fallback: just connect microphone directly (won't work well but won't crash)
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.audioContext.destination);
    }
  }

  /**
   * Get AudioWorklet processor code for microphone capture
   * From dg_react_agent implementation
   */
  private getAudioWorkletCode(): string {
    return `
class MicrophoneProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRecording = false;
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.port.onmessage = (event) => {
      if (event.data.type === 'start') {
        this.isRecording = true;
      } else if (event.data.type === 'stop') {
        this.isRecording = false;
      }
    };
  }

  process(inputs, outputs, parameters) {
    if (!this.isRecording || !inputs[0] || !inputs[0][0]) {
      return true;
    }

    const input = inputs[0][0];

    for (let i = 0; i < input.length; i++) {
      this.buffer[this.bufferIndex++] = input[i];

      if (this.bufferIndex >= this.bufferSize) {
        this.sendBuffer();
        this.bufferIndex = 0;
      }
    }

    return true;
  }

  sendBuffer() {
    const audioData = this.buffer.slice(0, this.bufferIndex);
    const pcmData = new Int16Array(audioData.length);

    for (let i = 0; i < audioData.length; i++) {
      const s = Math.max(-1, Math.min(1, audioData[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    this.port.postMessage({
      type: 'audio',
      data: pcmData.buffer
    }, [pcmData.buffer]);
  }
}

registerProcessor('microphone-processor', MicrophoneProcessor);
`;
  }

  /**
   * Start keep-alive pings
   */
  private startKeepAlive(): void {
    this.keepAliveInterval = setInterval(() => {
      if (this.connection) {
        this.connection.keepAlive();
        console.log('💓 Keep-alive sent');
      }
    }, 5000); // Every 5 seconds
  }

  /**
   * Stop keep-alive pings
   */
  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  /**
   * Play audio chunk received from agent (Linear16 PCM format)
   * Exactly matches dg_react_agent implementation
   */
  private async playAudioChunk(audioData: any): Promise<void> {
    if (!this.audioContext) {
      return;
    }

    try {
      // Extract ArrayBuffer from Buffer object
      let arrayBuffer: ArrayBuffer;

      if (audioData instanceof ArrayBuffer) {
        arrayBuffer = audioData;
      } else if (audioData instanceof Blob) {
        arrayBuffer = await audioData.arrayBuffer();
      } else if (audioData && typeof audioData === 'object' && 'buffer' in audioData) {
        // Handle Node.js Buffer (has .buffer property for underlying ArrayBuffer)
        arrayBuffer = audioData.buffer.slice(
          audioData.byteOffset,
          audioData.byteOffset + audioData.byteLength
        );
      } else {
        console.warn('Unexpected audio format:', typeof audioData, audioData?.constructor?.name);
        return;
      }

      // Create AudioBuffer from raw Linear16 PCM (same as dg_react_agent)
      const audioBuffer = this.createAudioBuffer(arrayBuffer, 24000);

      if (!audioBuffer) {
        console.error('Failed to create audio buffer');
        return;
      }

      // Play with precise timing (same as dg_react_agent)
      this.playAudioBuffer(audioBuffer);
    } catch (error) {
      console.error('Failed to play audio chunk:', error);
    }
  }

  /**
   * Creates an AudioBuffer from raw Linear16 PCM data
   * Exactly matches dg_react_agent/src/utils/audio/AudioUtils.ts
   */
  private createAudioBuffer(data: ArrayBuffer, sampleRate: number): AudioBuffer | null {
    const audioDataView = new Int16Array(data);
    if (audioDataView.length === 0) {
      console.error('Received audio data is empty');
      return null;
    }

    const buffer = this.audioContext!.createBuffer(1, audioDataView.length, sampleRate);
    const channelData = buffer.getChannelData(0);

    // Convert linear16 PCM to float [-1, 1]
    for (let i = 0; i < audioDataView.length; i++) {
      channelData[i] = audioDataView[i] / 32768;
    }

    return buffer;
  }


  /**
   * Plays an AudioBuffer with precise timing
   * Exactly matches dg_react_agent/src/utils/audio/AudioUtils.ts
   */
  private playAudioBuffer(buffer: AudioBuffer): void {
    const source = this.audioContext!.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext!.destination);

    const currentTime = this.audioContext!.currentTime;

    // If startTimeRef is behind current time, reset it
    if (this.startTimeRef.current < currentTime) {
      this.startTimeRef.current = currentTime;
    }

    // Schedule this chunk to play at startTimeRef
    source.start(this.startTimeRef.current);

    // Update startTimeRef for next chunk
    this.startTimeRef.current += buffer.duration;

    // Track active sources
    this.activeSourceNodes.push(source);

    // Clean up when done
    source.onended = () => {
      const index = this.activeSourceNodes.indexOf(source);
      if (index !== -1) {
        this.activeSourceNodes.splice(index, 1);
      }
    };
  }


  /**
   * Check if conversation should end
   * Called ONLY after agent speaks, so agent can respond to final user message
   */
  private shouldEndConversation(message: ConversationMessage): boolean {
    if (message.role !== 'assistant') {
      return false;
    }

    const userMessages = this.conversation.filter(m => m.role === 'user');

    // End after agent responds to 8th user message (gives 7-8 questions total)
    if (userMessages.length >= 8) {
      console.log(`🏁 Conversation limit reached: ${userMessages.length} user messages`);
      return true;
    }

    return false;
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
   * Get current state
   */
  getState(): AgentState {
    return this.state;
  }

  /**
   * Stop the voice agent
   */
  stop(): void {
    // Prevent double-stop
    if (this.state === 'idle' || !this.connection) {
      console.log('⚠️ Agent already stopped');
      return;
    }

    console.log('🛑 Stopping voice agent...');

    this.stopKeepAlive();

    // Stop all active audio sources
    this.activeSourceNodes.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Already stopped
      }
    });
    this.activeSourceNodes = [];

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.connection) {
      this.connection.disconnect();
      this.connection = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.state = 'idle';
    this.emit('Close', {});
  }
}
