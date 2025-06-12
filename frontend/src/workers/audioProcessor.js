const audioProcessor = {
  cache: new Map(),

  // Buffer configuration
  bufferConfig: {
    maxSize: 4096,
    overlap: 0.5,
    threshold: -45,
  },

  async processAudio(audioData) {
    const cacheKey = this.generateCacheKey(audioData);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const buffers = this.splitIntoBuffers(audioData);
      const nonSilentBuffers = await this.detectVoiceActivity(buffers);
      const processedData = await this.applyOptimizations(nonSilentBuffers);
      this.cache.set(cacheKey, processedData);
      return processedData;
    } catch (error) {
      console.error('Audio processing error:', error);
      throw error;
    }
  },

  generateCacheKey(data) {
    return `${data.length}-${Date.now()}`;
  },

  clearCache() {
    this.cache.clear();
  },

  splitIntoBuffers(data) {
    const buffers = [];
    const step = Math.floor(this.bufferConfig.maxSize * this.bufferConfig.overlap);
    for (let i = 0; i < data.length; i += step) {
      buffers.push(data.slice(i, i + this.bufferConfig.maxSize));
    }
    return buffers;
  },

  async detectVoiceActivity(buffers) {
    return buffers.filter(buffer => {
      const rms = Math.sqrt(buffer.reduce((acc, val) => acc + val * val, 0) / buffer.length);
      const db = 20 * Math.log10(rms);
      return db > this.bufferConfig.threshold;
    });
  },

  async applyOptimizations(data, context) {
    if (!context) {
      throw new Error('AudioContext is required');
    }

    try {
      const buffer = await context.decodeAudioData(data.buffer);
      const source = context.createBufferSource();
      source.buffer = buffer;

      // Create nodes only when needed
      const nodes = this.createAudioNodes(context);
      this.connectAudioChain(source, nodes, context.destination);

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Audio processing timeout'));
        }, 30000);

        context.oncomplete = (event) => {
          clearTimeout(timeoutId);
          resolve(event.renderedBuffer);
        };
        context.onerror = reject;
        
        source.start();
        context.startRendering();
      });
    } catch (err) {
      throw new Error(`Audio optimization failed: ${err.message}`);
    }
  },

  createAudioNodes(context) {
    const noiseReducer = context.createDynamicsCompressor();
    Object.assign(noiseReducer, {
      threshold: { value: -50 },
      knee: { value: 40 },
      ratio: { value: 12 },
      attack: { value: 0 },
      release: { value: 0.25 }
    });

    const highPassFilter = context.createBiquadFilter();
    Object.assign(highPassFilter, {
      type: 'highpass',
      frequency: { value: 85 },
      Q: { value: 0.7 }
    });

    return { noiseReducer, highPassFilter };
  },

  connectAudioChain(source, nodes, destination) {
    source
      .connect(nodes.noiseReducer)
      .connect(nodes.highPassFilter)
      .connect(destination);
  }
};

self.onmessage = async (e) => {
  const { audioData } = e.data;
  const processed = await audioProcessor.processAudio(audioData);
  self.postMessage({ processed });
};