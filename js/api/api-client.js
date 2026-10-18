/**
 * @file api-client.js
 * @description ProPresenter 7 REST API Client.
 * Comprehensive, typed wrapper providing access to all 22 ProPresenter OpenAPI domains.
 * Includes configurable timeouts, unified error formatting, and request sanitization.
 *
 * @version 1.0.0
 * @license MIT
 */

/**
 * HTTP Client for interacting with ProPresenter 7's REST API.
 *
 * @class ApiClient
 */
class ApiClient {
  /**
   * Constructs a new ApiClient instance.
   *
   * @param {string} [baseURL] - The base HTTP URL of the ProPresenter instance (e.g. "http://192.168.0.200:1025").
   */
  constructor(baseURL = '') {
    /**
     * The normalized base URL without trailing slash.
     * @type {string}
     */
    this.baseURL = baseURL || (window.AppConfig ? window.AppConfig.getConfig().baseURL : 'http://192.168.0.200:1025');

    /**
     * Default timeout for standard HTTP requests in milliseconds.
     * @type {number}
     */
    this.timeoutMs = 6000;
  }

  /**
   * Sets or updates the base URL for API requests.
   *
   * @param {string} url - New base URL.
   */
  setBaseURL(url) {
    this.baseURL = url.replace(/\/+$/, '');
  }

  /**
   * Core request dispatcher with automatic abort timeout and error handling.
   *
   * @param {string} endpoint - API path (e.g. "/version" or "v1/status/screens").
   * @param {Object} [options={}] - Fetch configuration options.
   * @param {string} [options.method='GET'] - HTTP method.
   * @param {Object} [options.body] - Request body object (serialized to JSON).
   * @param {Object} [options.headers] - Additional HTTP headers.
   * @param {number} [options.timeout] - Custom timeout override in milliseconds.
   * @returns {Promise<any>} Resolves with parsed JSON or text, or null for 204 No Content.
   * @throws {Error} Throws if network fails, times out, or returns a non-2xx status code.
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const controller = new AbortController();
    const timeout = options.timeout || this.timeoutMs;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const config = {
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      },
      signal: controller.signal,
      ...options
    };

    if (options.body !== undefined) {
      if (typeof options.body === 'object' || typeof options.body === 'boolean' || typeof options.body === 'number') {
        config.body = JSON.stringify(options.body);
      } else {
        config.body = String(options.body);
      }
    }

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API Error [${response.status} ${response.statusText}] at ${endpoint}`);
      }

      if (response.status === 204) return null; // No content returned

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await response.json();
      }
      return await response.text();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`API Timeout: ${endpoint} after ${timeout}ms`);
      }
      throw err;
    }
  }

  // =========================================================================
  // 1. SYSTEM & STATUS DOMAINS
  // =========================================================================

  /**
   * Retrieves general system version and host machine details.
   * @returns {Promise<{ name: string, platform: string, os_version: string, host_description: string, version: string }>}
   */
  async getVersion() {
    return this.request('/version');
  }

  /**
   * Requests a list of all configured screen outputs (Audience and Stage).
   * @returns {Promise<Array<{ id: { uuid: string, name: string, index: number }, size: { width: number, height: number }, screen_type: 'audience'|'stage' }>>}
   */
  async getScreens() {
    return this.request('/v1/status/screens');
  }

  /**
   * Requests the master power/output status of the Audience screens.
   * @returns {Promise<boolean>} Resolves true if audience screens are enabled.
   */
  async getAudienceScreenStatus() {
    return this.request('/v1/status/audience_screens');
  }

  /**
   * Enables or disables Audience screen output.
   * Sends POST to /v1/status/audience_screens (falls back to PUT if required by endpoint).
   * @param {boolean} enabled - Output state.
   * @returns {Promise<null>}
   */
  async setAudienceScreenStatus(enabled) {
    try {
      return await this.request('/v1/status/audience_screens', { method: 'POST', body: Boolean(enabled) });
    } catch (e) {
      return await this.request('/v1/status/audience_screens', { method: 'PUT', body: Boolean(enabled) });
    }
  }

  /**
   * Requests the master output status of the Stage screens.
   * @returns {Promise<boolean>}
   */
  async getStageScreenStatus() {
    return this.request('/v1/status/stage_screens');
  }

