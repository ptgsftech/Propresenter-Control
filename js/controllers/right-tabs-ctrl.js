/**
 * @file right-tabs-ctrl.js
 * @description Controller for the 6-Tab Right Drawer:
 * Audio | Stage | Timer | Message | Props | Macros.
 * Lazily calls corresponding REST APIs on-demand when user clicks each tab.
 *
 * @version 1.0.0
 * @license MIT
 */

class RightTabsController {
  /**
   * Constructs the RightTabsController.
   * @param {ApiClient} apiClient
   * @param {StateStore} store
   */
  constructor(apiClient, store) {
    this.apiClient = apiClient;
    this.store = store;

    // Cache of loaded tab states to avoid duplicate fetches if already loaded recently
    this.loadedTabs = new Set();
    this.selectedAudioPlaylistId = null;

    // DOM references
    this.tabsContainer = document.getElementById('rightControlTabs');

    // Audio elements
    this.audioPlaylistSelect = document.getElementById('audioPlaylistSelect');
    this.audioTracksList = document.getElementById('audioTracksList');
    this.audioPlayBtn = document.getElementById('audioPlayBtn');
    this.audioPauseBtn = document.getElementById('audioPauseBtn');
    this.audioClearBtn = document.getElementById('audioClearBtn');

    // Stage elements
    this.stageScreenLayoutSelect = document.getElementById('stageScreenLayoutSelect');
    this.atemScreenLayoutSelect = document.getElementById('atemScreenLayoutSelect');
    this.stageScreenCurrentSlide = document.getElementById('stageScreenCurrentSlide');
    this.atemScreenCurrentSlide = document.getElementById('atemScreenCurrentSlide');
    this.stageMessageInput = document.getElementById('stageMessageInput');
    this.sendStageMessageBtn = document.getElementById('sendStageMessageBtn');
    this.clearStageMsgBtn2 = document.getElementById('clearStageMsgBtn2');
    this.stageMsgCurrentStatus = document.getElementById('stageMsgCurrentStatus');

    // Timer elements
    this.timersListContainer = document.getElementById('timersListContainer');
    this.refreshTimersBtn = document.getElementById('refreshTimersBtn');

    // Message elements
    this.messagesListContainer = document.getElementById('messagesListContainer');

    // Props elements
    this.propsListContainer = document.getElementById('propsListContainer');
    this.clearAllPropsBtn = document.getElementById('clearAllPropsBtn');

    // Macros elements
    this.macrosListContainer = document.getElementById('macrosListContainer');

    this.initListeners();
  }

