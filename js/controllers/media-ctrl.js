/**
 * @file media-ctrl.js
 * @description Media Bin & Background Loops Controller.
 * Manages media playlists, background video loops, motion stills, and media layer playback.
 *
 * @version 1.0.0
 * @license MIT
 */

/**
 * Controller for browsing and triggering media assets.
 *
 * @class MediaController
 */
class MediaController {
  /**
   * Initializes the Media Controller.
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
    this.container = document.getElementById('mediaBinGrid');

    /** @type {HTMLSelectElement|null} */
    this.playlistSelector = document.getElementById('mediaPlaylistSelect');

    this.init();
  }

  /**
   * Initializes listeners and loads media playlists.
   */
  init() {
    this.loadMediaPlaylists();
    this.bindEvents();
  }

  /**
   * Fetches media playlists from ProPresenter and populates the selector.
   * @returns {Promise<void>}
   */
  async loadMediaPlaylists() {
    try {
      const playlists = await this.api.getMediaPlaylists();
      const list = Array.isArray(playlists) ? playlists : [];
      this.store.setState({ mediaPlaylists: list });

      if (this.playlistSelector && list.length > 0) {
        this.playlistSelector.innerHTML = list.map(p => {
          const id = p.id || p;
          return `<option value="${id.uuid || id.id}">${this.escape(id.name || 'Media Playlist')}</option>`;
        }).join('');

        const firstId = list[0].id || list[0];
        this.loadMediaItems(firstId.uuid || firstId.id);
      }
    } catch (err) {
      console.warn('[MediaCtrl] Media playlist load note:', err.message);
    }
  }

  /**
   * Loads media thumbnails and assets for a selected media playlist.
   *
   * @param {string} playlistId - Media playlist UUID.
   * @returns {Promise<void>}
   */
  async loadMediaItems(playlistId) {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="col-12 py-3 text-center text-muted small">
        <i class="fas fa-spinner fa-spin me-2"></i> Loading media items...
      </div>
    `;

    try {
      const data = await this.api.getMediaPlaylist(playlistId);
      const items = (data && data.items) || [];
      this.renderMediaGrid(items, playlistId);
    } catch (err) {
      if (this.container) {
        this.container.innerHTML = `<div class="col-12 py-3 text-muted small text-center">No media items in this playlist.</div>`;
      }
    }
  }

  /**
   * Renders thumbnail cards for media assets.
   *
   * @param {Array} items - List of media item objects.
   * @param {string} playlistId - Active playlist UUID.
   */
  renderMediaGrid(items, playlistId) {
    if (!this.container) return;
    if (items.length === 0) {
      this.container.innerHTML = `<div class="col-12 py-3 text-muted small text-center">No media files found</div>`;
      return;
    }

    this.container.innerHTML = items.map(item => {
      const id = item.id || item;
      const uuid = id.uuid || id.id;
      const name = id.name || 'Media';
      const thumbUrl = this.api.getMediaThumbnailUrl(uuid, 300);

      return `
        <div class="col-6 col-md-4 col-lg-3">
          <div class="media-card studio-card p-1 cursor-pointer" data-uuid="${uuid}" data-playlist="${playlistId}" title="${this.escape(name)}">
            <div class="media-thumb-box position-relative rounded overflow-hidden" style="aspect-ratio: 16/9; background: #000;">
              <img src="${thumbUrl}" class="w-100 h-100 object-fit-cover" onerror="this.src='../src/Propresenter.jpg'" alt="${this.escape(name)}" />
              <div class="position-absolute bottom-0 start-0 end-0 p-1 bg-dark bg-opacity-75 text-truncate" style="font-size: 10px;">
                ${this.escape(name)}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.container.querySelectorAll('.media-card').forEach(card => {
      card.addEventListener('click', async () => {
        const uuid = card.getAttribute('data-uuid');
        const pId = card.getAttribute('data-playlist');
        try {
          await this.api.request(`/v1/media/playlist/${pId}/${uuid}/trigger`);
          this.container.querySelectorAll('.media-card').forEach(c => c.classList.remove('active'));
          card.classList.add('active');
        } catch (e) {
          console.error('[MediaCtrl] Trigger media error:', e);
        }
      });
    });
  }

  /**
   * Binds change events on the media playlist dropdown.
   */
  bindEvents() {
    if (this.playlistSelector) {
      this.playlistSelector.addEventListener('change', (e) => {
        this.loadMediaItems(e.target.value);
      });
    }
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
window.MediaController = MediaController;