  /**
   * Enables or disables Stage screen output.
   * Sends POST to /v1/status/stage_screens (falls back to PUT if required by endpoint).
   * @param {boolean} enabled - Output state.
   * @returns {Promise<null>}
   */
  async setStageScreenStatus(enabled) {
    try {
      return await this.request('/v1/status/stage_screens', { method: 'POST', body: Boolean(enabled) });
    } catch (e) {
      return await this.request('/v1/status/stage_screens', { method: 'PUT', body: Boolean(enabled) });
    }
  }

  /**
   * Requests the current active status of all visual projection layers.
   * @returns {Promise<{ slide: boolean, media: boolean, video_input: boolean, props: boolean, messages: boolean, announcements: boolean, audio: boolean }>}
   */
  async getLayers() {
    return this.request('/v1/status/layers');
  }

  /**
   * Requests the current slide text/notes and next cue text/notes.
   * @returns {Promise<{ current: { text: string, notes: string, uuid: string }, next: { text: string, notes: string, uuid: string } }>}
   */
  async getSlideStatus() {
    return this.request('/v1/status/slide');
  }

  // =========================================================================
  // 2. PRESENTATION & CUE DOMAIN
  // =========================================================================

  /**
   * Requests details of the currently live active presentation.
   * @returns {Promise<{ presentation: Object }>}
   */
  async getActivePresentation() {
    return this.request('/v1/presentation/active');
  }

  /**
   * Requests the index and ID of the currently active slide cue.
   * @returns {Promise<{ presentation_index: { index: number, presentation_id: { uuid: string, name: string, index: number } } }>}
   */
  async getSlideIndex() {
    return this.request('/v1/presentation/slide_index');
  }

  /**
   * Requests details for a specific presentation by UUID.
   * @param {string} uuid - Presentation UUID.
   * @returns {Promise<{ presentation: Object }>}
   */
  async getPresentation(uuid) {
    return this.request(`/v1/presentation/${uuid}`);
  }

  /**
   * Focuses a presentation in ProPresenter without triggering its slides.
   * @param {string} uuid - Presentation UUID.
   * @returns {Promise<null>}
   */
  async focusPresentation(uuid) {
    return this.request(`/v1/presentation/${uuid}/focus`);
  }

  /**
   * Constructs the live image URL for a slide thumbnail.
   * @param {string} presentationUuid - Presentation UUID.
   * @param {number} slideIndex - 0-indexed cue number.
   * @param {number} [quality=400] - Image width resolution in pixels.
   * @returns {string} Fully qualified URL to fetch the JPEG thumbnail.
   */
  getSlideThumbnailUrl(presentationUuid, slideIndex, quality = 400) {
    return `${this.baseURL}/v1/presentation/${presentationUuid}/thumbnail/${slideIndex}?quality=${quality}`;
  }

  /**
   * Triggers a specific cue inside a presentation.
   * @param {string} presentationUuid - Presentation UUID.
   * @param {number} slideIndex - 0-indexed cue number.
   * @returns {Promise<null>}
   */
  async triggerSlide(presentationUuid, slideIndex) {
    return this.request(`/v1/presentation/${presentationUuid}/${slideIndex}/trigger`);
  }

  /**
   * Advances to the next cue in the active presentation.
   * @returns {Promise<null>}
   */
  async triggerNextSlide() {
    return this.request('/v1/presentation/active/next/trigger');
  }

  /**
   * Steps back to the previous cue in the active presentation.
   * @returns {Promise<null>}
   */
  async triggerPreviousSlide() {
    return this.request('/v1/presentation/active/previous/trigger');
  }

  /**
   * Retriggers the active presentation from the beginning.
   * @returns {Promise<null>}
   */
  async triggerActivePresentation() {
    return this.request('/v1/presentation/active/trigger');
  }

  /**
   * Triggers a specific group (e.g. Chorus 1, Verse 2) in a presentation.
   * @param {string} presentationUuid - Presentation UUID.
   * @param {string} groupId - Group identifier.
   * @returns {Promise<null>}
   */
  async triggerPresentationGroup(presentationUuid, groupId) {
    return this.request(`/v1/presentation/${presentationUuid}/group/${groupId}/trigger`);
  }

  /**
   * Controls presentation timeline playback.
   * @param {'play'|'pause'|'rewind'} operation - Timeline action.
   * @returns {Promise<null>}
   */
  async timelineOperation(operation) {
    return this.request(`/v1/presentation/active/timeline/${operation}`);
  }

