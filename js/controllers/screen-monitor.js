/**
 * @file screen-monitor.js
 * @description Screen Output Monitor Controller.
 * Provides a dropdown selector for configured screens (Sony TV Audience, Stage Screen, ATEM),
 * and renders a high-fidelity real-time preview of the selected screen's output.
 *
 * @version 2.0.0
 * @license MIT
 */

class ScreenMonitorController {
  /**
   * Initializes the Screen Monitor Controller.
   * @param {ApiClient} apiClient
   * @param {StateStore} store
   */
  constructor(apiClient, store) {
    this.api = apiClient;
    this.store = store;

    // DOM references
    this.dropdown = document.getElementById('screenSelectorDropdown');
    this.thumbWrapper = document.getElementById('singleScreenThumbWrapper');
    this.typeLabel = document.getElementById('singleScreenTypeLabel');
    this.statusBadge = document.getElementById('singleScreenStatusBadge');

    /**
     * Currently selected screen UUID.
     * @type {string|null}
     */
    this.selectedScreenUuid = null;

    /**
     * Configured screens list.
     * @type {Array}
     */
    this.screens = [];

    this.init();
  }

  /**
   * Initializes listeners and preloads screen data.
   */
  init() {
    if (this.dropdown) {
      this.dropdown.addEventListener('change', (e) => {
        this.selectedScreenUuid = e.target.value;
        this.updateSelectedPreview();
      });
    }

    // Subscribe to state changes
    this.store.subscribe((state, prev) => {
      if (state.screens !== prev.screens) {
        this.screens = state.screens || [];
        this.populateDropdown();
        this.updateSelectedPreview();
      }
      if (state.slideStatus !== prev.slideStatus || state.activeSlideIndex !== prev.activeSlideIndex) {
        this.updateSelectedPreview();
      }
      if (state.audienceScreenActive !== prev.audienceScreenActive || state.stageScreenActive !== prev.stageScreenActive) {
        this.updateStatusBadge();
      }
    });

    this.loadScreens();
  }

  /**
   * Fetches screens from ProPresenter.
   */
  async loadScreens() {
    try {
      const screens = await this.api.getScreens();
      const safeScreens = Array.isArray(screens) ? screens : [];
      this.screens = safeScreens;
      this.store.setState({ screens: safeScreens });
      this.populateDropdown();
      this.updateSelectedPreview();
    } catch (err) {
      console.warn('[ScreenMonitor] Load error:', err.message);
    }
  }

  /**
   * Populates the screen select dropdown.
   */
  populateDropdown() {
    if (!this.dropdown) return;
    if (!this.screens.length) {
      this.dropdown.innerHTML = '<option value="">No screens detected</option>';
      return;
    }

    this.dropdown.innerHTML = this.screens.map(s => {
      const uuid = s.id ? s.id.uuid : s.uuid;
      const name = s.id ? s.id.name : (s.name || 'Screen');
      const type = (s.screen_type || 'audience').toUpperCase();
      return `<option value="${uuid}">${name} (${type})</option>`;
    }).join('');

    if (!this.selectedScreenUuid && this.screens.length > 0) {
      this.selectedScreenUuid = this.screens[0].id ? this.screens[0].id.uuid : this.screens[0].uuid;
      this.dropdown.value = this.selectedScreenUuid;
    }
  }

  /**
   * Returns the currently selected screen object.
   */
  getSelectedScreen() {
    if (!this.selectedScreenUuid) return this.screens[0] || null;
    return this.screens.find(s => (s.id ? s.id.uuid : s.uuid) === this.selectedScreenUuid) || this.screens[0] || null;
  }

