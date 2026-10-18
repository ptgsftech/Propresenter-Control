/**
 * @file playlist-ctrl.js
 * @description Studio Catalog Controller for ProPresenter Libraries & Playlists.
 * Manages the card-based popup modal for browsing song libraries and playlist sets,
 * drilling down into song lists with List View vs Grid View layout toggles,
 * searching, and loading selected presentations directly into the main slide deck.
 *
 * @version 3.0.0
 * @license MIT
 */

class PlaylistController {
  /**
   * Initializes the Playlist Controller.
   * @param {ApiClient} apiClient - REST API client.
   * @param {StateStore} store - Reactive state store.
   */
  constructor(apiClient, store) {
    this.api = apiClient;
    this.store = store;

    // Modal & Catalog DOM References
    this.modalEl = document.getElementById('libraryPlaylistModal');
    this.bsModal = null;
    this.openBtn = document.getElementById('headerLibraryBtn');
    this.tabLibrary = document.getElementById('catalogTabLibrary');
    this.tabPlaylist = document.getElementById('catalogTabPlaylist');
    this.libCountBadge = document.getElementById('catalogLibCount');
    this.playlistCountBadge = document.getElementById('catalogPlaylistCount');
    this.searchInput = document.getElementById('catalogSearchInput');

    // Grid / List Containers
    this.librariesGridEl = document.getElementById('catalogLibrariesGrid');
    this.playlistsGridEl = document.getElementById('catalogPlaylistsGrid');
    this.songsContainerEl = document.getElementById('catalogSongsContainer');
    this.songsListEl = document.getElementById('catalogSongsList');

    // Drilldown Breadcrumb & Layout Controls
    this.drilldownHeader = document.getElementById('catalogDrilldownHeader');
    this.backBtn = document.getElementById('catalogBackBtn');
    this.backBtnLabel = document.getElementById('catalogBackBtnLabel');
    this.activeTitleEl = document.getElementById('catalogActiveTitle');
    this.activeSubEl = document.getElementById('catalogActiveSub');
    this.activeIconEl = document.getElementById('catalogActiveIcon');
    this.viewListBtn = document.getElementById('catalogViewListBtn');
    this.viewGridBtn = document.getElementById('catalogViewGridBtn');

    /**
     * Active catalog tab: 'library' | 'playlist'
     * @type {'library'|'playlist'}
     */
    this.activeTab = 'library';

    /**
     * Active songs layout mode: 'list' | 'grid'
     * @type {'list'|'grid'}
     */
    this.songsLayout = 'list';

    /**
     * Currently active container when drilled down: null | { type: 'library'|'playlist', id: string, name: string }
     */
    this.activeContainer = null;

    /**
     * Raw items of currently drilled down library/playlist.
     * @type {Array}
     */
    this.currentSongs = [];

    /**
     * Cache of library item counts: { [libId]: number }
     */
    this.libraryCountsCache = {};

    /**
     * Polling interval timer ID.
     * @type {number|null}
     */
    this.libraryPollInterval = null;

    this.init();
  }

  /**
   * Initializes listeners, preloads data, and starts background polling.
   */
  init() {
    this.bindEvents();
    this.loadData();
    this.startLibraryPolling();
  }