  /**
   * Constructs the URL to fetch the current song chord chart.
   * @param {number} [quality=800] - Image resolution.
   * @returns {string} URL to chord chart image.
   */
  getChordChartUrl(quality = 800) {
    return `${this.baseURL}/v1/presentation/chord_chart?quality=${quality}`;
  }

  // =========================================================================
  // 3. STAGE DISPLAY & MESSAGES DOMAIN
  // =========================================================================

  /**
   * Requests a list of all configured stage display screens.
   * @returns {Promise<Array>}
   */
  async getStageScreens() {
    return this.request('/v1/stage/screens');
  }

  /**
   * Requests a list of all available stage display layout configurations.
   * @returns {Promise<Array>}
   */
  async getStageLayouts() {
    return this.request('/v1/stage/layouts');
  }

  /**
   * Requests the current stage screen to layout mapping.
   * @returns {Promise<Array>}
   */
  async getStageLayoutMap() {
    return this.request('/v1/stage/layout_map');
  }

  /**
   * Sets the active stage layout for one or more stage screens.
   * @param {Array<{ screen: { uuid?: string, name?: string }, layout: { uuid?: string, name?: string } }>} layoutMap
   * @returns {Promise<null>}
   */
  async setStageLayoutMap(layoutMap) {
    return this.request('/v1/stage/layout_map', { method: 'PUT', body: layoutMap });
  }

  /**
   * Sets the specified stage layout for a single stage screen.
   * @param {string} screenId - Stage screen UUID.
   * @param {string} layoutId - Stage layout UUID.
   * @returns {Promise<null>}
   */
  async setStageScreenLayout(screenId, layoutId) {
    return this.request(`/v1/stage/screen/${screenId}/layout/${layoutId}`);
  }

  /**
   * Constructs the thumbnail URL for a stage layout preset.
   * @param {string} layoutId - Layout UUID.
   * @param {number} [quality=400] - Image quality.
   * @returns {string}
   */
  getStageLayoutThumbnailUrl(layoutId, quality = 400) {
    return `${this.baseURL}/v1/stage/layout/${layoutId}/thumbnail?quality=${quality}`;
  }

  /**
   * Requests the currently visible stage message.
   * @returns {Promise<string>}
   */
  async getStageMessage() {
    return this.request('/v1/stage/message');
  }

  /**
   * Pushes a custom message banner to the stage confidence monitor.
   * @param {string} message - Message text.
   * @returns {Promise<null>}
   */
  async setStageMessage(message) {
    return this.request('/v1/stage/message', { method: 'PUT', body: { message } });
  }

  /**
   * Clears the active stage message from all stage displays.
   * @returns {Promise<null>}
   */
  async clearStageMessage() {
    return this.request('/v1/stage/message', { method: 'DELETE' });
  }

  // =========================================================================
  // 4. LOOKS & CLEAR DOMAINS
  // =========================================================================

  /**
   * Requests a list of all configured audience looks.
   * @returns {Promise<Array>}
   */
  async getLooks() {
    return this.request('/v1/looks');
  }

  /**
   * Requests the currently live audience look configuration.
   * @returns {Promise<Object>}
   */
  async getCurrentLook() {
    return this.request('/v1/look/current');
  }

  /**
   * Triggers and makes active a saved audience look preset.
   * @param {string} lookId - Look UUID, name, or index.
   * @returns {Promise<null>}
   */
  async triggerLook(lookId) {
    return this.request(`/v1/look/${lookId}/trigger`);
  }

  /**
   * Clears an individual projection layer.
   * @param {'audio'|'props'|'messages'|'announcements'|'slide'|'media'|'video_input'} layer - Layer name.
   * @returns {Promise<null>}
   */
  async clearLayer(layer) {
    return this.request(`/v1/clear/layer/${layer}`);
  }

  /**
   * Emergency clear function that clears slide, media, props, and message layers in parallel.
   * @returns {Promise<Array>}
   */
  async clearAll() {
    const layers = ['slide', 'media', 'props', 'messages'];
    return Promise.all(layers.map(l => this.clearLayer(l).catch(() => null)));
  }

  /**
   * Requests a list of all configured Clear Groups.
   * @returns {Promise<Array>}
   */
  async getClearGroups() {
    return this.request('/v1/clear/groups');
  }

