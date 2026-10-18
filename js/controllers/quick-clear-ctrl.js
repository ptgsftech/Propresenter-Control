/**
 * @file quick-clear-ctrl.js
 * @description Quick Clear & Production Automation Controller.
 * Manages rapid tactile clearing of individual or all visual projection layers,
 * audience looks preset triggers, macro automation sequences, and livestream/recording controls.
 *
 * @version 1.0.0
 * @license MIT
 */

/**
 * Controller for tactile layer clear buttons, looks, macros, and capture.
 *
 * @class QuickClearController
 */
class QuickClearController {
  /**
   * Initializes the QuickClearController.
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
    this.looksContainer = document.getElementById('looksBar');

    /** @type {HTMLElement|null} */
    this.macrosContainer = document.getElementById('macrosGrid');

    /** @type {HTMLElement|null} */
    this.captureStatusBadge = document.getElementById('captureStatusBadge');

    /** @type {HTMLElement|null} */
    this.captureTimerEl = document.getElementById('captureTimeText');

    this.init();
  }

  /**
   * Initializes event listeners, subscribers, and loads look/macro presets.
   */
  init() {
    this.bindClearButtons();
    this.bindCaptureButtons();
    this.store.subscribe('capture:status', (status) => this.updateCaptureUI(status));
    this.store.subscribe('look:current', () => this.highlightActiveLook());

    this.loadLooksAndMacros();
    this.loadCaptureStatus();
  }

  /**
   * Binds click events for all tactile quick-clear layer buttons.
   */
  bindClearButtons() {
    // Clear All (Slide, Media, Props, Messages)
    document.getElementById('clearAllBtn')?.addEventListener('click', () => {
      this.api.clearAll().catch(e => console.error(e));
      this.flashButton('clearAllBtn');
    });

    // Clear Text Slide Layer
    document.getElementById('clearSlideBtn')?.addEventListener('click', () => {
      this.api.clearLayer('slide').catch(e => console.error(e));
      this.flashButton('clearSlideBtn');
    });

    // Clear Background Media Layer
    document.getElementById('clearMediaBtn')?.addEventListener('click', () => {
      this.api.clearLayer('media').catch(e => console.error(e));
      this.flashButton('clearMediaBtn');
    });

    // Clear Overlay Props Layer
    document.getElementById('clearPropsBtn')?.addEventListener('click', () => {
      this.api.clearLayer('props').catch(e => console.error(e));
      this.flashButton('clearPropsBtn');
    });

    // Clear Screen & Stage Messages
    document.getElementById('clearMessagesBtn')?.addEventListener('click', () => {
      this.api.clearLayer('messages').catch(e => console.error(e));
      this.flashButton('clearMessagesBtn');
    });

    // Clear Audio Playback
    document.getElementById('clearAudioBtn')?.addEventListener('click', () => {
      this.api.clearLayer('audio').catch(e => console.error(e));
      this.flashButton('clearAudioBtn');
    });

    // Clear Live Video Input
    document.getElementById('clearVideoBtn')?.addEventListener('click', () => {
      this.api.clearLayer('video_input').catch(e => console.error(e));
      this.flashButton('clearVideoBtn');
    });

    // Clear Announcements Layer
    document.getElementById('clearAnnounceBtn')?.addEventListener('click', () => {
      this.api.clearLayer('announcements').catch(e => console.error(e));
      this.flashButton('clearAnnounceBtn');
    });
  }

  /**
   * Provides tactile button click animation feedback.
   * @param {string} id - DOM element ID.
   * @private
   */
  flashButton(id) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.style.transform = 'scale(0.92)';
    setTimeout(() => { btn.style.transform = ''; }, 150);
  }

  /**
   * Preloads audience looks and automated macros from ProPresenter.
   * @returns {Promise<void>}
   */
  async loadLooksAndMacros() {
    try {
      const [looks, macros] = await Promise.all([
        this.api.getLooks().catch(() => []),
        this.api.getMacros().catch(() => [])
      ]);

      this.renderLooks(Array.isArray(looks) ? looks : []);
      this.renderMacros(Array.isArray(macros) ? macros : []);
    } catch (err) {
      console.warn('[QuickClearCtrl] Looks/Macros load warning:', err.message);
    }
  }

  /**
   * Renders audience look preset chips into the toolbar.
   * @param {Array} looks
   */
  renderLooks(looks) {
    if (!this.looksContainer) return;
    if (looks.length === 0) {
      this.looksContainer.innerHTML = '<span class="text-muted small">No audience looks</span>';
      return;
    }

    this.looksContainer.innerHTML = looks.map(look => `
      <button class="btn-studio look-chip" data-id="${look.id.uuid || look.id}">
        <i class="fas fa-palette text-purple"></i>
        <span>${this.escape(look.id.name || look.name)}</span>
      </button>
    `).join('');

    this.looksContainer.querySelectorAll('.look-chip').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        try {
          await this.api.triggerLook(id);
          this.looksContainer.querySelectorAll('.look-chip').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        } catch (e) {
          console.error('[QuickClearCtrl] Trigger look error:', e);
        }
      });
    });

    // Also populate headerLooksSelect dropdown if present
    const headerLooksSelect = document.getElementById('headerLooksSelect');
    if (headerLooksSelect) {
      if (looks.length === 0) {
        headerLooksSelect.innerHTML = '<option value="">No Looks</option>';
      } else {
        headerLooksSelect.innerHTML = looks.map(look => {
          const id = look.id ? (look.id.uuid || look.id) : (look.uuid || look.name);
          const name = look.id ? (look.id.name || look.name) : look.name;
          return `<option value="${id}">${name}</option>`;
        }).join('');

        headerLooksSelect.onchange = async (e) => {
          const lId = e.target.value;
          if (lId) {
            try {
              await this.api.triggerLook(lId);
            } catch (err) {
              console.warn('[QuickClearCtrl] Look trigger error:', err.message);
            }
          }
        };
      }
    }

    this.highlightActiveLook();
  }

  /**
   * Highlights the chip matching the currently live audience look.
   */
  highlightActiveLook() {
    const current = this.store.state.currentLook;
    if (!current || !this.looksContainer) return;
    const curName = current.id ? current.id.name : null;
    this.looksContainer.querySelectorAll('.look-chip').forEach(chip => {
      if (chip.textContent.trim() === curName) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  /**
   * Renders color-coded automated macro buttons in the right sidebar.
   * @param {Array} macros
   */
  renderMacros(macros) {
    if (!this.macrosContainer) return;
    if (macros.length === 0) {
      this.macrosContainer.innerHTML = '<span class="text-muted small">No macros configured</span>';
      return;
    }

    this.macrosContainer.innerHTML = macros.map(macro => {
      const color = macro.color || { red: 0.3, green: 0.4, blue: 0.5 };
      const r = Math.round((color.red || 0.3) * 255);
      const g = Math.round((color.green || 0.4) * 255);
      const b = Math.round((color.blue || 0.5) * 255);

      return `
        <button class="btn-studio macro-pad-btn" data-id="${macro.id.uuid || macro.id}" style="border-left: 4px solid rgb(${r},${g},${b});">
          <i class="fas fa-bolt text-orange"></i>
          <span class="text-truncate">${this.escape(macro.id.name || macro.name)}</span>
        </button>
      `;
    }).join('');

    this.macrosContainer.querySelectorAll('.macro-pad-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        try {
          await this.api.triggerMacro(id);
          btn.style.boxShadow = '0 0 12px var(--accent-orange)';
          setTimeout(() => { btn.style.boxShadow = ''; }, 300);
        } catch (e) {
          console.error('[QuickClearCtrl] Trigger macro error:', e);
        }
      });
    });
  }

  // --- LIVESTREAM & DISK CAPTURE ---

  /**
   * Loads initial recording and streaming status.
   * @returns {Promise<void>}
   */
  async loadCaptureStatus() {
    try {
      const status = await this.api.getCaptureStatus();
      if (status) this.updateCaptureUI(status);
    } catch (err) {
      console.warn('[QuickClearCtrl] Capture status load warning:', err.message);
    }
  }

  /**
   * Updates livestream / recording status badges and timers.
   * @param {CaptureStatus} captureData
   */
  updateCaptureUI(captureData) {
    if (!captureData) return;
    const isLive = captureData.status === 'active';

    if (this.captureStatusBadge) {
      this.captureStatusBadge.className = `badge-prop ${isLive ? 'badge-success' : 'badge-danger'}`;
      this.captureStatusBadge.innerHTML = `<i class="fas fa-circle" style="font-size: 8px;"></i> ${captureData.status.toUpperCase()}`;
    }

    if (this.captureTimerEl && captureData.capture_time) {
      this.captureTimerEl.textContent = captureData.capture_time;
    }
  }

  /**
   * Binds start and stop recording buttons with user confirmation.
   */
  bindCaptureButtons() {
    document.getElementById('startCaptureBtn')?.addEventListener('click', async () => {
      if (confirm('Start Live Stream / Disk Recording in ProPresenter?')) {
        try {
          await this.api.startCapture();
        } catch (e) {
          console.error('[QuickClearCtrl] Start capture error:', e);
        }
      }
    });

    document.getElementById('stopCaptureBtn')?.addEventListener('click', async () => {
      if (confirm('Stop Live Stream / Recording?')) {
        try {
          await this.api.stopCapture();
        } catch (e) {
          console.error('[QuickClearCtrl] Stop capture error:', e);
        }
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
window.QuickClearController = QuickClearController;
