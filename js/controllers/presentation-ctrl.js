/**
 * @file presentation-ctrl.js
 * @description Active Presentation & Slide Cue Grid Controller.
 * Manages the presentation view, cue rendering with group colors, thumbnail retrieval,
 * cue triggering, keyboard navigation, and timeline controls.
 *
 * @version 1.0.0
 * @license MIT
 */

/**
 * Controller for presentation cues and slide transport.
 *
 * @class PresentationController
 */
class PresentationController {
  /**
   * Initializes the Presentation Controller.
   *
   * @param {ApiClient} apiClient - REST API client instance.
   * @param {StateStore} store - Reactive state store.
   */
  constructor(apiClient, store) {
    /** @type {ApiClient} */
    this.api = apiClient;

    /** @type {StateStore} */
    this.store = store;

    /** @type {HTMLElement|null} */
    this.container = document.getElementById('slidesGrid');

    /** @type {HTMLElement|null} */
    this.titleElement = document.getElementById('activePresentationTitle');

    /** @type {HTMLElement|null} */
    this.countBadge = document.getElementById('slidesCountBadge');

    /** @type {HTMLElement|null} */
    this.currentSlideLabel = document.getElementById('currentSlideIndicator');

    /**
     * Flattened array of all slides across all presentation groups.
     * @type {Array<{ index: number, groupName: string, groupColor: Object, text: string, label: string }>}
     */
    this.slides = [];

    /**
     * UUID of the currently loaded presentation.
     * @type {string|null}
     */
    this.activePresentationId = null;

    /**
     * Last confirmed live presentation UUID from ProPresenter.
     * @type {string|null}
     */
    this.lastLivePresUuid = null;

    /**
     * Last confirmed live slide index from ProPresenter.
     * @type {number|null}
     */
    this.lastLiveSlideIdx = null;

    /**
     * Periodic 1-second polling timer ID for slide index updates.
     * @type {number|null}
     */
    this.slideIndexPollInterval = null;

    window.presentationCtrl = this;

    this.init();
  }

  /**
   * Initializes store subscriptions, UI controls, shortcuts, and live slide index polling.
   */
  init() {
    this.store.subscribe('presentation:active', (pres) => this.handleActivePresentation(pres));
    this.store.subscribe('change:activePresentation', (pres) => this.handleActivePresentation(pres));
    this.store.subscribe('presentation:slide_index', (data) => this.handleSlideIndex(data));
    this.bindControls();
    this.bindKeyboardShortcuts();
    this.startSlideIndexPolling();
  }

  /**
   * Checks if presentation name represents an untitled or placeholder document.
   * @param {string} name
   * @returns {boolean}
   */
  isUntitled(name) {
    if (!name) return true;
    const lower = String(name).trim().toLowerCase();
    return lower === 'untitled presentation' || lower === 'untitled' || lower === 'untitled document';
  }

  /**
   * Renders a clean empty prompt when no presentation or an untitled presentation is active.
   */
  renderEmptyState() {
    this.slides = [];
    this.activePresentationId = null;

    if (this.titleElement) {
      this.titleElement.textContent = 'No Presentation Loaded';
    }
    if (this.countBadge) {
      this.countBadge.textContent = '0 Cues';
    }
    if (this.currentSlideLabel) {
      this.currentSlideLabel.textContent = 'Slide -- of --';
    }
    if (this.container) {
      this.container.innerHTML = `
        <div class="col-12 py-5 text-center text-muted">
          <i class="fas fa-music fs-2 mb-2 text-warning opacity-75"></i>
          <p class="mb-1 fw-bold text-light">Select a song from the library or set on the left</p>
          <span class="small text-secondary">Click on any song to view slides and trigger presentation</span>
        </div>
      `;
    }
  }