  /**
   * Triggers a specific clear group.
   * @param {string} groupId - Clear group UUID.
   * @returns {Promise<null>}
   */
  async triggerClearGroup(groupId) {
    return this.request(`/v1/clear/group/${groupId}/trigger`);
  }

  // =========================================================================
  // 5. PLAYLISTS & LIBRARIES
  // =========================================================================

  /**
   * Requests all presentation playlists and folders.
   * @returns {Promise<Array>}
   */
  async getPlaylists() {
    return this.request('/v1/playlists');
  }

  /**
   * Requests items inside a specific playlist.
   * @param {string} playlistId - Playlist UUID.
   * @returns {Promise<{ items: Array }>}
   */
  async getPlaylist(playlistId) {
    return this.request(`/v1/playlist/${playlistId}`);
  }

  /**
   * Triggers an entire playlist from the beginning.
   * @param {string} playlistId - Playlist UUID.
   * @returns {Promise<null>}
   */
  async triggerPlaylist(playlistId) {
    return this.request(`/v1/playlist/${playlistId}/trigger`);
  }

  /**
   * Triggers a specific presentation item inside a playlist.
   * @param {string} playlistId - Playlist UUID.
   * @param {string} itemUuid - Presentation UUID inside the playlist.
   * @returns {Promise<null>}
   */
  async triggerPlaylistItem(playlistId, itemUuid) {
    return this.request(`/v1/playlist/${playlistId}/${itemUuid}/trigger`);
  }

  /**
   * Requests a list of all configured song/presentation libraries.
   * @returns {Promise<Array>}
   */
  async getLibraries() {
    return this.request('/v1/libraries');
  }

  /**
   * Requests all items within a specific library.
   * @param {string} libraryId - Library UUID or name.
   * @returns {Promise<{ items: Array }>}
   */
  async getLibrary(libraryId) {
    return this.request(`/v1/library/${libraryId}`);
  }

  /**
   * Triggers a presentation directly from a library.
   * @param {string} libraryId - Library UUID.
   * @param {string} presentationUuid - Presentation UUID.
   * @returns {Promise<null>}
   */
  async triggerLibraryItem(libraryId, presentationUuid) {
    return this.request(`/v1/library/${libraryId}/${presentationUuid}/trigger`);
  }

  // =========================================================================
  // 6. MEDIA & AUDIO
  // =========================================================================

  /**
   * Requests configured media playlists.
   * @returns {Promise<Array>}
   */
  async getMediaPlaylists() {
    return this.request('/v1/media/playlists');
  }

  /**
   * Requests items inside a media playlist.
   * @param {string} playlistId - Media playlist UUID.
   * @returns {Promise<{ items: Array }>}
   */
  async getMediaPlaylist(playlistId) {
    return this.request(`/v1/media/playlist/${playlistId}`);
  }

  /**
   * Constructs thumbnail URL for a media asset.
   * @param {string} mediaUuid - Media asset UUID.
   * @param {number} [quality=400] - Image quality.
   * @returns {string}
   */
  getMediaThumbnailUrl(mediaUuid, quality = 400) {
    return `${this.baseURL}/v1/media/${mediaUuid}/thumbnail?quality=${quality}`;
  }

  /**
   * Requests configured audio playlists.
   * @returns {Promise<Array>}
   */
  async getAudioPlaylists() {
    return this.request('/v1/audio/playlists');
  }

  /**
   * Requests items inside an audio playlist.
   * @param {string} playlistId - Audio playlist UUID.
   * @returns {Promise<{ items: Array }>}
   */
  async getAudioPlaylist(playlistId) {
    return this.request(`/v1/audio/playlist/${playlistId}`);
  }

  /**
   * Triggers an entire audio playlist from the start.
   * @param {string} playlistId - Audio playlist UUID.
   * @returns {Promise<null>}
   */
  async triggerAudioPlaylist(playlistId) {
    return this.request(`/v1/audio/playlist/${playlistId}/trigger`);
  }

  /**
   * Triggers a specific audio item/track within an audio playlist.
   * @param {string} playlistId - Audio playlist UUID.
   * @param {string|number} itemId - Audio item UUID or index.
   * @returns {Promise<null>}
   */
  async triggerAudioItem(playlistId, itemId) {
    try {
      await this.request(`/v1/audio/playlist/${playlistId}/focus`);
    } catch (e) {}
    return this.request(`/v1/audio/playlist/focused/${itemId}/trigger`);
  }

  // =========================================================================
  // 7. TIMERS & PRODUCTION
  // =========================================================================

