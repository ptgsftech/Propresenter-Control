/**
 * @file timer-ctrl.js
 * @description Timer & Production Clocks Controller.
 * Manages video playback countdowns, countdown/count-up timers, system clock display,
 * and rapid timer increments (+1 min).
 *
 * @version 1.0.0
 * @license MIT
 */

/**
 * Controller for timers and clocks.
 *
 * @class TimerController
 */
class TimerController {
  /**
   * Initializes the Timer Controller.
   *
   * @param {ApiClient} apiClient - REST API client.
   * @param {StateStore} store - Reactive state store.
   */
  constructor(apiClient, store) {
    /** @type {ApiClient} */
    this.api = apiClient;

    /** @type {StateStore} */
    this.store = store;

    /** @type {HTMLElement|null} */
    this.videoCountdownContainer = document.getElementById('videoCountdownWidget');

    /** @type {HTMLElement|null} */
    this.videoTimeText = document.getElementById('videoCountdownText');

    /** @type {HTMLElement|null} */
    this.clockDisplay = document.getElementById('headerClockDisplay');

    /** @type {HTMLElement|null} */
    this.timersListContainer = document.getElementById('timersListWidget');

    this.init();
  }

  /**
   * Starts clock interval, subscribes to video countdowns, and loads timers.
   */
  init() {
    this.startSystemClock();
    this.store.subscribe('timer:video_countdown', (countdown) => this.updateVideoCountdown(countdown));
    this.loadTimers();
  }

  /**
   * Starts a 1-second interval to update the header digital clock.
   * @private
   */
  startSystemClock() {
    const update = () => {
      if (this.clockDisplay) {
        const now = new Date();
        this.clockDisplay.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    };
    setInterval(update, 1000);
    update();
  }

  /**
   * Updates or hides the video countdown remaining time banner.
   *
   * @param {string|null} countdown - Time string (e.g. "02:45").
   */
  updateVideoCountdown(countdown) {
    if (!this.videoCountdownContainer || !this.videoTimeText) return;

    if (countdown && countdown !== '00:00:00' && countdown !== '00:00' && countdown !== '0') {
      this.videoTimeText.textContent = countdown;
      this.videoCountdownContainer.style.display = 'flex';
    } else {
      this.videoCountdownContainer.style.display = 'none';
    }
  }

  /**
   * Fetches configured timers from ProPresenter.
   * @returns {Promise<void>}
   */
  async loadTimers() {
    if (!this.timersListContainer) return;
    try {
      const timers = await this.api.getTimers();
      const list = Array.isArray(timers) ? timers : [];
      this.renderTimers(list);
    } catch (err) {
      console.warn('[TimerCtrl] Timers load warning:', err.message);
    }
  }

  /**
   * Renders interactive cards for each configured timer.
   *
   * @param {Array} timers
   */
  renderTimers(timers) {
    if (!this.timersListContainer) return;
    if (timers.length === 0) {
      this.timersListContainer.innerHTML = '<span class="text-muted small">No active timers</span>';
      return;
    }

    this.timersListContainer.innerHTML = timers.map(t => {
      const id = t.id || t;
      const uuid = id.uuid || id.id;
      const name = id.name || 'Timer';

      return `
        <div class="timer-item-card d-flex align-items-center justify-content-between p-2 rounded mb-2 bg-dark border border-secondary" data-id="${uuid}">
          <div class="text-truncate">
            <span class="small fw-bold text-white text-truncate d-block">${this.escape(name)}</span>
            <span class="font-mono text-orange small" id="timer-val-${uuid}">--:--</span>
          </div>
          <div class="d-flex align-items-center gap-1">
            <button class="btn-studio btn-icon-only timer-op-btn" data-op="start" title="Start Timer">
              <i class="fas fa-play text-success" style="font-size: 10px;"></i>
            </button>
            <button class="btn-studio btn-icon-only timer-op-btn" data-op="stop" title="Stop Timer">
              <i class="fas fa-stop text-danger" style="font-size: 10px;"></i>
            </button>
            <button class="btn-studio btn-icon-only timer-op-btn" data-op="reset" title="Reset Timer">
              <i class="fas fa-rotate-left text-secondary" style="font-size: 10px;"></i>
            </button>
            <button class="btn-studio btn-icon-only timer-inc-btn" data-sec="60" title="+1 Minute">
              <span style="font-size: 9px; font-weight: 800;">+1m</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Bind timer actions (start, stop, reset, increment)
    this.timersListContainer.querySelectorAll('.timer-item-card').forEach(card => {
      const timerId = card.getAttribute('data-id');

      card.querySelectorAll('.timer-op-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const op = btn.getAttribute('data-op');
          try {
            await this.api.timerOperation(timerId, op);
          } catch (err) {
            console.error('[TimerCtrl] Timer operation error:', err);
          }
        });
      });

      card.querySelectorAll('.timer-inc-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const sec = parseInt(btn.getAttribute('data-sec'), 10);
          try {
            await this.api.incrementTimer(timerId, sec);
          } catch (err) {
            console.error('[TimerCtrl] Timer increment error:', err);
          }
        });
      });
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
window.TimerController = TimerController;
