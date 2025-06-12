export interface AudioProcessingResponse {
  processed: ArrayBuffer;
  metadata?: {
    duration: number;
    sampleRate: number;
    channels: number;
  };
}

export interface MetricsData {
  callsPerHour: Array<{
    hour: string;
    calls: number;
  }>;
  successRate: number;
  averageDuration: number;
}

export interface OnboardingData {
  businessDetails: {
    name: string;
    type: string;
    hours: string;
  };
  aiPersona: {
    tone: string;
    language: string;
  };
}