  /**
   * Requests all configured timers.
   * @returns {Promise<Array>}
   */
  async getTimers() {
    return this.request('/v1/timers');
  }

  /**
   * Requests live values for all active timers.
   * @returns {Promise<Array>}
   */
  async getCurrentTimers() {
    return this.request('/v1/timers/current');
  }

  /**
   * Requests remaining time on the active video countdown timer.
   * @returns {Promise<string>}
   */
  async getVideoCountdown() {
    return this.request('/v1/timer/video_countdown');
  }

  /**
   * Requests current system clock timestamp from ProPresenter host.
   * @returns {Promise<number>} Unix epoch timestamp.
   */
  async getSystemTime() {
    return this.request('/v1/timer/system_time');
  }

  /**
   * Performs an operation on a timer.
   * @param {string} timerId - Timer UUID.
   * @param {'start'|'stop'|'reset'} operation - Action.
   * @returns {Promise<null>}
   */
  async timerOperation(timerId, operation) {
    return this.request(`/v1/timer/${timerId}/${operation}`);
  }

  /**
   * Adds or subtracts seconds from a running timer.
   * @param {string} timerId - Timer UUID.
   * @param {number} seconds - Number of seconds to increment (e.g. 60 or -60).
   * @returns {Promise<null>}
   */
  async incrementTimer(timerId, seconds) {
    return this.request(`/v1/timer/${timerId}/increment/${seconds}`);
  }

  // =========================================================================
  // 8. MESSAGES & PROPS
  // =========================================================================

  /**
   * Requests all configured screen messages.
   * @returns {Promise<Array>}
   */
  async getMessages() {
    return this.request('/v1/messages');
  }

  /**
   * Shows a message with optional token values.
   * @param {string} messageId - Message UUID.
   * @param {Object} [tokens={}] - Token key/value pairs.
   * @returns {Promise<null>}
   */
  async triggerMessage(messageId, tokens = {}) {
    return this.request(`/v1/message/${messageId}/trigger`, { method: 'POST', body: tokens });
  }

  /**
   * Hides a visible message.
   * @param {string} messageId - Message UUID.
   * @returns {Promise<null>}
   */
  async clearMessage(messageId) {
    return this.request(`/v1/message/${messageId}/clear`);
  }

  /**
   * Requests all configured overlay props.
   * @returns {Promise<Array>}
   */
  async getProps() {
    return this.request('/v1/props');
  }

  /**
   * Constructs thumbnail URL for a prop overlay.
   * @param {string} propId - Prop UUID.
   * @param {number} [quality=300] - Image quality.
   * @returns {string}
   */
  getPropThumbnailUrl(propId, quality = 300) {
    return `${this.baseURL}/v1/prop/${propId}/thumbnail?quality=${quality}`;
  }

  /**
   * Activates an overlay prop on screen.
   * @param {string} propId - Prop UUID.
   * @returns {Promise<null>}
   */
  async triggerProp(propId) {
    return this.request(`/v1/prop/${propId}/trigger`);
  }

  /**
   * Deactivates an overlay prop.
   * @param {string} propId - Prop UUID.
   * @returns {Promise<null>}
   */
  async clearProp(propId) {
    return this.request(`/v1/prop/${propId}/clear`);
  }

  // =========================================================================
  // 9. MACROS & CAPTURE
  // =========================================================================

  /**
   * Requests all configured macros.
   * @returns {Promise<Array>}
   */
  async getMacros() {
    return this.request('/v1/macros');
  }

  /**
   * Executes a macro sequence.
   * @param {string} macroId - Macro UUID.
   * @returns {Promise<null>}
   */
  async triggerMacro(macroId) {
    return this.request(`/v1/macro/${macroId}/trigger`);
  }

  /**
   * Requests live stream and disk capture status.
   * @returns {Promise<{ status: string, capture_time: string, status_description: string }>}
   */
  async getCaptureStatus() {
    return this.request('/v1/capture/status');
  }

  /**
   * Initiates livestream / disk recording.
   * @returns {Promise<null>}
   */
  async startCapture() {
    return this.request('/v1/capture/start');
  }

  /**
   * Terminates active livestream / disk recording.
   * @returns {Promise<null>}
   */
  async stopCapture() {
    return this.request('/v1/capture/stop');
  }
}

// Export to window global scope
window.ApiClient = ApiClient;
