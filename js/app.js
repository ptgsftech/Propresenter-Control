/**
 * @file app.js
 * @description ProPresenter Web Studio Controller - Application Bootstrap & Coordinator.
 * Initializes configuration, reactive state store, REST client, and the real-time chunked streaming engine.
 * Coordinates all modular controllers, handles QR modal generation, and manages multi-device navigation tabs.
 *
 * @version 1.0.0
 * @license MIT
 */

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[App] Initializing ProPresenter Web Studio Controller...');

  // =========================================================================
  // 1. SESSION GUARD - Permit /controller or active connection
  // =========================================================================
  const isConnected = localStorage.getItem('proPresenterConnected') === 'true';
  const urlParams = new URLSearchParams(window.location.search);
  const bypass = urlParams.get('bypass') === 'true';
  const isDirectControllerRoute = window.location.pathname.startsWith('/controller');

  if (isDirectControllerRoute || bypass) {
    localStorage.setItem('proPresenterConnected', 'true');
  } else if (!isConnected) {
    console.log('[App] No active session. Redirecting to login...');
    window.location.href = '/';
    return;
  }

  // =========================================================================
  // 2. CONFIGURATION & SERVICES INSTANTIATION
  // =========================================================================
  const config = AppConfig.getConfig();
  console.log('[App] Target ProPresenter Host:', config.baseURL);

  const apiClient = new ApiClient(config.baseURL);
  const store = new StateStore();

  // =========================================================================
  // 2. HEADER DOM REFERENCES
  // =========================================================================
  const statusDot = document.getElementById('connectionStatusDot');
  const statusText = document.getElementById('connectionStatusText');
  const versionBadge = document.getElementById('propVersionBadge');
  const audienceHeaderBtn = document.getElementById('headerAudienceToggleBtn');
  const stageHeaderBtn = document.getElementById('headerStageToggleBtn');

  // =========================================================================
  // 3. STREAM CLIENT INITIALIZATION (POST /v1/status/updates)
  // =========================================================================
  const streamClient = new StreamClient(config.baseURL, {
    onEvent: (url, data) => {
      // Ingest live frame into central store
      store.ingestStreamEvent(url, data);
    },
    onStatusChange: (status) => {
      updateConnectionUI(status);
    },
    onError: (err) => {
      console.warn('[App] Stream event warning:', err.message);
    }
  });

  /**
   * Updates header connection status indicator.
   * @param {'connecting'|'connected'|'reconnecting'|'disconnected'} status
   */
  function updateConnectionUI(status) {
    if (!statusDot || !statusText) return;
    statusDot.className = 'live-dot';

    if (status === 'connected') {
      statusDot.classList.add('connected');
      statusText.textContent = 'Connected (Stream Live)';
      statusText.classList.remove('text-muted', 'text-danger');
      statusText.classList.add('text-success');
    } else if (status === 'reconnecting' || status === 'connecting') {
      statusDot.classList.add('streaming');
      statusText.textContent = 'Connecting...';
      statusText.classList.remove('text-success', 'text-danger');
      statusText.classList.add('text-orange');
    } else {
      statusDot.classList.add('error');
      statusText.textContent = 'Disconnected';
      statusText.classList.remove('text-success', 'text-orange');
      statusText.classList.add('text-danger');
    }
  }

  // =========================================================================
  // 4. CONNECTION BOOTSTRAP
  // =========================================================================
  async function bootstrapConnection() {
    updateConnectionUI('connecting');

    try {
      // Fetch version & host identification
      const versionData = await apiClient.getVersion();
      if (versionData) {
        AppConfig.setConnected(versionData.version);
        if (versionBadge) {
          versionBadge.textContent = `v${versionData.version || '7'}`;
        }
      }

      // Preload initial screen topology and layer states
      const [screens, audStatus, stgStatus, layers] = await Promise.all([
        apiClient.getScreens().catch(() => []),
        apiClient.getAudienceScreenStatus().catch(() => false),
        apiClient.getStageScreenStatus().catch(() => false),
        apiClient.getLayers().catch(() => ({}))
      ]);

      store.setState({
        connected: true,
        screens: Array.isArray(screens) ? screens : [],
        audienceScreensEnabled: Boolean(audStatus),
        stageScreensEnabled: Boolean(stgStatus),
        layers: layers || {}
      });

      // Synchronize header button displays
      syncHeaderScreenButtons();

      // Begin continuous chunked push stream
      streamClient.connect();

    } catch (err) {
      console.error('[App] Bootstrap error:', err);
      updateConnectionUI('disconnected');
    }
  }

  // =========================================================================
  // 4B. ROW 1 SYSTEM TIME & SCREEN CONTROLS
  // =========================================================================
  const headerHostNameEl = document.getElementById('headerHostName');
  if (headerHostNameEl) {
    const savedUser = localStorage.getItem('proPresenterUsername');
    headerHostNameEl.textContent = savedUser ? `${savedUser} @ ${config.ip}` : `${config.ip}:${config.port}`;
  }

  const row1SystemClock = document.getElementById('row1SystemClock');
  const row1SystemDate = document.getElementById('row1SystemDate');
  function updateClockTicker() {
    const now = new Date();
    if (row1SystemClock) {
      row1SystemClock.textContent = now.toLocaleTimeString();
    }
    if (row1SystemDate) {
      row1SystemDate.textContent = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    }
  }
  updateClockTicker();
  setInterval(updateClockTicker, 1000);

  // Screen Radio Controls in Header: Red outline when OFF, Green filled when ON
  const headerAudBtn = document.getElementById('headerAudienceToggleBtn');
  const headerStgBtn = document.getElementById('headerStageToggleBtn');

  function syncHeaderScreenButtons() {
    const isAud = Boolean(store.state.audienceScreensEnabled);
    const isStg = Boolean(store.state.stageScreensEnabled);

    if (headerAudBtn) {
      headerAudBtn.classList.toggle('is-on', isAud);
      headerAudBtn.setAttribute('aria-pressed', isAud ? 'true' : 'false');
      headerAudBtn.title = `Audience Screen: ${isAud ? 'Active (Click to Turn OFF)' : 'Inactive (Click to Turn ON)'}`;
    }
    if (headerStgBtn) {
      headerStgBtn.classList.toggle('is-on', isStg);
      headerStgBtn.setAttribute('aria-pressed', isStg ? 'true' : 'false');
      headerStgBtn.title = `Stage Screen: ${isStg ? 'Active (Click to Turn OFF)' : 'Inactive (Click to Turn ON)'}`;
    }
  }

  if (headerAudBtn) {
    headerAudBtn.addEventListener('click', async () => {
      try {
        const nextStatus = !Boolean(store.state.audienceScreensEnabled);
        // Optimistic UI update
        store.setState({ audienceScreensEnabled: nextStatus });
        syncHeaderScreenButtons();

        await apiClient.setAudienceScreenStatus(nextStatus);

        // Verify confirmed state from ProPresenter
        const confirmed = await apiClient.getAudienceScreenStatus();
        const isTrue = (confirmed === true || confirmed === 'true' || (confirmed && confirmed.status === true));
        store.setState({ audienceScreensEnabled: isTrue });
        syncHeaderScreenButtons();
      } catch (e) {
        console.error('[App] Audience toggle error:', e);
        // Revert to actual state on error
        try {
          const revertVal = await apiClient.getAudienceScreenStatus();
          store.setState({ audienceScreensEnabled: Boolean(revertVal) });
          syncHeaderScreenButtons();
        } catch (_) {}
      }
    });
  }

  if (headerStgBtn) {
    headerStgBtn.addEventListener('click', async () => {
      try {
        const nextStatus = !Boolean(store.state.stageScreensEnabled);
        // Optimistic UI update
        store.setState({ stageScreensEnabled: nextStatus });
        syncHeaderScreenButtons();

        await apiClient.setStageScreenStatus(nextStatus);

        // Verify confirmed state from ProPresenter
        const confirmed = await apiClient.getStageScreenStatus();
        const isTrue = (confirmed === true || confirmed === 'true' || (confirmed && confirmed.status === true));
        store.setState({ stageScreensEnabled: isTrue });
        syncHeaderScreenButtons();
      } catch (e) {
        console.error('[App] Stage toggle error:', e);
        // Revert to actual state on error
        try {
          const revertVal = await apiClient.getStageScreenStatus();
          store.setState({ stageScreensEnabled: Boolean(revertVal) });
          syncHeaderScreenButtons();
        } catch (_) {}
      }
    });
  }

  store.subscribe('screen:audience', () => syncHeaderScreenButtons());
  store.subscribe('screen:stage', () => syncHeaderScreenButtons());

  /**
   * Dedicated background polling for Audience and Stage screen statuses.
   * Periodically queries ProPresenter endpoints to keep UI controls in exact sync.
   */
  let isPollingScreens = false;
  async function pollScreenStatuses() {
    if (isPollingScreens) return;
    isPollingScreens = true;
    try {
      const [audStatus, stgStatus] = await Promise.all([
        apiClient.getAudienceScreenStatus().catch(() => null),
        apiClient.getStageScreenStatus().catch(() => null)
      ]);

      const updates = {};
      if (audStatus !== null) {
        const isAud = (audStatus === true || audStatus === 'true' || (audStatus && audStatus.status === true));
        if (store.state.audienceScreensEnabled !== isAud) {
          updates.audienceScreensEnabled = isAud;
        }
      }
      if (stgStatus !== null) {
        const isStg = (stgStatus === true || stgStatus === 'true' || (stgStatus && stgStatus.status === true));
        if (store.state.stageScreensEnabled !== isStg) {
          updates.stageScreensEnabled = isStg;
        }
      }

      if (Object.keys(updates).length > 0) {
        store.setState(updates);
        syncHeaderScreenButtons();
      }
    } catch (err) {
      // Ignore background network transient errors
    } finally {
      isPollingScreens = false;
    }
  }

  // Initial immediate fetch
  pollScreenStatuses();

  // Periodic polling every 2.0 seconds
  const SCREEN_POLL_INTERVAL_MS = 2000;
  setInterval(pollScreenStatuses, SCREEN_POLL_INTERVAL_MS);

  // =========================================================================
  // 4C. COLLAPSIBLE LEFT SIDEBAR & WORKSPACE NAVIGATION
  // =========================================================================
  const cuesSection = document.getElementById('cuesSectionWrapper');
  const bibleSection = document.getElementById('middleRow3Bible');

  // Sidebar DOM elements
  const appLeftSidebar = document.getElementById('appLeftSidebar');
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
  const sidebarCollapseIcon = document.getElementById('sidebarCollapseIcon');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');

  // Primary Nav Items
  const sidebarNavShow = document.getElementById('sidebarNavShow');
  const sidebarNavShowMain = document.getElementById('sidebarNavShowMain');
  const toggleShowTreeBtn = document.getElementById('toggleShowTreeBtn');
  const showSubList = document.getElementById('showSubList');
  const chevronShowTree = document.getElementById('chevronShowTree');

  const sidebarNavBible = document.getElementById('sidebarNavBible');
  const sidebarNavBibleMain = document.getElementById('sidebarNavBibleMain');
  const toggleBibleTreeBtn = document.getElementById('toggleBibleTreeBtn');
  const bibleSubList = document.getElementById('bibleSubList');
  const chevronBibleTree = document.getElementById('chevronBibleTree');

  const sidebarStageQRBtn = document.getElementById('sidebarStageQRBtn');
  const sidebarShortcutsBtn = document.getElementById('sidebarShortcutsBtn');
  const sidebarRssBtn = document.getElementById('sidebarRssBtn');

  // Mobile Bottom Nav Elements
  const mobileNavShowBtn = document.getElementById('mobileNavShowBtn');
  const mobileNavBibleBtn = document.getElementById('mobileNavBibleBtn');
  const mobileNavMenuBtn = document.getElementById('mobileNavMenuBtn');

  /**
   * Closes the mobile offcanvas drawer if screen is <= 992px
   */
  function closeMobileDrawer() {
    if (appLeftSidebar) appLeftSidebar.classList.remove('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
    document.body.style.overflow = '';
  }
  window.closeMobileDrawer = closeMobileDrawer;

  /**
   * Opens the mobile offcanvas drawer
   */
  function openMobileDrawer() {
    if (appLeftSidebar) appLeftSidebar.classList.add('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  window.openMobileDrawer = openMobileDrawer;

  /**
   * Toggles the left sidebar state:
   * - On mobile (<= 992px): slides offcanvas drawer in/out with backdrop
   * - On desktop (> 992px): collapses/expands sidebar rail (230px <-> 58px)
   */
  function toggleSidebar() {
    const isMobile = window.innerWidth <= 992;
    if (isMobile) {
      if (appLeftSidebar?.classList.contains('open')) {
        closeMobileDrawer();
      } else {
        openMobileDrawer();
      }
    } else {
      if (!appLeftSidebar) return;
      const isCollapsed = appLeftSidebar.classList.toggle('collapsed');
      if (sidebarCollapseIcon) {
        sidebarCollapseIcon.className = isCollapsed
          ? 'fas fa-angles-right collapse-icon'
          : 'fas fa-angles-left collapse-icon';
      }
      localStorage.setItem('proPresenterSidebarCollapsed', isCollapsed ? 'true' : 'false');
    }
  }
  window.toggleSidebar = toggleSidebar;

  // Restore saved desktop collapse preference
  if (window.innerWidth > 992 && localStorage.getItem('proPresenterSidebarCollapsed') === 'true') {
    appLeftSidebar?.classList.add('collapsed');
    if (sidebarCollapseIcon) {
      sidebarCollapseIcon.className = 'fas fa-angles-right collapse-icon';
    }
  }

  // Bind Sidebar Collapse / Toggle Triggers
  sidebarToggleBtn?.addEventListener('click', toggleSidebar);
  sidebarCollapseBtn?.addEventListener('click', toggleSidebar);
  sidebarBackdrop?.addEventListener('click', closeMobileDrawer);
  mobileNavMenuBtn?.addEventListener('click', openMobileDrawer);

  // Submenu tree expand/collapse handlers
  toggleShowTreeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isCollapsed = showSubList?.classList.toggle('collapsed');
    if (chevronShowTree) {
      chevronShowTree.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    }
  });

  toggleBibleTreeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isCollapsed = bibleSubList?.classList.toggle('collapsed');
    if (chevronBibleTree) {
      chevronBibleTree.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    }
  });

  /**
   * Switches workspace between 'show' (Presentation deck) and 'bible' (Scripture presenter)
   * @param {'show'|'bible'} view
   */
  function setWorkspaceView(view) {
    if (view === 'bible') {
      sidebarNavBible?.classList.add('active');
      sidebarNavShow?.classList.remove('active');
      mobileNavBibleBtn?.classList.add('active');
      mobileNavShowBtn?.classList.remove('active');

      // Expand Bible sub-list
      bibleSubList?.classList.remove('collapsed');
      if (chevronBibleTree) chevronBibleTree.style.transform = 'rotate(0deg)';

      // Hide Presentation Section completely
      cuesSection?.classList.add('d-none', 'workspace-view-hidden');
      if (cuesSection) cuesSection.style.setProperty('display', 'none', 'important');
      
      // Display Bible Section completely
      bibleSection?.classList.remove('d-none', 'workspace-view-hidden');
      if (bibleSection) bibleSection.style.setProperty('display', 'flex', 'important');
      
      // Automatically trigger Bible slide 1 and start slide polling while Bible screen is active
      if (window.bibleCtrl) {
        window.bibleCtrl.onEnterBibleView();
      }

      localStorage.setItem('proPresenterWorkspaceView', 'bible');
    } else {
      sidebarNavShow?.classList.add('active');
      sidebarNavBible?.classList.remove('active');
      mobileNavShowBtn?.classList.add('active');
      mobileNavBibleBtn?.classList.remove('active');

      // Expand Show sub-list
      showSubList?.classList.remove('collapsed');
      if (chevronShowTree) chevronShowTree.style.transform = 'rotate(0deg)';

      // Stop slide polling when exiting Bible screen
      if (window.bibleCtrl) {
        window.bibleCtrl.onLeaveBibleView();
      }

      // Hide Bible Section completely
      bibleSection?.classList.add('d-none', 'workspace-view-hidden');
      if (bibleSection) bibleSection.style.setProperty('display', 'none', 'important');
      
      // Display Presentation Section completely
      cuesSection?.classList.remove('d-none', 'workspace-view-hidden');
      if (cuesSection) cuesSection.style.setProperty('display', 'flex', 'important');
      
      localStorage.setItem('proPresenterWorkspaceView', 'show');
    }
  }

  window.setWorkspaceView = setWorkspaceView;

  // 1. Show Navigation Click
  sidebarNavShowMain?.addEventListener('click', () => {
    setWorkspaceView('show');
    if (window.innerWidth <= 992) closeMobileDrawer();
  });
  mobileNavShowBtn?.addEventListener('click', () => {
    setWorkspaceView('show');
  });

  // 2. Bible Navigation Click
  sidebarNavBibleMain?.addEventListener('click', () => {
    setWorkspaceView('bible');
    if (window.innerWidth <= 992) closeMobileDrawer();
  });
  mobileNavBibleBtn?.addEventListener('click', () => {
    setWorkspaceView('bible');
  });

  // 2.1 RSS Feeds in Sidebar
  sidebarRssBtn?.addEventListener('click', () => {
    setWorkspaceView('bible');
    if (window.bibleCtrl) {
      window.bibleCtrl.showRssModal();
    }
    if (window.innerWidth <= 992) closeMobileDrawer();
  });

  // Auto-close mobile drawer when Library or Search is clicked
  document.getElementById('sidebarLibraryBtn')?.addEventListener('click', () => {
    if (window.innerWidth <= 992) closeMobileDrawer();
  });
  document.getElementById('sidebarSearchBtn')?.addEventListener('click', () => {
    if (window.innerWidth <= 992) closeMobileDrawer();
  });

  // =========================================================================
  // 5. MODULAR CONTROLLERS INITIALIZATION
  // =========================================================================
  const screenMonitor = new ScreenMonitorController(apiClient, store);
  const presentationCtrl = new PresentationController(apiClient, store);
  const quickClearCtrl = new QuickClearController(apiClient, store);
  const playlistCtrl = new PlaylistController(apiClient, store);
  const rightTabsCtrl = new RightTabsController(apiClient, store);
  const songSearchCtrl = new ProSongSearchController(apiClient, store);
  
  window.presentationCtrl = presentationCtrl;
  window.playlistCtrl = playlistCtrl;
  window.songSearchCtrl = songSearchCtrl;

  // Initialize Bible Controller early so onEnterBibleView is ready for view restore
  if (window.BibleController) {
    const bibleCtrl = new BibleController(apiClient, store);
    window.bibleCtrl = bibleCtrl;
    bibleCtrl.init().catch(err => console.warn('[App] BibleCtrl init error:', err));
  }

  // Preload active presentation into cue grid
  presentationCtrl.loadInitialPresentation();

  // Initialize with Show view (or user's saved preference)
  const initialView = localStorage.getItem('proPresenterWorkspaceView') || 'show';
  setWorkspaceView(initialView);

  // =========================================================================
  // 6. MODALS & UTILITIES
  // =========================================================================
  const qrModal = document.getElementById('stageMonitorQRModal');
  const openQRBtn = document.getElementById('sidebarStageQRBtn') || document.getElementById('openStageMonitorQRBtn');
  const closeQRBtn = document.getElementById('closeStageMonitorQRBtn');
  const qrTarget = document.getElementById('stageMonitorQRCodeTarget');
  const copyLinkBtn = document.getElementById('copyStageMonitorLinkBtn');
  const stageMonitorLinkInput = document.getElementById('stageMonitorLinkInput');

  /**
   * Constructs the absolute Stage Monitor URL for mobile sharing.
   * @returns {string}
   */
  function getStageMonitorURL() {
    const serverHost = window.location.hostname || config.ip;
    const serverPort = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;
    return `${protocol}//${serverHost}${serverPort}/pages/stageMonitor.html?ip=${encodeURIComponent(config.ip)}&port=${encodeURIComponent(config.port)}`;
  }

  if (openQRBtn && qrModal) {
    openQRBtn.addEventListener('click', () => {
      const url = getStageMonitorURL();
      if (stageMonitorLinkInput) stageMonitorLinkInput.value = url;
      if (qrTarget) {
        qrTarget.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
          new QRCode(qrTarget, {
            text: url,
            width: 200,
            height: 200,
            colorDark: "#ff9f0a",
            colorLight: "#000000",
            correctLevel: QRCode.CorrectLevel.M
          });
        }
      }
      if (typeof bootstrap !== 'undefined') {
        bootstrap.Modal.getOrCreateInstance(qrModal).show();
      } else {
        qrModal.style.display = 'block';
      }
      if (window.innerWidth <= 992 && typeof closeMobileDrawer === 'function') {
        closeMobileDrawer();
      }
    });
  }

  if (copyLinkBtn && stageMonitorLinkInput) {
    copyLinkBtn.addEventListener('click', () => {
      stageMonitorLinkInput.select();
      navigator.clipboard.writeText(stageMonitorLinkInput.value).then(() => {
        copyLinkBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => { copyLinkBtn.innerHTML = '<i class="fas fa-copy"></i> Copy'; }, 2000);
      });
    });
  }



  // Disconnect & Settings
  document.getElementById('disconnectBtn')?.addEventListener('click', () => {
    if (confirm('Disconnect from ProPresenter and return to connection settings?')) {
      streamClient.disconnect();
      AppConfig.clearConfig();
      window.location.href = '/';
    }
  });

  // Keyboard Shortcuts Modal Trigger
  const headerShortcutsBtn = document.getElementById('sidebarShortcutsBtn') || document.getElementById('headerShortcutsBtn');
  const shortcutsModalEl = document.getElementById('keyboardShortcutsModal');
  headerShortcutsBtn?.addEventListener('click', () => {
    if (shortcutsModalEl && window.bootstrap) {
      new bootstrap.Modal(shortcutsModalEl).show();
    }
    if (window.innerWidth <= 992 && typeof closeMobileDrawer === 'function') {
      closeMobileDrawer();
    }
  });

  // =========================================================================
  // GLOBAL KEYBOARD SHORTCUTS MANAGER
  // =========================================================================
  document.addEventListener('keydown', (e) => {
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable;

    // Ctrl+\ -> Toggle Left Sidebar (Desktop Rail / Mobile Drawer)
    if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
      e.preventDefault();
      if (typeof toggleSidebar === 'function') toggleSidebar();
      return;
    }

    // Ctrl+L or Cmd+L -> Open Library & Playlists Catalog
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      playlistCtrl?.openModal();
      return;
    }

    // Ctrl+K or Cmd+K -> Open Global Song Search Modal
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      window.songSearchCtrl?.openModal();
      return;
    }

    // Ctrl+B or Cmd+B -> Switch to Bible & Focus Scripture Search
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      setWorkspaceView('bible');
      setTimeout(() => {
        document.getElementById('bibleSearchInput')?.focus();
      }, 150);
      return;
    }

    // Ctrl+R -> Open ProPresenter RSS URLs Modal
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      setWorkspaceView('bible');
      if (window.bibleCtrl) {
        window.bibleCtrl.showRssModal();
      }
      return;
    }

    // Ctrl+M -> Open Stage Monitor QR Access Modal
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      document.getElementById('sidebarStageQRBtn')?.click() || document.getElementById('openStageMonitorQRBtn')?.click();
      return;
    }

    // Ctrl+/ or ? -> Open Keyboard Shortcuts Reference
    if ((e.ctrlKey || e.metaKey) && (e.key === '/' || e.key === '?')) {
      e.preventDefault();
      document.getElementById('sidebarShortcutsBtn')?.click() || headerShortcutsBtn?.click();
      return;
    }

    // Ctrl+1 -> Presentation Show View
    if ((e.ctrlKey || e.metaKey) && e.key === '1') {
      e.preventDefault();
      setWorkspaceView('show');
      return;
    }

    // Ctrl+2 -> Bible Scripture View
    if ((e.ctrlKey || e.metaKey) && e.key === '2') {
      e.preventDefault();
      setWorkspaceView('bible');
      return;
    }

    // Ctrl+Shift+C -> Clear All Projection Layers
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      apiClient.clearAll().catch(() => {});
      return;
    }

    // Ignore slide navigation if currently typing inside an input field
    if (isInput) return;

    // Slide navigation: Space / ArrowRight -> Next slide
    if (e.key === ' ' || e.key === 'ArrowRight') {
      e.preventDefault();
      document.getElementById('nextSlideBtn')?.click();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      document.getElementById('prevSlideBtn')?.click();
    }
  });


  // Copy RSS Buttons Handler inside Modal
  document.querySelectorAll('.copy-rss-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (input) {
        input.select();
        navigator.clipboard.writeText(input.value).then(() => {
          const original = btn.innerHTML;
          btn.innerHTML = '<i class="fas fa-check me-1"></i> Copied!';
          btn.classList.add('btn-success');
          setTimeout(() => {
            btn.innerHTML = original;
            btn.classList.remove('btn-success');
          }, 2000);
        });
      }
    });
  });

  // Initiate bootstrap
  await bootstrapConnection();
});