  /**
   * Binds event listeners for tab switching and controls.
   */
  initListeners() {
    // 1. Tab Click Event Listener (Bootstrap Tab shown event)
    if (this.tabsContainer) {
      this.tabsContainer.addEventListener('shown.bs.tab', (e) => {
        const targetBtn = e.target;
        const tabName = targetBtn.getAttribute('data-tab-name');
        console.log(`[RightTabs] Tab activated: ${tabName}`);
        this.loadTabData(tabName);
      });
    }

    // 2. Audio Select change
    if (this.audioPlaylistSelect) {
      this.audioPlaylistSelect.addEventListener('change', (e) => {
        const playlistId = e.target.value;
        if (playlistId) {
          this.selectedAudioPlaylistId = playlistId;
          this.loadAudioTracks(playlistId);
        }
      });
    }

    // Audio transport
    if (this.audioPlayBtn) {
      this.audioPlayBtn.addEventListener('click', () => {
        this.apiClient.request('/v1/transport/play').catch(() => {});
      });
    }
    if (this.audioPauseBtn) {
      this.audioPauseBtn.addEventListener('click', () => {
        this.apiClient.request('/v1/transport/pause').catch(() => {});
      });
    }
    if (this.audioClearBtn) {
      this.audioClearBtn.addEventListener('click', () => {
        this.apiClient.clearLayer('audio').catch(() => {});
      });
    }

    // 3. Stage Screen Layout Selectors
    if (this.stageScreenLayoutSelect) {
      this.stageScreenLayoutSelect.addEventListener('change', (e) => {
        const screenId = e.target.getAttribute('data-screen-id');
        const layoutId = e.target.value;
        this.applyStageLayout(screenId, layoutId, 'Stage Screen');
      });
    }
    if (this.atemScreenLayoutSelect) {
      this.atemScreenLayoutSelect.addEventListener('change', (e) => {
        const screenId = e.target.getAttribute('data-screen-id');
        const layoutId = e.target.value;
        this.applyStageLayout(screenId, layoutId, 'ATEM Screen');
      });
    }

    // Stage Message
    if (this.sendStageMessageBtn && this.stageMessageInput) {
      this.sendStageMessageBtn.addEventListener('click', () => {
        const msg = this.stageMessageInput.value.trim();
        if (!msg) return;
        this.apiClient.setStageMessage(msg).then(() => {
          if (this.stageMsgCurrentStatus) {
            this.stageMsgCurrentStatus.innerHTML = `<span class="text-danger fw-bold"><i class="fas fa-bullhorn me-1"></i> Live: "${msg}"</span>`;
          }
        }).catch(err => alert('Failed to send stage message: ' + err.message));
      });
    }
    if (this.clearStageMsgBtn2) {
      this.clearStageMsgBtn2.addEventListener('click', () => {
        this.apiClient.clearStageMessage().then(() => {
          if (this.stageMessageInput) this.stageMessageInput.value = '';
          if (this.stageMsgCurrentStatus) this.stageMsgCurrentStatus.textContent = 'No active stage message';
        }).catch(() => {});
      });
    }

    // 4. Timer refresh
    if (this.refreshTimersBtn) {
      this.refreshTimersBtn.addEventListener('click', () => {
        this.loadTimersTab();
      });
    }

    // 5. Clear all props
    if (this.clearAllPropsBtn) {
      this.clearAllPropsBtn.addEventListener('click', () => {
        this.apiClient.clearLayer('props').then(() => {
          this.loadPropsTab();
        }).catch(() => {});
      });
    }

    // Initial load for default active tab (Audio)
    setTimeout(() => {
      this.loadTabData('audio');
    }, 400);
  }

  /**
   * Router to trigger the exact API for the activated tab.
   * @param {string} tabName - 'audio' | 'stage' | 'timer' | 'message' | 'props' | 'macros'
   */
  async loadTabData(tabName) {
    try {
      switch (tabName) {
        case 'audio':
          await this.loadAudioTab();
          break;
        case 'stage':
          await this.loadStageTab();
          break;
        case 'timer':
          await this.loadTimersTab();
          break;
        case 'message':
          await this.loadMessagesTab();
          break;
        case 'props':
          await this.loadPropsTab();
          break;
        case 'macros':
          await this.loadMacrosTab();
          break;
        default:
          break;
      }
      this.loadedTabs.add(tabName);
    } catch (err) {
      console.warn(`[RightTabs] Error loading ${tabName} data:`, err.message);
    }
  }

  // =========================================================================
  // 1. AUDIO TAB
  // =========================================================================
  async loadAudioTab() {
    if (!this.audioPlaylistSelect) return;
    try {
      const playlists = await this.apiClient.getAudioPlaylists();
      if (!playlists || !playlists.length) {
        this.audioPlaylistSelect.innerHTML = '<option value="">No Audio Playlists</option>';
        if (this.audioTracksList) this.audioTracksList.innerHTML = '<div class="text-muted small p-3 text-center">No audio playlists found in ProPresenter.</div>';
        return;
      }

      this.audioPlaylistSelect.innerHTML = playlists.map(pl => {
        const id = pl.id ? pl.id.uuid : pl.uuid;
        const name = pl.id ? pl.id.name : pl.name;
        return `<option value="${id}">${name}</option>`;
      }).join('');

      const firstId = playlists[0].id ? playlists[0].id.uuid : playlists[0].uuid;
      this.selectedAudioPlaylistId = firstId;
      await this.loadAudioTracks(firstId);
    } catch (e) {
      console.error('[RightTabs] Audio error:', e);
    }
  }