  /**
   * Fetches the current presentation and slide index upon initial load.
   * @returns {Promise<void>}
   */
  async loadInitialPresentation() {
    try {
      const active = await this.api.getActivePresentation();
      if (active && (active.presentation || active.id)) {
        const pres = active.presentation || active;
        const presName = (pres.id && pres.id.name) ? pres.id.name : (pres.name || '');

        if (this.isUntitled(presName)) {
          console.log('[PresentationCtrl] Initial presentation is untitled. Skipping load.');
          this.renderEmptyState();
          return;
        }

        this.store.setState({
          activePresentation: pres,
          activePresentationUuid: pres.id ? pres.id.uuid : (pres.uuid || null)
        });
        this.handleActivePresentation(pres);
      } else {
        this.renderEmptyState();
      }

      const idxData = await this.api.getSlideIndex();
      if (idxData) {
        const payload = idxData.presentation_index || idxData;
        const presId = payload.presentation_id || null;
        this.lastLivePresUuid = presId ? (presId.uuid || (typeof presId === 'string' ? presId : null)) : null;
        this.lastLiveSlideIdx = payload.index !== undefined ? payload.index : null;
        this.store.ingestStreamEvent('presentation/slide_index', idxData);
      }
    } catch (err) {
      console.warn('[PresentationCtrl] Initial presentation fetch note:', err.message);
      this.renderEmptyState();
    }
  }

  /**
   * Flattens presentation groups and triggers slide card rendering.
   *
   * @param {Object} presentation - Full presentation object from ProPresenter.
   */
  handleActivePresentation(presentation) {
    if (!presentation) {
      this.renderEmptyState();
      return;
    }

    const pres = presentation.presentation || presentation;
    const presName = (pres.id && pres.id.name) ? pres.id.name : (pres.name || '');

    // If it's an untitled presentation, don't load it
    if (this.isUntitled(presName)) {
      console.log('[PresentationCtrl] Presentation is untitled. Skipping load.');
      this.renderEmptyState();
      return;
    }

    this.activePresentationId = pres.id ? pres.id.uuid : (pres.uuid || null);

    if (this.titleElement) {
      this.titleElement.textContent = presName;
    }

    // Flatten slides from nested groups
    const slides = [];
    let runningIndex = 0;

    if (pres.groups && Array.isArray(pres.groups)) {
      pres.groups.forEach(group => {
        const groupColor = group.color || { red: 0.4, green: 0.4, blue: 0.4, alpha: 1 };
        if (group.slides && Array.isArray(group.slides)) {
          group.slides.forEach(slide => {
            slides.push({
              index: runningIndex,
              groupName: group.name || 'Group',
              groupColor: groupColor,
              text: slide.text || '',
              label: slide.label || `Slide ${runningIndex + 1}`
            });
            runningIndex++;
          });
        }
      });
    }

    this.slides = slides;
    if (this.countBadge) {
      this.countBadge.textContent = `${slides.length} Cues`;
    }
    if (this.currentSlideLabel) {
      const activeIdx = this.store.state.currentSlideIndex;
      if (activeIdx !== null && activeIdx !== undefined) {
        this.currentSlideLabel.textContent = `Slide ${activeIdx + 1} of ${slides.length}`;
      } else {
        this.currentSlideLabel.textContent = `Ready to Trigger (0 of ${slides.length})`;
      }
    }

    this.renderSlides();
  }

