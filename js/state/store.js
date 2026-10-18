/**
 * @file store.js
 * @description Centralized Reactive State Store for ProPresenter Web Controller.
 * Implements a lightweight Publish/Subscribe pattern to facilitate decoupled communication
 * between streaming data inputs and modular UI presentation controllers.
 *
 * @version 1.0.0
 * @license MIT
 */

/**
 * @typedef {Object} ScreenObject
 * @property {{ uuid: string, name: string, index: number }} id - Screen identification.
 * @property {{ width: number, height: number }} size - Physical screen dimensions.
 * @property {'audience'|'stage'} screen_type - Screen role.
 */

/**
 * @typedef {Object} SlideStatus
 * @property {{ text: string, notes: string, uuid: string }} current - Current active slide data.
 * @property {{ text: string, notes: string, uuid: string }} next - Next cue slide data.
 */

/**
 * @typedef {Object} CaptureStatus
 * @property {'active'|'inactive'|'caution'|'error'} status - Stream or recording status.
 * @property {string} capture_time - Elapsed duration in hh:mm:ss format.
 * @property {string} status_description - Diagnostic description.
 */

/**
 * Reactive State Store.
 * Holds application state and dispatches change events to registered listeners.
 *
 * @class StateStore
 */
class StateStore {
  /**
   * Initializes the state store with default state structures.
   */
  constructor() {
    /**
     * Internal state container.
     * @type {Object}
     */
    this.state = {
      // --- Connection & Network ---
      /** @type {boolean} Connection health state */
      connected: false,
      /** @type {boolean} Indicates whether persistent chunk streaming is actively reading frames */
      streaming: false,
      /** @type {string|null} ProPresenter software version string */
      version: null,
      /** @type {string|null} Computer hostname hosting ProPresenter */
      hostName: null,
      /** @type {string|null} Last recorded error string */
      error: null,

      // --- Screens & Status ---
      /** @type {ScreenObject[]} Array of configured display screens */
      screens: [],
      /** @type {boolean} Master audience screen output power state */
      audienceScreensEnabled: false,
      /** @type {boolean} Master stage screen output power state */
      stageScreensEnabled: false,
      /** @type {Object.<string, boolean>} Status of individual projection layers */
      layers: {
        slide: false,
        media: false,
        video_input: false,
        props: false,
        messages: false,
        announcements: false,
        audio: false
      },
      /** @type {Object|null} Details of currently live audience look preset */
      currentLook: null,

      // --- Active Presentation & Slide Cues ---
      /** @type {Object|null} Full presentation object currently active */
      activePresentation: null,
      /** @type {string|null} UUID of currently active presentation */
      activePresentationUuid: null,
      /** @type {number|null} 0-indexed slide currently active on screen */
      currentSlideIndex: null,
      /** @type {SlideStatus} Current and next slide text and notes */
      slideStatus: {
        current: { text: '', notes: '', uuid: '' },
        next: { text: '', notes: '', uuid: '' }
      },

      // --- Stage Displays & Messages ---
      /** @type {Array} Configured stage screens */
      stageScreens: [],
      /** @type {Array} Available stage layout definitions */
      stageLayouts: [],
      /** @type {Array} Screen-to-layout mapping table */
      stageLayoutMap: [],
      /** @type {string} Active stage message string for speakers/singers */
      stageMessage: '',

      // --- Timers & Production Controls ---
      /** @type {string|null} Video countdown remaining time string (e.g. "03:45") */
      videoCountdown: null,
      /** @type {number|null} Unix timestamp from ProPresenter host */
      systemTime: null,
      /** @type {CaptureStatus} Livestream and disk recording state */
      captureStatus: {
        status: 'inactive',
        capture_time: '00:00:00',
        status_description: ''
      },

      // --- Navigation & Media Data ---
      /** @type {Array} Configured song libraries */
      libraries: [],
      /** @type {Array} Configured service playlists */
      playlists: [],
      /** @type {{ type: 'library'|'playlist', id: string, name: string }|null} Active container selection */
      selectedContainer: null,
      /** @type {Array} Items belonging to the selected container */
      containerItems: [],
      /** @type {Array} Configured media playlists */
      mediaPlaylists: [],
      /** @type {Array} Available macros */
      macros: [],
      /** @type {Array} Available props */
      props: []
    };

    /**
     * Map of event names to Sets of listener callbacks.
     * @type {Map<string, Set<Function>>}
     * @private
     */
    this.listeners = new Map();
  }