  /**
   * Binds click events, tab switching, search input, and layout changes.
   */
  bindEvents() {
    // Open Modal button
    if (this.openBtn) {
      this.openBtn.addEventListener('click', () => this.openModal());
    }

    // Tab Switcher (Library | Playlist)
    if (this.tabLibrary) {
      this.tabLibrary.addEventListener('click', () => {
        this.switchTab('library');
      });
    }
    if (this.tabPlaylist) {
      this.tabPlaylist.addEventListener('click', () => {
        this.switchTab('playlist');
      });
    }

    // Back button in drilldown view
    if (this.backBtn) {
      this.backBtn.addEventListener('click', () => {
        this.returnToCatalogCards();
      });
    }

    // List View vs Grid View Layout Switcher
    if (this.viewListBtn) {
      this.viewListBtn.addEventListener('click', () => {
        this.setSongsLayout('list');
      });
    }
    if (this.viewGridBtn) {
      this.viewGridBtn.addEventListener('click', () => {
        this.setSongsLayout('grid');
      });
    }

    // Search filter
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        this.handleSearchFilter(query);
      });
    }

    // Subscribe to state updates
    this.store.subscribe((state, prev) => {
      if (state.libraries !== prev.libraries) {
        this.renderLibrariesGrid(state.libraries || []);
      }
      if (state.playlists !== prev.playlists) {
        this.renderPlaylistsGrid(state.playlists || []);
      }
    });
  }

  /**
   * Opens the Library & Playlist Catalog popup modal.
   * @param {'library'|'playlist'} [tab]
   */
  openModal(tab) {
    if (tab) {
      this.switchTab(tab);
    }
    if (this.modalEl && window.bootstrap) {
      if (!this.bsModal) {
        this.bsModal = new bootstrap.Modal(this.modalEl);
      }
      this.bsModal.show();
      setTimeout(() => {
        this.searchInput?.focus();
      }, 200);
    }
  }

  /**
   * Closes the catalog modal.
   */
  closeModal() {
    if (this.modalEl && window.bootstrap) {
      const modalInstance = bootstrap.Modal.getInstance(this.modalEl);
      modalInstance?.hide();
    }
  }

  /**
   * Switches active top tab between 'library' and 'playlist'.
   * @param {'library'|'playlist'} tab
   */
  switchTab(tab) {
    this.activeTab = tab;
    this.tabLibrary?.classList.toggle('active', tab === 'library');
    this.tabPlaylist?.classList.toggle('active', tab === 'playlist');

    // Return to card view if drilled down
    this.returnToCatalogCards();

    if (this.searchInput) {
      this.searchInput.value = '';
    }

    if (tab === 'library') {
      this.librariesGridEl?.classList.remove('d-none');
      this.playlistsGridEl?.classList.add('d-none');
      this.renderLibrariesGrid(this.store.state.libraries || []);
    } else {
      this.librariesGridEl?.classList.add('d-none');
      this.playlistsGridEl?.classList.remove('d-none');
      this.renderPlaylistsGrid(this.store.state.playlists || []);
    }
  }

  /**
   * Sets songs drilldown layout between 'list' and 'grid'.
   * @param {'list'|'grid'} layout
   */
  setSongsLayout(layout) {
    this.songsLayout = layout;
    if (this.viewListBtn) this.viewListBtn.classList.toggle('active', layout === 'list');
    if (this.viewGridBtn) this.viewGridBtn.classList.toggle('active', layout === 'grid');

    if (this.songsListEl) {
      if (layout === 'grid') {
        this.songsListEl.className = 'catalog-songs-grid-view';
      } else {
        this.songsListEl.className = 'catalog-songs-list-view';
      }
    }
    this.renderSongsView(this.currentSongs, this.searchInput?.value.toLowerCase().trim() || '');
  }

  /**
   * Starts periodic polling of the libraries API (/v1/libraries) every 5 seconds.
   */
  startLibraryPolling() {
    if (this.libraryPollInterval) {
      clearInterval(this.libraryPollInterval);
    }
    this.libraryPollInterval = setInterval(() => {
      this.refreshLibraries();
    }, 5000);
  }

  /**
   * Fetches latest libraries and playlists from ProPresenter API.
   */
  async loadData() {
    try {
      const [libraries, playlists] = await Promise.all([
        this.api.getLibraries().catch(() => []),
        this.api.getPlaylists().catch(() => [])
      ]);

      const safeLibs = Array.isArray(libraries) ? libraries : [];
      const safePlaylists = Array.isArray(playlists) ? playlists : [];

      this.store.setState({
        libraries: safeLibs,
        playlists: safePlaylists
      });

      if (this.libCountBadge) this.libCountBadge.textContent = safeLibs.length;
      if (this.playlistCountBadge) this.playlistCountBadge.textContent = safePlaylists.length;

      this.renderLibrariesGrid(safeLibs);
      this.renderPlaylistsGrid(safePlaylists);

      // Preload song counts for libraries in background
      this.preloadLibraryCounts(safeLibs);
    } catch (err) {
      console.warn('[CatalogCtrl] Load error:', err.message);
    }
  }

  /**
   * Refreshes library list in background.
   */
  async refreshLibraries(force = false) {
    try {
      const libraries = await this.api.getLibraries();
      if (!Array.isArray(libraries)) return;

      const currentLibs = this.store.state.libraries || [];
      const hasChanged = force || libraries.length !== currentLibs.length ||
        libraries.some((lib, idx) => {
          const prev = currentLibs[idx];
          if (!prev) return true;
          const newId = lib.uuid || (lib.id ? lib.id.uuid : '');
          const prevId = prev.uuid || (prev.id ? prev.id.uuid : '');
          return newId !== prevId;
        });

      if (hasChanged) {
        this.store.setState({ libraries });
        if (this.libCountBadge) this.libCountBadge.textContent = libraries.length;
        if (this.activeTab === 'library' && !this.activeContainer) {
          this.renderLibrariesGrid(libraries);
        }
        this.preloadLibraryCounts(libraries);
      }
    } catch (err) {
      console.debug('[CatalogCtrl] Library poll:', err.message);
    }
  }

  /**
   * Preloads item counts for library cards.
   */
  async preloadLibraryCounts(libraries) {
    for (const lib of libraries) {
      const id = lib.uuid || (lib.id ? lib.id.uuid : '');
      if (id && this.libraryCountsCache[id] === undefined) {
        try {
          const data = await this.api.getLibrary(id);
          const count = (data && data.items) ? data.items.length : 0;
          this.libraryCountsCache[id] = count;
          // Update card badge in UI if rendered
          const badgeEl = document.querySelector(`.catalog-card[data-id="${id}"] .catalog-card-badge`);
          if (badgeEl) badgeEl.textContent = `${count} songs`;
          const descEl = document.querySelector(`.catalog-card[data-id="${id}"] .catalog-card-desc`);
          if (descEl) descEl.innerHTML = `<i class="fas fa-music text-warning me-1"></i> ${count} songs`;
        } catch (e) {
          this.libraryCountsCache[id] = 0;
        }
      }
    }
  }

  /**
   * Returns a curated theme artwork style and icon for a library card.
   */
  getLibraryArtTheme(name, idx) {
    const themes = [
      {
        bg: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
        icon: 'fa-guitar',
        iconColor: '#a5b4fc',
        gradient: 'from-purple'
      },
      {
        bg: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
        icon: 'fa-book-bible',
        iconColor: '#6ee7b7',
        gradient: 'from-emerald'
      },
      {
        bg: 'linear-gradient(135deg, #7c2d12 0%, #9a3412 50%, #ea580c 100%)',
        icon: 'fa-fire',
        iconColor: '#fdba74',
        gradient: 'from-orange'
      },
      {
        bg: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 50%, #0284c7 100%)',
        icon: 'fa-water',
        iconColor: '#7dd3fc',
        gradient: 'from-cyan'
      },
      {
        bg: 'linear-gradient(135deg, #581c87 0%, #6b21a8 50%, #9333ea 100%)',
        icon: 'fa-music',
        iconColor: '#d8b4fe',
        gradient: 'from-violet'
      }
    ];

    const lower = name.toLowerCase();
    if (lower.includes('tamil') || lower.includes('தமிழ்')) return themes[0];
    if (lower.includes('hymn') || lower.includes('traditional')) return themes[1];
    if (lower.includes('youth') || lower.includes('fast') || lower.includes('praise')) return themes[2];
    if (lower.includes('worship') || lower.includes('english')) return themes[3];
    return themes[idx % themes.length];
  }

  /**
   * Renders the Libraries Cards Grid (State A).
   * @param {Array} libraries
   */
  renderLibrariesGrid(libraries) {
    if (!this.librariesGridEl) return;
    if (this.libCountBadge) this.libCountBadge.textContent = libraries.length;

    if (!libraries.length) {
      this.librariesGridEl.innerHTML = '<div class="text-muted small p-4 text-center col-12">No song libraries found.</div>';
      return;
    }

    this.librariesGridEl.innerHTML = libraries.map((lib, idx) => {
      const id = lib.uuid || (lib.id ? lib.id.uuid : `lib-${idx}`);
      const name = lib.name || (lib.id ? lib.id.name : `Library ${idx + 1}`);
      const cachedCount = this.libraryCountsCache[id];
      const countText = cachedCount !== undefined ? `${cachedCount} songs` : 'Browse songs';
      const theme = this.getLibraryArtTheme(name, idx);

      return `
        <div class="catalog-card" data-type="library" data-id="${id}" data-name="${name}">
          <div class="catalog-card-cover" style="background: ${theme.bg};">
            <div class="catalog-card-icon-overlay">
              <i class="fas ${theme.icon}" style="color: ${theme.iconColor};"></i>
            </div>
            <span class="catalog-card-badge">${countText}</span>
          </div>
          <div class="catalog-card-body">
            <h5 class="catalog-card-title font-tamil" title="${name}">${name}</h5>
            <p class="catalog-card-desc">
              <i class="fas fa-book-bookmark text-warning me-1"></i> ${countText}
            </p>
          </div>
        </div>
      `;
    }).join('');

    // Wire click to drill down into library songs
    this.librariesGridEl.querySelectorAll('.catalog-card').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        const name = el.getAttribute('data-name');
        this.drilldownIntoContainer('library', id, name);
      });
    });
  }

  /**
   * Renders the Playlists Cards Grid (State C).
   * @param {Array} playlists
   */
  renderPlaylistsGrid(playlists) {
    if (!this.playlistsGridEl) return;
    if (this.playlistCountBadge) this.playlistCountBadge.textContent = playlists.length;

    if (!playlists.length) {
      this.playlistsGridEl.innerHTML = '<div class="text-muted small p-4 text-center col-12">No playlists or sets found.</div>';
      return;
    }

    this.playlistsGridEl.innerHTML = playlists.map((pl, idx) => {
      const id = pl.id ? pl.id.uuid : (pl.uuid || `pl-${idx}`);
      const name = pl.id ? pl.id.name : (pl.name || `Set ${idx + 1}`);
      const itemCount = (pl.items && Array.isArray(pl.items)) ? pl.items.length : 0;
      const countText = `${itemCount} songs`;

      return `
        <div class="catalog-card" data-type="playlist" data-id="${id}" data-name="${name}">
          <div class="catalog-card-cover" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);">
            <div class="catalog-card-icon-overlay">
              <i class="fas fa-list-check text-cyan"></i>
            </div>
            <span class="catalog-card-badge">${countText}</span>
          </div>
          <div class="catalog-card-body">
            <h5 class="catalog-card-title font-tamil" title="${name}">${name}</h5>
            <p class="catalog-card-desc">
              <i class="fas fa-layer-group text-cyan me-1"></i> ${countText}
            </p>
          </div>
        </div>
      `;
    }).join('');

    // Wire click to drill down into playlist songs
    this.playlistsGridEl.querySelectorAll('.catalog-card').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        const name = el.getAttribute('data-name');
        this.drilldownIntoContainer('playlist', id, name);
      });
    });
  }

  /**
   * Drills down into a selected library or playlist to view and select songs.
   * @param {'library'|'playlist'} type
   * @param {string} id
   * @param {string} name
   */
  async drilldownIntoContainer(type, id, name) {
    this.activeContainer = { type, id, name };

    // Hide card grids, show drilldown header & songs container
    this.librariesGridEl?.classList.add('d-none');
    this.playlistsGridEl?.classList.add('d-none');
    this.drilldownHeader?.classList.remove('d-none');
    this.drilldownHeader?.classList.add('d-flex');
    this.songsContainerEl?.classList.remove('d-none');

    // Update drilldown breadcrumb info
    if (this.backBtnLabel) {
      this.backBtnLabel.textContent = type === 'library' ? 'Back to Libraries' : 'Back to Playlists';
    }
    if (this.activeTitleEl) this.activeTitleEl.textContent = name;
    if (this.activeSubEl) this.activeSubEl.textContent = 'Fetching songs...';
    if (this.activeIconEl) {
      this.activeIconEl.className = type === 'library' ? 'fas fa-book-bookmark text-warning fs-5' : 'fas fa-list-check text-cyan fs-5';
    }

    if (this.songsListEl) {
      this.songsListEl.innerHTML = '<div class="text-muted small p-4 text-center col-12"><i class="fas fa-spinner fa-spin me-2"></i> Loading song presentations...</div>';
    }

    try {
      let items = [];
      if (type === 'playlist') {
        const plData = await this.api.getPlaylist(id);
        items = (plData && plData.items) ? plData.items : (Array.isArray(plData) ? plData : []);
      } else {
        const libData = await this.api.getLibrary(id);
        items = (libData && libData.items) ? libData.items : (Array.isArray(libData) ? libData : []);
        this.libraryCountsCache[id] = items.length;
      }

      this.currentSongs = items;
      if (this.activeSubEl) {
        this.activeSubEl.textContent = `${items.length} Songs available`;
      }

      this.renderSongsView(items, this.searchInput?.value.toLowerCase().trim() || '');
    } catch (err) {
      if (this.songsListEl) {
        this.songsListEl.innerHTML = `<div class="text-danger small p-4 text-center col-12">Failed to load songs: ${err.message}</div>`;
      }
    }
  }

  /**
   * Renders the songs drilldown in List or Grid view.
   * @param {Array} items
   * @param {string} [query='']
   */
  renderSongsView(items, query = '') {
    if (!this.songsListEl) return;

    let filtered = items;
    if (query) {
      filtered = items.filter(it => {
        const title = (it.id ? it.id.name : (it.name || '')).toLowerCase();
        return title.includes(query);
      });
    }

    if (!filtered.length) {
      this.songsListEl.innerHTML = query
        ? `<div class="text-muted small p-4 text-center col-12">No songs match "${query}".</div>`
        : `<div class="text-muted small p-4 text-center col-12">This collection has no presentations.</div>`;
      return;
    }

    const activeUuid = this.store.state.activePresentationUuid;

    if (this.songsLayout === 'grid') {
      this.songsListEl.innerHTML = filtered.map((it, idx) => {
        const id = it.id ? it.id.uuid : (it.uuid || `item-${idx}`);
        const name = it.id ? it.id.name : (it.name || `Presentation ${idx + 1}`);
        const isActive = activeUuid === id;

        return `
          <div class="catalog-song-grid-card ${isActive ? 'is-active' : ''}" data-uuid="${id}" data-name="${name}">
            <div>
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="badge bg-black border border-secondary text-secondary font-mono" style="font-size: 9px;">#${idx + 1}</span>
                <i class="fas fa-play text-orange" style="font-size: 10px;"></i>
              </div>
              <h6 class="catalog-song-grid-title font-tamil">${name}</h6>
            </div>
            <div class="d-flex justify-content-between align-items-center mt-2 text-secondary small" style="font-size: 10.5px;">
              <span><i class="fas fa-file-powerpoint me-1"></i>Cue Deck</span>
              <span class="text-warning fw-bold">Load</span>
            </div>
          </div>
        `;
      }).join('');
    } else {
      // List View
      this.songsListEl.innerHTML = filtered.map((it, idx) => {
        const id = it.id ? it.id.uuid : (it.uuid || `item-${idx}`);
        const name = it.id ? it.id.name : (it.name || `Presentation ${idx + 1}`);
        const isActive = activeUuid === id;

        return `
          <div class="catalog-song-row ${isActive ? 'is-active' : ''}" data-uuid="${id}" data-name="${name}">
            <div class="d-flex align-items-center gap-3 overflow-hidden">
              <span class="badge bg-black border border-secondary text-secondary font-mono" style="font-size: 10px; min-width: 26px;">#${idx + 1}</span>
              <span class="small font-tamil fw-bold text-truncate text-light fs-6">${name}</span>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="badge bg-dark text-secondary border border-secondary d-none d-sm-inline" style="font-size: 9.5px;">Song</span>
              <button class="btn btn-sm btn-warning text-black fw-bold py-1 px-3 d-flex align-items-center gap-1" style="font-size: 11px;">
                <i class="fas fa-folder-open" style="font-size: 10px;"></i> Load
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    // Wire song row / card click to load into presentation deck
    const selector = this.songsLayout === 'grid' ? '.catalog-song-grid-card' : '.catalog-song-row';
    this.songsListEl.querySelectorAll(selector).forEach(el => {
      el.addEventListener('click', () => {
        const presUuid = el.getAttribute('data-uuid');
        const presName = el.getAttribute('data-name');
        this.selectAndLoadPresentation(presUuid, presName);
      });
    });
  }

  /**
   * Returns from songs drilldown back to the top-level cards grid.
   */
  returnToCatalogCards() {
    this.activeContainer = null;
    this.currentSongs = [];

    this.drilldownHeader?.classList.add('d-none');
    this.drilldownHeader?.classList.remove('d-flex');
    this.songsContainerEl?.classList.add('d-none');

    if (this.activeTab === 'library') {
      this.librariesGridEl?.classList.remove('d-none');
      this.playlistsGridEl?.classList.add('d-none');
    } else {
      this.librariesGridEl?.classList.add('d-none');
      this.playlistsGridEl?.classList.remove('d-none');
    }
  }

  /**
   * Focuses presentation in ProPresenter (without triggering slides)
   * and loads all slides into the Show section in the remote UI.
   * @param {string} presUuid
   * @param {string} presName
   */
  async selectAndLoadPresentation(presUuid, presName) {
    if (!presUuid) return;
    if (presName && (presName.trim().toLowerCase() === 'untitled presentation' || presName.trim().toLowerCase() === 'untitled')) {
      return;
    }

    console.log(`[CatalogCtrl] Selecting song presentation: "${presName}" (${presUuid})`);

    // Close the catalog modal
    this.closeModal();

    // Use unified loadAndFocusPresentation from window.presentationCtrl
    if (window.presentationCtrl && typeof window.presentationCtrl.loadAndFocusPresentation === 'function') {
      await window.presentationCtrl.loadAndFocusPresentation(presUuid, presName);
    } else {
      // Fallback
      if (typeof window.setWorkspaceView === 'function') {
        window.setWorkspaceView('show');
      } else {
        document.getElementById('viewModeShowBtn')?.click();
      }
      await this.api.focusPresentation(presUuid).catch(() => {});
      const presData = await this.api.getPresentation(presUuid).catch(() => null);
      const fullPres = (presData && presData.presentation) ? presData.presentation : (presData || {});
      if (!fullPres.name) fullPres.name = presName;
      this.store.setState({
        activePresentation: fullPres,
        activePresentationUuid: presUuid,
        currentSlideIndex: null
      });
      this.store.emit('presentation:active', fullPres);
      document.getElementById('cuesSectionWrapper')?.scrollIntoView({ behavior: 'smooth' });
    }

    // Display confirmation toast
    if (window.songSearchCtrl && typeof window.songSearchCtrl.showTriggerToast === 'function') {
      window.songSearchCtrl.showTriggerToast(presName);
    }
  }

  /**
   * Filters the active view based on search input.
   * @param {string} query
   */
  handleSearchFilter(query) {
    if (this.activeContainer) {
      // Filter songs inside active container
      this.renderSongsView(this.currentSongs, query);
    } else if (this.activeTab === 'library') {
      // Filter library cards
      const libs = (this.store.state.libraries || []).filter(lib => {
        const name = (lib.name || (lib.id ? lib.id.name : '')).toLowerCase();
        return name.includes(query);
      });
      this.renderLibrariesGrid(libs);
    } else {
      // Filter playlist cards
      const pls = (this.store.state.playlists || []).filter(pl => {
        const name = (pl.name || (pl.id ? pl.id.name : '')).toLowerCase();
        return name.includes(query);
      });
      this.renderPlaylistsGrid(pls);
    }
  }
}

// Export to window global scope
window.PlaylistController = PlaylistController;