  /**
   * Renders slide cards into the grid container and triggers asynchronous thumbnail loading.
   */
  renderSlides() {
    if (!this.container) return;

    if (this.slides.length === 0) {
      this.container.innerHTML = `
        <div class="col-12 py-5 text-center text-muted">
          <i class="fas fa-layer-group fs-2 mb-2 opacity-50"></i>
          <p>No presentation slides loaded. Select a song or set from the left panel.</p>
        </div>
      `;
      return;
    }

    this.container.innerHTML = this.slides.map(slide => {
      // Calculate RGB color string from normalized 0-1 values
      const r = Math.round((slide.groupColor.red || 0.4) * 255);
      const g = Math.round((slide.groupColor.green || 0.4) * 255);
      const b = Math.round((slide.groupColor.blue || 0.4) * 255);
      const rgbStr = `rgb(${r}, ${g}, ${b})`;

      return `
        <div class="slide-card" id="slide-card-${slide.index}" data-index="${slide.index}">
          <div class="slide-thumb-box" id="thumb-box-${slide.index}">
            <div class="slide-thumb-placeholder">
              <i class="fas fa-spinner fa-spin"></i>
              <span>Loading...</span>
            </div>
            <img class="slide-thumb-img" id="thumb-img-${slide.index}" style="display: none;" alt="Slide ${slide.index + 1}" />
          </div>

          <div class="slide-info-strip">
            <div class="slide-label-row">
              <span class="slide-label-text">${this.escape(slide.label)}</span>
              <span class="badge-prop" style="font-size: 9px; padding: 1px 5px;">#${slide.index + 1}</span>
            </div>
            <div class="slide-group-pill">
              <span class="group-color-dot" style="background: ${rgbStr};"></span>
              <span class="text-truncate">${this.escape(slide.groupName)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Asynchronously load thumbnail images
    this.slides.forEach(slide => {
      this.loadThumbnail(slide.index);
    });

    // Re-apply active slide highlight if index is already known
    const activeIdx = this.store.state.currentSlideIndex;
    if (activeIdx !== null && activeIdx !== undefined) {
      this.highlightActiveSlide(activeIdx);
    }
  }

  /**
   * Asynchronously loads a slide thumbnail image.
   *
   * @param {number} index - 0-indexed slide position.
   * @private
   */
  loadThumbnail(index) {
    if (!this.activePresentationId) return;
    const url = this.api.getSlideThumbnailUrl(this.activePresentationId, index, 360);
    const img = document.getElementById(`thumb-img-${index}`);
    const placeholder = document.querySelector(`#thumb-box-${index} .slide-thumb-placeholder`);

    if (!img) return;

    img.onload = () => {
      img.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
    };
    img.onerror = () => {
      if (placeholder) {
        placeholder.innerHTML = `<span class="small font-mono text-muted">Cue ${index + 1}</span>`;
      }
    };
    img.src = url;
  }

  /**
   * Starts high-frequency 1-second polling of GET /v1/presentation/slide_index.
   * Immediately synchronizes when an operator clicks a slide directly in the ProPresenter desktop software.
   */
  startSlideIndexPolling() {
    if (this.slideIndexPollInterval) {
      clearInterval(this.slideIndexPollInterval);
    }

    this.slideIndexPollInterval = setInterval(() => {
      this.pollSlideIndex();
    }, 1000);
  }

  /**
   * Stops the slide index polling interval.
   */
  stopSlideIndexPolling() {
    if (this.slideIndexPollInterval) {
      clearInterval(this.slideIndexPollInterval);
      this.slideIndexPollInterval = null;
    }
  }

  /**
   * Activates/focuses a presentation in ProPresenter desktop software (without triggering slides)
   * and loads all slides/groups into the Show section in the web remote UI.
   *
   * @param {string} uuid - Presentation UUID.
   * @param {string} [name=''] - Optional presentation title.
   * @returns {Promise<boolean>}
   */
  async loadAndFocusPresentation(uuid, name = '') {
    if (!uuid) return false;
    if (this.isUntitled(name)) return false;

    console.log(`[PresentationCtrl] Loading & focusing presentation: "${name}" (${uuid})`);

    // 1. Ensure UI is switched to Show view
    if (typeof window.setWorkspaceView === 'function') {
      window.setWorkspaceView('show');
    } else {
      document.getElementById('viewModeShowBtn')?.click();
    }

    try {
      // 2. Activate/focus in ProPresenter software without triggering slides
      await this.api.focusPresentation(uuid).catch(err => {
        console.warn(`[PresentationCtrl] Software focus API note:`, err.message);
      });

      // 3. Fetch full presentation details (groups & slides)
      const presData = await this.api.getPresentation(uuid).catch(() => null);
      const fullPres = (presData && presData.presentation) ? presData.presentation : (presData || {});

      if (!fullPres.name && name) fullPres.name = name;
      if (!fullPres.id) {
        fullPres.id = { uuid, name: fullPres.name || name, index: 0 };
      } else if (!fullPres.id.name && name) {
        fullPres.id.name = name;
      }

      // 4. Update internal active ID and store state
      this.activePresentationId = uuid;
      this.store.setState({
        activePresentation: fullPres,
        activePresentationUuid: uuid,
        currentSlideIndex: null
      });

      // 5. Render presentation slides into Show UI
      this.handleActivePresentation(fullPres);

      // 6. Reset slide indicator label to "Ready to Trigger (0 of N)"
      if (this.currentSlideLabel) {
        this.currentSlideLabel.textContent = `Ready to Trigger (0 of ${this.slides.length})`;
      }

      // Clear any live active outline from previous presentation
      document.querySelectorAll('.slide-card').forEach(c => c.classList.remove('active'));

      // 7. Scroll Show cues deck into view smoothly
      document.getElementById('cuesSectionWrapper')?.scrollIntoView({ behavior: 'smooth' });

      return true;
    } catch (err) {
      console.error(`[PresentationCtrl] Error loading presentation ${uuid}:`, err);
      return false;
    }
  }

  /**
   * Polls GET /v1/presentation/slide_index and updates the live focused slide.
   * Preserves any preview/focused presentation currently opened on the web remote
   * unless software or remote actively triggers a new slide live on screen.
   */
  async pollSlideIndex() {
    try {
      const data = await this.api.getSlideIndex();
      if (!data) return;

      const payload = data.presentation_index || data;
      const idx = payload.index !== undefined ? payload.index : null;
      const presId = payload.presentation_id || null;
      const presUuid = presId ? (presId.uuid || (typeof presId === 'string' ? presId : null)) : null;
      const presName = presId ? (presId.name || '') : '';

      if (idx === null || idx === undefined) return;

      // Track whether this is actually a new live slide trigger event from software/remote
      const isNewLiveEvent = (this.lastLivePresUuid !== presUuid) || (this.lastLiveSlideIdx !== idx);

      if (isNewLiveEvent) {
        this.lastLivePresUuid = presUuid;
        this.lastLiveSlideIdx = idx;

        // If software actively triggered a DIFFERENT presentation live on screen:
        if (presUuid && presUuid !== this.activePresentationId) {
          if (!this.isUntitled(presName)) {
            console.log(`[PresentationCtrl] External live slide triggered in "${presName}" (${presUuid}). Loading into deck.`);
            await this.loadPresentationByUuid(presUuid, presName);
          }
        }
      }

      // If the live slide belongs to the currently active presentation, highlight it as active
      if (presUuid === this.activePresentationId) {
        const currentIdx = this.store.state.currentSlideIndex;
        const cardEl = document.getElementById(`slide-card-${idx}`);
        const needsUpdate = (idx !== currentIdx) || (cardEl && !cardEl.classList.contains('active'));

        if (needsUpdate) {
          this.store.setState({ currentSlideIndex: idx });
          this.highlightActiveSlide(idx);
          if (this.currentSlideLabel) {
            this.currentSlideLabel.textContent = `Slide ${idx + 1} of ${this.slides.length || '?'}`;
          }
        }
      }
    } catch (err) {
      console.debug('[PresentationCtrl] Slide index poll check:', err.message);
    }
  }

  /**
   * Dynamically loads a presentation by UUID when software triggers a slide in a document not yet open on web.
   * @param {string} uuid
   * @param {string} [name='']
   */
  async loadPresentationByUuid(uuid, name = '') {
    if (!uuid || uuid === this.activePresentationId) return;

    try {
      console.log(`[PresentationCtrl] Software active presentation changed. Fetching: ${name || uuid}`);
      const presData = await this.api.getPresentation(uuid);
      const fullPres = (presData && presData.presentation) ? presData.presentation : (presData || {});

      if (!fullPres.name && name) fullPres.name = name;
      if (!fullPres.id) {
        fullPres.id = { uuid, name: fullPres.name || name, index: 0 };
      } else if (!fullPres.id.name && name) {
        fullPres.id.name = name;
      }

      this.activePresentationId = uuid;
      this.store.setState({
        activePresentation: fullPres,
        activePresentationUuid: uuid
      });
      this.handleActivePresentation(fullPres);
    } catch (err) {
      console.warn(`[PresentationCtrl] Failed to load presentation ${uuid}:`, err.message);
    }
  }

  /**
   * Handles slide index updates received from streaming events or polling.
   * Focuses and highlights the active slide as live.
   *
   * @param {{ index?: number, presentation_index?: Object, presentation_id?: Object, presentation_uuid?: string }} data
   */
  async handleSlideIndex(data) {
    if (!data) return;

    const payload = data.presentation_index || data;
    const index = payload.index !== undefined ? payload.index : null;
    const presId = payload.presentation_id || null;
    const presUuid = presId ? (presId.uuid || (typeof presId === 'string' ? presId : null)) : (data.presentation_uuid || null);
    const presName = presId ? (presId.name || '') : '';

    if (index === null || index === undefined) return;

    const isNewLiveEvent = (this.lastLivePresUuid !== presUuid) || (this.lastLiveSlideIdx !== index);
    if (isNewLiveEvent) {
      this.lastLivePresUuid = presUuid;
      this.lastLiveSlideIdx = index;

      if (presUuid && presUuid !== this.activePresentationId) {
        if (!this.isUntitled(presName)) {
          await this.loadPresentationByUuid(presUuid, presName);
        }
      }
    }

    if (presUuid === this.activePresentationId) {
      if (this.currentSlideLabel) {
        this.currentSlideLabel.textContent = `Slide ${index + 1} of ${this.slides.length || '?'}`;
      }
      this.highlightActiveSlide(index);
    }
  }

  /**
   * Applies active styling to the current slide card and scrolls it into view smoothly.
   * Focuses the slide as LIVE with amber accent and indicator badge.
   *
   * @param {number} index
   */
  highlightActiveSlide(index) {
    document.querySelectorAll('.slide-card').forEach(c => c.classList.remove('active'));
    const targetCard = document.getElementById(`slide-card-${index}`);
    if (targetCard) {
      targetCard.classList.add('active');
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /**
   * Binds click events for slide cards, next/prev buttons, and timeline controls.
   */
  bindControls() {
    // Slide Card Click Handler
    if (this.container) {
      this.container.addEventListener('click', async (e) => {
        const card = e.target.closest('.slide-card');
        if (card && this.activePresentationId) {
          const index = parseInt(card.getAttribute('data-index'), 10);
          try {
            console.log(`[PresentationCtrl] Triggering slide: /v1/presentation/${this.activePresentationId}/${index}/trigger`);
            await this.api.triggerSlide(this.activePresentationId, index);
            this.lastLivePresUuid = this.activePresentationId;
            this.lastLiveSlideIdx = index;
            this.store.setState({ currentSlideIndex: index });
            this.highlightActiveSlide(index);
            if (this.currentSlideLabel) {
              this.currentSlideLabel.textContent = `Slide ${index + 1} of ${this.slides.length}`;
            }
          } catch (err) {
            console.error('[PresentationCtrl] Failed to trigger slide:', err);
          }
        }
      });
    }

    // Next / Prev slide buttons
    document.getElementById('nextSlideBtn')?.addEventListener('click', () => this.api.triggerNextSlide().catch(() => {}));
    document.getElementById('prevSlideBtn')?.addEventListener('click', () => this.api.triggerPreviousSlide().catch(() => {}));
    document.getElementById('retriggerPresBtn')?.addEventListener('click', () => this.api.triggerActivePresentation().catch(() => {}));

    // Presentation Timeline buttons
    document.getElementById('timelinePlayBtn')?.addEventListener('click', () => this.api.timelineOperation('play').catch(() => {}));
    document.getElementById('timelinePauseBtn')?.addEventListener('click', () => this.api.timelineOperation('pause').catch(() => {}));
    document.getElementById('timelineRewindBtn')?.addEventListener('click', () => this.api.timelineOperation('rewind').catch(() => {}));
  }

  /**
   * Binds ergonomic keyboard navigation (Space / Arrow Keys).
   */
  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Do not trigger shortcuts when operator is typing into an input or textarea
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'PageDown') {
        e.preventDefault();
        this.api.triggerNextSlide().catch(() => {});
      } else if (e.code === 'ArrowLeft' || e.code === 'PageUp') {
        e.preventDefault();
        this.api.triggerPreviousSlide().catch(() => {});
      }
    });
  }

  /**
   * Sanitizes text to prevent XSS injection.
   * @param {string} text
   * @returns {string}
   * @private
   */
  escape(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export to window global scope
window.PresentationController = PresentationController;