  async loadAudioTracks(playlistId) {
    if (!this.audioTracksList) return;
    this.audioTracksList.innerHTML = '<div class="text-muted small p-2 text-center"><i class="fas fa-spinner fa-spin me-1"></i> Loading tracks...</div>';

    try {
      const playlist = await this.apiClient.getAudioPlaylist(playlistId);
      const items = (playlist && playlist.items) ? playlist.items : [];

      if (!items.length) {
        this.audioTracksList.innerHTML = '<div class="text-muted small p-3 text-center">Empty playlist. Add MP3 / WAV audio files in ProPresenter.</div>';
        return;
      }

      this.audioTracksList.innerHTML = items.map((item, idx) => {
        const name = (item.id && item.id.name) ? item.id.name : `Track ${idx + 1}`;
        const itemId = (item.id && item.id.uuid) ? item.id.uuid : idx;
        const durationSec = item.duration || 0;
        const mins = Math.floor(durationSec / 60);
        const secs = Math.floor(durationSec % 60).toString().padStart(2, '0');
        const durStr = durationSec ? `${mins}:${secs}` : '';

        return `
          <div class="audio-track-item d-flex align-items-center justify-content-between p-2 mb-1 rounded bg-black bg-opacity-40 border border-secondary cursor-pointer" data-item-id="${itemId}" data-playlist-id="${playlistId}">
            <div class="d-flex align-items-center gap-2 overflow-hidden">
              <span class="badge bg-secondary text-white" style="font-size: 9px;"><i class="fas fa-play"></i></span>
              <span class="small text-white text-truncate fw-semibold">${name}</span>
            </div>
            ${durStr ? `<span class="small font-mono text-muted" style="font-size: 10px;">${durStr}</span>` : ''}
          </div>
        `;
      }).join('');

      // Click to trigger audio item
      this.audioTracksList.querySelectorAll('.audio-track-item').forEach(el => {
        el.addEventListener('click', async () => {
          const pId = el.getAttribute('data-playlist-id');
          const iId = el.getAttribute('data-item-id');
          el.classList.add('border-warning');
          try {
            await this.apiClient.triggerAudioItem(pId, iId);
          } catch (e) {
            console.warn('[RightTabs] Audio trigger:', e.message);
          }
          setTimeout(() => el.classList.remove('border-warning'), 1000);
        });
      });
    } catch (e) {
      this.audioTracksList.innerHTML = `<div class="text-danger small p-2">Error loading tracks: ${e.message}</div>`;
    }
  }

  // =========================================================================
  // 2. STAGE TAB
  // =========================================================================
  async loadStageTab() {
    try {
      const [screens, layouts, layoutMap, slideStatus] = await Promise.all([
        this.apiClient.getStageScreens().catch(() => []),
        this.apiClient.getStageLayouts().catch(() => []),
        this.apiClient.getStageLayoutMap().catch(() => []),
        this.apiClient.request('/v1/status/slide').catch(() => null)
      ]);

      // Populate layout dropdown options
      const layoutOptionsHtml = layouts.map(l => {
        const id = l.id ? l.id.uuid : l.uuid;
        const name = l.id ? l.id.name : l.name;
        return `<option value="${id}">${name}</option>`;
      }).join('');

      // Find current mapping
      let stageScreenCurrentLayoutId = null;
      let atemCurrentLayoutId = null;

      if (Array.isArray(layoutMap)) {
        layoutMap.forEach(map => {
          const sName = (map.screen && map.screen.name) ? map.screen.name.toLowerCase() : '';
          const lId = map.layout ? map.layout.uuid : null;
          if (sName.includes('stage')) stageScreenCurrentLayoutId = lId;
          if (sName.includes('atem')) atemCurrentLayoutId = lId;
        });
      }

      if (this.stageScreenLayoutSelect) {
        this.stageScreenLayoutSelect.innerHTML = layoutOptionsHtml;
        if (stageScreenCurrentLayoutId) this.stageScreenLayoutSelect.value = stageScreenCurrentLayoutId;
      }

      if (this.atemScreenLayoutSelect) {
        this.atemScreenLayoutSelect.innerHTML = layoutOptionsHtml;
        if (atemCurrentLayoutId) this.atemScreenLayoutSelect.value = atemCurrentLayoutId;
      }

      // Update current slide text preview
      if (slideStatus && slideStatus.current) {
        const currentText = slideStatus.current.text || 'No text on current slide';
        if (this.stageScreenCurrentSlide) this.stageScreenCurrentSlide.textContent = currentText;
        if (this.atemScreenCurrentSlide) this.atemScreenCurrentSlide.textContent = currentText;
      }

      // Check current stage message
      const activeMsg = await this.apiClient.getStageMessage().catch(() => '');
      if (this.stageMsgCurrentStatus) {
        this.stageMsgCurrentStatus.innerHTML = activeMsg
          ? `<span class="text-danger fw-bold"><i class="fas fa-bullhorn me-1"></i> Active: "${activeMsg}"</span>`
          : 'No active stage message';
      }
    } catch (e) {
      console.warn('[RightTabs] Stage tab error:', e);
    }
  }

