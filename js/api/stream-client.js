/**
 * @file stream-client.js
 * @description ProPresenter 7 Chunked Stream Multiplexer Engine.
 * Implements persistent HTTP streaming over POST /v1/status/updates to overcome
 * the browser's 6-connection concurrency limit by aggregating all event feeds into
 * a single zero-latency readable stream.
 *
 * @version 1.0.0
 * @license MIT
 */

/**
 * Event-driven chunked stream reader.
 * Uses the Web Fetch Streams API (ReadableStream + TextDecoder) to read continuous JSON frames.
 *
 * @class StreamClient
 */
class StreamClient {
  /**
   * Constructs a new StreamClient.
   *
   * @param {string} [baseURL] - Base URL of the ProPresenter instance.
   * @param {Object} [options={}] - Configuration and lifecycle callbacks.
   * @param {Function} [options.onEvent] - Invoked for each incoming frame: (url, data).
   * @param {Function} [options.onStatusChange] - Invoked on status changes: ('connecting'|'connected'|'reconnecting'|'disconnected').
   * @param {Function} [options.onError] - Invoked when an error occurs: (error).
   */
  constructor(baseURL = '', options = {}) {
    /**
     * Target base URL.
     * @type {string}
     */
    this.baseURL = baseURL || (window.AppConfig ? window.AppConfig.getConfig().baseURL : 'http://192.168.0.200:1025');

    /**
     * Frame event handler callback.
     * @type {Function}
     */
    this.onEvent = options.onEvent || (() => {});

    /**
     * Stream status change callback.
     * @type {Function}
     */
    this.onStatusChange = options.onStatusChange || (() => {});

    /**
     * Error callback.
     * @type {Function}
     */
    this.onError = options.onError || (() => {});

    /**
     * Active AbortController instance for canceling streaming fetch.
     * @type {AbortController|null}
     * @private
     */
    this.abortController = null;

    /**
     * Connection flag.
     * @type {boolean}
     */
    this.isConnected = false;

    /**
     * Exponential backoff reconnect attempt counter.
     * @type {number}
     * @private
     */
    this.reconnectAttempts = 0;

    /**
     * Maximum backoff delay between reconnect attempts in milliseconds.
     * @type {number}
     */
    this.maxReconnectDelayMs = 15000;

    /**
     * Reconnect timer handle.
     * @type {number|null}
     * @private
     */
    this.reconnectTimer = null;

    /**
     * Buffer accumulating incoming UTF-8 chunk text fragments.
     * @type {string}
     * @private
     */
    this.buffer = '';

    /**
     * Default list of streaming endpoints subscribed to in the aggregator.
     * @type {string[]}
     */
    this.defaultSubscriptions = [
      'status/slide',
      'status/screens',
      'status/audience_screens',
      'status/stage_screens',
      'status/layers',
      'presentation/slide_index',
      'presentation/active',
      'stage/message',
      'capture/status',
      'timer/video_countdown',
      'timer/system_time',
      'look/current'
    ];
  }

  /**
   * Sets or updates the target base URL.
   * @param {string} url - New base URL.
   */
  setBaseURL(url) {
    this.baseURL = url.replace(/\/+$/, '');
  }

  /**
   * Opens the persistent chunked stream with ProPresenter 7.
   * Posts the list of subscribed endpoints to POST /v1/status/updates and begins reading the stream.
   *
   * @param {string[]} [subscriptions=this.defaultSubscriptions] - Array of endpoints to subscribe to.
   * @returns {Promise<void>}
   */
  async connect(subscriptions = this.defaultSubscriptions) {
    // If a previous stream is open, cleanly abort it
    if (this.abortController) {
      this.disconnect();
    }

    this.abortController = new AbortController();
    const streamEndpoint = `${this.baseURL}/v1/status/updates`;

    try {
      this.onStatusChange('connecting');
      console.log('[StreamClient] Connecting chunk stream to:', streamEndpoint);

      const response = await fetch(streamEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(subscriptions),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        throw new Error(`Stream rejected: HTTP ${response.status} ${response.statusText}`);
      }

      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.buffer = '';
      this.onStatusChange('connected');
      console.log('[StreamClient] Stream established. Receiving real-time push events.');

      // Obtain the underlying byte stream reader
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      // Continuous read loop
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          console.warn('[StreamClient] Server closed the stream connection.');
          break;
        }

        // Decode incoming byte chunk and append to buffer
        const chunkText = decoder.decode(value, { stream: true });
        this.buffer += chunkText;

        // ProPresenter frames are delimited by double CRLF / double newlines
        const messages = this.buffer.split(/\r?\n\r?\n/);

        // Keep the last incomplete fragment in the buffer
        this.buffer = messages.pop() || '';

        // Process all complete frames
        for (const rawMessage of messages) {
          const trimmed = rawMessage.trim();
          if (!trimmed) continue;

          try {
            const parsed = JSON.parse(trimmed);
            if (parsed && parsed.url !== undefined) {
              this.onEvent(parsed.url, parsed.data);
            }
          } catch (jsonErr) {
            // Handle edge-case where multiple JSON objects merged in one block
            this.handleConcatenatedJson(trimmed);
          }
        }
      }

      this.handleDisconnect(true);
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('[StreamClient] Stream aborted by client intentionally.');
        this.handleDisconnect(false);
      } else {
        console.error('[StreamClient] Stream error encountered:', err.message);
        this.onError(err);
        this.handleDisconnect(true);
      }
    }
  }

  /**
   * Robust parser for edge-cases where multiple JSON objects arrive in a single packet.
   * Tracks curly brace nesting depth to accurately parse consecutive objects.
   *
   * @param {string} text - Raw string containing potentially merged JSON objects.
   * @private
   */
  handleConcatenatedJson(text) {
    let depth = 0;
    let startIdx = 0;
    let inString = false;
    let escape = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (char === '{') {
        if (depth === 0) startIdx = i;
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          const jsonSub = text.substring(startIdx, i + 1);
          try {
            const parsed = JSON.parse(jsonSub);
            if (parsed && parsed.url !== undefined) {
              this.onEvent(parsed.url, parsed.data);
            }
          } catch (e) {
            // Ignore incomplete substring
          }
        }
      }
    }
  }

  /**
   * Handles stream disconnection and schedules reconnect with exponential backoff.
   *
   * @param {boolean} [shouldReconnect=true] - Whether to attempt reconnection.
   * @private
   */
  handleDisconnect(shouldReconnect = true) {
    this.isConnected = false;
    this.onStatusChange('disconnected');

    if (shouldReconnect) {
      this.reconnectAttempts++;
      // Exponential backoff: 1.5s, 2.25s, 3.37s... up to maxReconnectDelayMs
      const delay = Math.min(1500 * Math.pow(1.5, this.reconnectAttempts - 1), this.maxReconnectDelayMs);
      console.log(`[StreamClient] Reconnecting in ${(delay / 1000).toFixed(1)}s (Attempt #${this.reconnectAttempts})...`);

      this.onStatusChange('reconnecting');
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, delay);
    }
  }

  /**
   * Closes the active stream and cancels any scheduled reconnect timers.
   */
  disconnect() {
    clearTimeout(this.reconnectTimer);
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isConnected = false;
    this.buffer = '';
    this.onStatusChange('disconnected');
  }
}

// Export to window global scope
window.StreamClient = StreamClient;
