/**
 * @file stage-ctrl.js
 * @description Stage Display & Message Controller.
 * Manages Stage confidence display layout mapping, live stage message broadcasting to musicians
 * and speakers, and the song chord chart modal viewer.
 *
 * @version 1.0.0
 * @license MIT
 */

/**
 * Controller for Stage Display operations.
 *
 * @class StageController
 */
class StageController {
  /**
   * Initializes the Stage Controller.
   *
   * @param {ApiClient} apiClient - REST API client instance.
   * @param {StateStore} store - Reactive state store.
   */
  constructor(apiClient, store) {
    /** @type {ApiClient} */
    this.api = apiClient;

    /** @type {StateStore} */
    this.store = store;

    this.init();
  }

  /**
   * Initializes store subscriptions, event listeners, and loads initial stage metadata.
   */
  init() {
    this.store.subscribe('stage:message', (msg) => this.updateMessageDisplay(msg));
    this.bindEvents();
    this.loadStageData();
  }

  /**
   * Preloads stage layouts and screen-to-layout maps from ProPresenter.
   * @returns {Promise<void>}
   */
  async loadStageData() {
    try {
      const [layouts, layoutMap] = await Promise.all([
        this.api.getStageLayouts().catch(() => []),
        this.api.getStageLayoutMap().catch(() => [])
      ]);

      this.store.setState({
        stageLayouts: layouts || [],
        stageLayoutMap: layoutMap || []
      });
    } catch (err) {
      console.warn('[StageCtrl] Stage data load warning:', err.message);
    }
  }

  /**
   * Updates the UI alert banner when a live stage message is active.
   *
   * @param {string} msg - Stage message text.
   */
  updateMessageDisplay(msg) {
    const banner = document.getElementById('activeStageMsgBanner');
    const msgText = document.getElementById('activeStageMsgText');
    if (!banner || !msgText) return;

    if (msg && msg.trim()) {
      msgText.textContent = msg;
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }
  }

  /**
   * Binds click and submit events for stage messages and chord chart viewers.
   */
  bindEvents() {
    const sendBtn = document.getElementById('sendStageMsgBtn');
    const clearBtn = document.getElementById('clearStageMsgBtn');
    const input = document.getElementById('stageMsgInput');

    // Send Stage Message
    if (sendBtn) {
      sendBtn.addEventListener('click', async () => {
        const text = input ? input.value.trim() : '';
        if (!text) return;
        try {
          await this.api.setStageMessage(text);
          this.store.setState({ stageMessage: text });
          if (input) input.value = '';
          this.showToast('Stage message sent to monitors', 'success');
        } catch (e) {
          this.showToast('Failed to send stage message', 'danger');
        }
      });
    }

    // Clear Stage Message
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        try {
          await this.api.clearStageMessage();
          this.store.setState({ stageMessage: '' });
          this.showToast('Stage message cleared', 'info');
        } catch (e) {
          this.showToast('Failed to clear stage message', 'danger');
        }
      });
    }

    // View Chord Chart Modal Button
    const chordBtn = document.getElementById('viewChordChartBtn');
    if (chordBtn) {
      chordBtn.addEventListener('click', () => {
        this.showChordChartModal();
      });
    }
  }

  /**
   * Displays the modal displaying the live song chord chart.
   */
  showChordChartModal() {
    const modalImg = document.getElementById('chordChartModalImg');
    const modal = document.getElementById('chordChartModal');
    if (!modal) return;

    if (modalImg) {
      modalImg.style.display = 'block';
      modalImg.src = this.api.getChordChartUrl(900);
    }
    if (typeof bootstrap !== 'undefined') {
      bootstrap.Modal.getOrCreateInstance(modal).show();
    } else {
      modal.style.display = 'block';
    }
  }

  /**
   * Displays a temporary notification toast.
   *
   * @param {string} message - Toast message text.
   * @param {'success'|'danger'|'info'} [type='info'] - Style variant.
   */
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `studio-toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check' : 'fa-info-circle'} me-2"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }
}

// Export to window global scope
window.StageController = StageController;