  /**
   * Updates the live preview for the selected screen.
   */
  updateSelectedPreview() {
    if (!this.thumbWrapper) return;
    const screen = this.getSelectedScreen();
    if (!screen) {
      this.thumbWrapper.innerHTML = '<div class="text-muted small p-3 text-center">No screen selected</div>';
      return;
    }

    const isAudience = (screen.screen_type === 'audience');
    const screenName = screen.id ? screen.id.name : screen.name;

    if (this.typeLabel) {
      this.typeLabel.textContent = `${screenName} • ${isAudience ? 'Audience Output' : 'Stage Display'}`;
    }

    this.updateStatusBadge();

    const slideStatus = this.store.state.slideStatus || {};
    const activePres = this.store.state.activePresentation;
    const slideIdx = this.store.state.activeSlideIndex || 0;

    if (isAudience) {
      // For Audience, check if presentation slide thumbnail exists
      const presUuid = activePres && activePres.id ? activePres.id.uuid : null;
      const currentText = slideStatus.current ? (slideStatus.current.text || '') : '';

      if (presUuid) {
        const thumbUrl = this.api.getSlideThumbnailUrl(presUuid, slideIdx, 450);
        this.thumbWrapper.innerHTML = `
          <div class="position-relative w-100 h-100 d-flex align-items-center justify-content-center bg-black">
            <img src="${thumbUrl}" class="live-screen-img" alt="Audience Slide" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="live-audience-text-fallback d-none flex-column align-items-center justify-content-center p-2 text-center text-white font-tamil" style="max-height: 100%; overflow: hidden;">
              <span class="fs-6 fw-bold">${currentText || 'Audience Output Active'}</span>
            </div>
            ${currentText ? `<div class="live-text-overlay font-tamil">${currentText.replace(/\n/g, ' ')}</div>` : ''}
          </div>
        `;
      } else {
        this.thumbWrapper.innerHTML = `
          <div class="d-flex flex-column align-items-center justify-content-center h-100 p-2 text-center text-white bg-black">
            <span class="fs-6 fw-bold font-tamil mb-1">${currentText || screenName}</span>
            <span class="badge bg-dark text-secondary border border-secondary" style="font-size: 10px;">Live Audience Screen</span>
          </div>
        `;
      }
    } else {
      // For Stage Screens (Stage Screen, ATEM)
      const currentText = slideStatus.current ? (slideStatus.current.text || 'No text') : 'Waiting for slide trigger...';
      const nextText = slideStatus.next ? (slideStatus.next.text || '') : '';

      this.thumbWrapper.innerHTML = `
        <div class="stage-preview-box w-100 h-100 p-2 d-flex flex-column justify-content-between bg-black">
          <div class="stage-line">
            <span class="badge bg-warning text-black fw-bold" style="font-size: 9px;">NOW</span>
            <span class="stage-line-text small text-white font-tamil fw-bold text-truncate">${currentText}</span>
          </div>
          ${nextText ? `
            <div class="stage-line">
              <span class="badge bg-info text-black fw-bold" style="font-size: 9px;">NEXT</span>
              <span class="stage-line-text small text-secondary font-tamil text-truncate">${nextText}</span>
            </div>
          ` : ''}
          <div class="d-flex justify-content-between align-items-center text-muted" style="font-size: 10px;">
            <span><i class="fas fa-tv me-1 text-purple"></i>${screenName}</span>
            <span class="text-cyan font-mono">1920x1080</span>
          </div>
        </div>
      `;
    }
  }

  /**
   * Updates the Active status badge for the selected screen.
   */
  updateStatusBadge() {
    if (!this.statusBadge) return;
    const screen = this.getSelectedScreen();
    if (!screen) return;

    const isAudience = (screen.screen_type === 'audience');
    const isLive = isAudience ? this.store.state.audienceScreenActive : this.store.state.stageScreenActive;

    if (isLive !== false) {
      this.statusBadge.className = 'badge-prop badge-success';
      this.statusBadge.textContent = 'ACTIVE';
    } else {
      this.statusBadge.className = 'badge-prop badge-danger';
      this.statusBadge.textContent = 'OFFLINE';
    }
  }
}

// Export to window global scope
window.ScreenMonitorController = ScreenMonitorController;
