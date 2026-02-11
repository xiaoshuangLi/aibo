declare module 'node-record-lpcm16' {
  interface RecordingOptions {
    sampleRate?: number;
    channels?: number;
    compress?: boolean;
    threshold?: number;
    thresholdStart?: number | null;
    thresholdEnd?: number | null;
    silence?: string;
    recorder?: string;
    endOnSilence?: boolean;
    audioType?: string;
    device?: string | null;
  }

  interface Recording {
    stream(): NodeJS.ReadableStream;
    stop(): void;
    pause(): void;
    resume(): void;
    isPaused(): boolean;
  }

  interface Recorder {
    record(options?: RecordingOptions): Recording;
  }

  const recorder: Recorder;
  export = recorder;
}