  async applyStageLayout(screenId, layoutId, screenName) {
    try {
      await this.apiClient.setStageScreenLayout(screenId, layoutId);
      console.log(`[RightTabs] Updated ${screenName} layout to ${layoutId}`);
    } catch (e) {
      console.warn(`[RightTabs] Error updating stage layout:`, e.message);
    }
  }

  // =========================================================================
  // 3. TIMERS TAB
  // =========================================================================
  async loadTimersTab() {
    if (!this.timersListContainer) return;
    this.timersListContainer.innerHTML = '<div class="text-muted small p-2 text-center"><i class="fas fa-spinner fa-spin me-1"></i> Loading timers...</div>';

    try {
      const [timers, currentTimers] = await Promise.all([
        this.apiClient.getTimers().catch(() => []),
        this.apiClient.getCurrentTimers().catch(() => [])
      ]);

      if (!timers || !timers.length) {
        this.timersListContainer.innerHTML = '<div class="text-muted small p-3 text-center">No timers configured in ProPresenter.</div>';
        return;
      }

      const currentMap = new Map();
      if (Array.isArray(currentTimers)) {
        currentTimers.forEach(ct => {
          const id = (ct.id && ct.id.uuid) ? ct.id.uuid : ct.uuid;
          if (id) currentMap.set(id, ct);
        });
      }

      this.timersListContainer.innerHTML = timers.map(t => {
        const id = t.id ? t.id.uuid : t.uuid;
        const name = t.id ? t.id.name : t.name;
        const liveInfo = currentMap.get(id);
        const isRunning = liveInfo && liveInfo.state === 'running';
        const displayTime = (liveInfo && liveInfo.time) ? liveInfo.time : '00:00:00';

        return `
          <div class="timer-item-card p-2 mb-2 rounded bg-black bg-opacity-50 border ${isRunning ? 'border-warning shadow-sm' : 'border-secondary'}">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="small fw-bold text-white">${name}</span>
              <span class="badge ${isRunning ? 'bg-success' : 'bg-secondary'}" style="font-size: 10px;">
                ${isRunning ? '<i class="fas fa-play me-1"></i> RUNNING' : 'STOPPED'}
              </span>
            </div>
            <div class="d-flex justify-content-between align-items-center mt-2">
              <span class="font-mono fs-5 fw-bold ${isRunning ? 'text-orange' : 'text-light'}">${displayTime}</span>
              <div class="d-flex gap-1">
                <button class="btn btn-sm btn-outline-success timer-op-btn py-0 px-2" data-timer-id="${id}" data-op="start" title="Start Timer">
                  <i class="fas fa-play"></i>
                </button>
                <button class="btn btn-sm btn-outline-warning timer-op-btn py-0 px-2" data-timer-id="${id}" data-op="stop" title="Stop Timer">
                  <i class="fas fa-pause"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary timer-op-btn py-0 px-2" data-timer-id="${id}" data-op="reset" title="Reset Timer">
                  <i class="fas fa-rotate-left"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Wire operations
      this.timersListContainer.querySelectorAll('.timer-op-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const tId = btn.getAttribute('data-timer-id');
          const op = btn.getAttribute('data-op');
          await this.apiClient.timerOperation(tId, op).catch(() => {});
          setTimeout(() => this.loadTimersTab(), 300);
        });
      });
    } catch (e) {
      this.timersListContainer.innerHTML = `<div class="text-danger small p-2">Error: ${e.message}</div>`;
    }
  }

  // =========================================================================
  // 4. MESSAGES TAB
  // =========================================================================
  async loadMessagesTab() {
    if (!this.messagesListContainer) return;
    this.messagesListContainer.innerHTML = '<div class="text-muted small p-2 text-center"><i class="fas fa-spinner fa-spin me-1"></i> Loading messages...</div>';

    try {
      const messages = await this.apiClient.getMessages();
      if (!messages || !messages.length) {
        this.messagesListContainer.innerHTML = '<div class="text-muted small p-3 text-center">No screen messages configured in ProPresenter.</div>';
        return;
      }

      this.messagesListContainer.innerHTML = messages.map(msg => {
        const id = msg.id ? msg.id.uuid : msg.uuid;
        const name = msg.id ? msg.id.name : msg.name;
        const template = msg.message || '';

        return `
          <div class="message-card p-2 mb-2 rounded bg-black bg-opacity-50 border border-secondary">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="small fw-bold text-warning">${name}</span>
              <span class="badge bg-dark border border-secondary text-secondary" style="font-size: 10px;">${template || 'Custom'}</span>
            </div>
            <div class="input-group input-group-sm mb-2">
              <input type="text" class="form-control bg-dark text-white border-secondary message-token-input" data-msg-id="${id}" placeholder="Enter message text..." value="${template}">
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-warning flex-fill fw-bold text-black msg-trigger-btn" data-msg-id="${id}">
                <i class="fas fa-paper-plane me-1"></i> Show on Screen
              </button>
              <button class="btn btn-sm btn-outline-danger flex-fill msg-clear-btn" data-msg-id="${id}">
                <i class="fas fa-xmark me-1"></i> Hide
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Wire trigger / clear
      this.messagesListContainer.querySelectorAll('.msg-trigger-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const mId = btn.getAttribute('data-msg-id');
          const input = this.messagesListContainer.querySelector(`.message-token-input[data-msg-id="${mId}"]`);
          const textVal = input ? input.value.trim() : '';
          try {
            await this.apiClient.triggerMessage(mId, { message: textVal, Verse: textVal });
            btn.classList.add('btn-success');
            setTimeout(() => btn.classList.remove('btn-success'), 1200);
          } catch (e) {
            alert('Error triggering message: ' + e.message);
          }
        });
      });

      this.messagesListContainer.querySelectorAll('.msg-clear-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const mId = btn.getAttribute('data-msg-id');
          await this.apiClient.clearMessage(mId).catch(() => {});
        });
      });
    } catch (e) {
      this.messagesListContainer.innerHTML = `<div class="text-danger small p-2">Error: ${e.message}</div>`;
    }
  }

  // =========================================================================
  // 5. PROPS TAB
  // =========================================================================
  async loadPropsTab() {
    if (!this.propsListContainer) return;
    this.propsListContainer.innerHTML = '<div class="text-muted small p-2 text-center"><i class="fas fa-spinner fa-spin me-1"></i> Loading props...</div>';

    try {
      const props = await this.apiClient.getProps();
      if (!props || !props.length) {
        this.propsListContainer.innerHTML = '<div class="text-muted small p-3 text-center">No props configured in ProPresenter.</div>';
        return;
      }

      this.propsListContainer.innerHTML = props.map(prop => {
        const id = prop.id ? prop.id.uuid : prop.uuid;
        const name = prop.id ? prop.id.name : prop.name;
        const isActive = !!prop.is_active;

        return `
          <div class="prop-item p-2 mb-2 rounded bg-black bg-opacity-50 border ${isActive ? 'border-purple shadow-sm' : 'border-secondary'} d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center gap-2 overflow-hidden">
              <span class="badge ${isActive ? 'bg-purple text-black' : 'bg-dark text-secondary'} border border-secondary" style="font-size: 11px;">
                <i class="fas fa-shapes"></i>
              </span>
              <span class="small fw-bold text-white text-truncate">${name}</span>
            </div>
            <button class="btn btn-sm ${isActive ? 'btn-danger' : 'btn-outline-purple'} prop-toggle-btn py-0 px-2 fw-bold" data-prop-id="${id}" data-active="${isActive}" style="font-size: 11px;">
              ${isActive ? '<i class="fas fa-stop me-1"></i> Deactivate' : '<i class="fas fa-play me-1"></i> Trigger'}
            </button>
          </div>
        `;
      }).join('');

      // Wire prop toggle
      this.propsListContainer.querySelectorAll('.prop-toggle-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const pId = btn.getAttribute('data-prop-id');
          const isAct = btn.getAttribute('data-active') === 'true';
          try {
            if (isAct) {
              await this.apiClient.clearProp(pId);
            } else {
              await this.apiClient.triggerProp(pId);
            }
          } catch (e) {
            console.warn('[RightTabs] Prop error:', e.message);
          }
          setTimeout(() => this.loadPropsTab(), 350);
        });
      });
    } catch (e) {
      this.propsListContainer.innerHTML = `<div class="text-danger small p-2">Error: ${e.message}</div>`;
    }
  }

  // =========================================================================
  // 6. MACROS TAB
  // =========================================================================
  async loadMacrosTab() {
    if (!this.macrosListContainer) return;
    this.macrosListContainer.innerHTML = '<div class="text-muted small p-2 text-center col-span-2"><i class="fas fa-spinner fa-spin me-1"></i> Loading macros...</div>';

    try {
      const macros = await this.apiClient.getMacros();
      if (!macros || !macros.length) {
        this.macrosListContainer.innerHTML = '<div class="text-muted small p-3 text-center col-span-2">No macros configured in ProPresenter.</div>';
        return;
      }

      this.macrosListContainer.innerHTML = macros.map(macro => {
        const id = macro.id ? macro.id.uuid : macro.uuid;
        const name = macro.id ? macro.id.name : macro.name;

        // ProPresenter custom RGB color
        let bgStyle = 'background: rgba(30, 33, 42, 0.9); border: 1px solid var(--border-strong);';
        if (macro.color) {
          const r = Math.round((macro.color.red || 0) * 255);
          const g = Math.round((macro.color.green || 0) * 255);
          const b = Math.round((macro.color.blue || 0) * 255);
          bgStyle = `background: rgba(${r}, ${g}, ${b}, 0.35); border: 1px solid rgba(${r}, ${g}, ${b}, 0.8);`;
        }

        return `
          <button type="button" class="btn macro-btn p-2 rounded text-start d-flex align-items-center gap-2 shadow-sm text-white" style="${bgStyle}" data-macro-id="${id}" title="Trigger Macro: ${name}">
            <i class="fas fa-bolt text-warning" style="font-size: 13px;"></i>
            <span class="small fw-bold text-truncate">${name}</span>
          </button>
        `;
      }).join('');

      // Wire macro trigger
      this.macrosListContainer.querySelectorAll('.macro-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const mId = btn.getAttribute('data-macro-id');
          btn.style.transform = 'scale(0.96)';
          try {
            await this.apiClient.triggerMacro(mId);
          } catch (e) {
            console.warn('[RightTabs] Macro error:', e.message);
          }
          setTimeout(() => { btn.style.transform = 'none'; }, 200);
        });
      });
    } catch (e) {
      this.macrosListContainer.innerHTML = `<div class="text-danger small p-2 col-span-2">Error: ${e.message}</div>`;
    }
  }
}

// Export to window global scope
window.RightTabsController = RightTabsController;