  /**
   * Subscribes a callback function to a state event.
   *
   * @param {string} event - The event name to listen for (e.g. 'screens:updated', 'slide:status', '*').
   * @param {Function} callback - The handler invoked when the event fires. Receives (data, state).
   * @returns {Function} An unsubscribe function to remove the listener.
   *
   * @example
   * const unsubscribe = store.subscribe('slide:status', (slideData) => {
   *   console.log('Current slide text:', slideData.current.text);
   * });
   * // Later:
   * unsubscribe();
   */
  subscribe(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event).delete(callback);
  }

  /**
   * Emits an event, notifying all subscribers registered for this event or wildcard '*'.
   *
   * @param {string} event - The event name to dispatch.
   * @param {*} [data] - Optional payload passed to listener callbacks.
   */
  emit(event, data) {
    // Notify specific event listeners
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try {
          cb(data, this.state);
        } catch (err) {
          console.error(`[StateStore] Error in listener for event '${event}':`, err);
        }
      });
    }

    // Notify wildcard '*' listeners
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach(cb => {
        try {
          cb(event, data, this.state);
        } catch (err) {
          console.error('[StateStore] Error in wildcard listener:', err);
        }
      });
    }
  }

  /**
   * Updates partial state fields and emits specific change events.
   *
   * @param {Object} updates - Key-value map of properties to update in state.
   */
  setState(updates) {
    let hasChanges = false;
    for (const [key, value] of Object.entries(updates)) {
      if (this.state[key] !== value) {
        this.state[key] = value;
        hasChanges = true;
        this.emit(`change:${key}`, value);
      }
    }
    if (hasChanges) {
      this.emit('state:updated', this.state);
    }
  }

  /**
   * Ingests incoming chunked events streamed from POST /v1/status/updates.
   * Normalizes URL endpoints, updates relevant state slices, and dispatches semantic events.
   *
   * @param {string} url - The URL path that generated this data frame (e.g. "status/slide", "presentation/slide_index").
   * @param {*} data - The payload parsed from the streaming chunk.
   */
  ingestStreamEvent(url, data) {
    // Strip leading "/v1/" or "/" for consistent path matching
    const cleanUrl = url.replace(/^\/?(v1\/)?/, '');

    switch (cleanUrl) {
      case 'status/screens':
        this.setState({ screens: Array.isArray(data) ? data : [] });
        this.emit('screens:updated', this.state.screens);
        break;

      case 'status/audience_screens':
        this.setState({ audienceScreensEnabled: Boolean(data) });
        this.emit('screen:audience', this.state.audienceScreensEnabled);
        break;

      case 'status/stage_screens':
        this.setState({ stageScreensEnabled: Boolean(data) });
        this.emit('screen:stage', this.state.stageScreensEnabled);
        break;

      case 'status/layers':
        this.setState({ layers: data || {} });
        this.emit('layers:updated', this.state.layers);
        break;

      case 'status/slide':
        if (data) {
          this.setState({
            slideStatus: {
              current: data.current || { text: '', notes: '', uuid: '' },
              next: data.next || { text: '', notes: '', uuid: '' }
            }
          });
          this.emit('slide:status', this.state.slideStatus);
        }
        break;

      case 'presentation/slide_index':
        if (data) {
          const payload = data.presentation_index || data;
          const idx = payload.index !== undefined ? payload.index : null;
          const presId = payload.presentation_id || null;
          const presUuid = presId ? (presId.uuid || (typeof presId === 'string' ? presId : null)) : null;

          if (idx !== null && idx !== undefined) {
            this.setState({
              currentSlideIndex: idx,
              activePresentationUuid: presUuid || this.state.activePresentationUuid
            });
            this.emit('presentation:slide_index', {
              index: idx,
              presentation_id: presId,
              presentation_uuid: presUuid,
              raw: data
            });
          }
        }
        break;

      case 'presentation/active':
        if (data && data.presentation) {
          this.setState({
            activePresentation: data.presentation,
            activePresentationUuid: data.presentation.id ? data.presentation.id.uuid : null
          });
          this.emit('presentation:active', data.presentation);
        }
        break;

      case 'stage/message':
        this.setState({ stageMessage: (typeof data === 'string' ? data : (data?.message || '')) });
        this.emit('stage:message', this.state.stageMessage);
        break;

      case 'capture/status':
        if (data) {
          this.setState({ captureStatus: data });
          this.emit('capture:status', data);
        }
        break;

      case 'timer/video_countdown':
        this.setState({ videoCountdown: data });
        this.emit('timer:video_countdown', data);
        break;

      case 'timer/system_time':
        this.setState({ systemTime: data });
        this.emit('timer:system_time', data);
        break;

      case 'look/current':
        this.setState({ currentLook: data });
        this.emit('look:current', data);
        break;

      default:
        // Pass-through for custom or less frequent streaming updates
        this.emit(`stream:${cleanUrl}`, data);
        break;
    }
  }
}

// Export to window global scope
window.StateStore = StateStore;
