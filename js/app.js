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
  const audienceHeaderBtn = document.getElementById('headerAudienceBtn');
  const stageHeaderBtn = document.getElementById('headerStageBtn');
  const audienceBadge = document.getElementById('headerAudienceBadge');
  const stageBadge = document.getElementById('headerStageBadge');

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
    const isAud = store.state.audienceScreensEnabled;
    const isStg = store.state.stageScreensEnabled;

    if (headerAudBtn) {
      headerAudBtn.classList.toggle('is-on', Boolean(isAud));
      headerAudBtn.title = `Audience Screen: ${isAud ? 'Active (Click to Turn OFF)' : 'Inactive (Click to Turn ON)'}`;
    }
    if (headerStgBtn) {
      headerStgBtn.classList.toggle('is-on', Boolean(isStg));
      headerStgBtn.title = `Stage Screen: ${isStg ? 'Active (Click to Turn OFF)' : 'Inactive (Click to Turn ON)'}`;
    }
  }

  if (headerAudBtn) {
    headerAudBtn.addEventListener('click', async () => {
      try {
        const current = await apiClient.getAudienceScreenStatus();
        const isTrue = (current === true || current === 'true' || (current && current.status === true));
        const nextStatus = !isTrue;
        await apiClient.setAudienceScreenStatus(nextStatus);
        store.setState({ audienceScreensEnabled: nextStatus });
        syncHeaderScreenButtons();
      } catch (e) {
        console.error('[App] Audience toggle error:', e);
      }
    });
  }

  if (headerStgBtn) {
    headerStgBtn.addEventListener('click', async () => {
      try {
        const current = await apiClient.getStageScreenStatus();
        const isTrue = (current === true || current === 'true' || (current && current.status === true));
        const nextStatus = !isTrue;
        await apiClient.setStageScreenStatus(nextStatus);
        store.setState({ stageScreensEnabled: nextStatus });
        syncHeaderScreenButtons();
      } catch (e) {
        console.error('[App] Stage toggle error:', e);
      }
    });
  }

  store.subscribe('screen:audience', () => syncHeaderScreenButtons());
  store.subscribe('screen:stage', () => syncHeaderScreenButtons());

  // Initial check of screen statuses
  apiClient.getAudienceScreenStatus().then(st => {
    const isTrue = (st === true || st === 'true' || (st && st.status === true));
    store.setState({ audienceScreensEnabled: isTrue });
    syncHeaderScreenButtons();
  }).catch(() => {});

  apiClient.getStageScreenStatus().then(st => {
    const isTrue = (st === true || st === 'true' || (st && st.status === true));
    store.setState({ stageScreensEnabled: isTrue });
    syncHeaderScreenButtons();
  }).catch(() => {});

  // =========================================================================
  // 4C. WORKSPACE VIEW SWITCHER (Show vs Bible)
  // =========================================================================
  const viewModeShowBtn = document.getElementById('viewModeShowBtn');
  const viewModeBibleBtn = document.getElementById('viewModeBibleBtn');
  const cuesSection = document.getElementById('cuesSectionWrapper');
  const bibleSection = document.getElementById('middleRow3Bible');
  const topNavRssFeedsBtn = document.getElementById('topNavRssFeedsBtn');

  function setWorkspaceView(view) {
    if (view === 'bible') {
      viewModeBibleBtn?.classList.add('active');
      viewModeShowBtn?.classList.remove('active');
      
      // Hide Presentation Section completely
      cuesSection?.classList.add('d-none', 'workspace-view-hidden');
      if (cuesSection) cuesSection.style.setProperty('display', 'none', 'important');
      
      // Display Bible Section completely
      bibleSection?.classList.remove('d-none', 'workspace-view-hidden');
      if (bibleSection) bibleSection.style.setProperty('display', 'flex', 'important');

      // Requirement 4: The RSS feed should only show while selecting the Bible option
      if (topNavRssFeedsBtn) {
        topNavRssFeedsBtn.style.display = 'inline-flex';
      }
      
      localStorage.setItem('proPresenterWorkspaceView', 'bible');
    } else {
      viewModeShowBtn?.classList.add('active');
      viewModeBibleBtn?.classList.remove('active');
      
      // Hide Bible Section completely
      bibleSection?.classList.add('d-none', 'workspace-view-hidden');
      if (bibleSection) bibleSection.style.setProperty('display', 'none', 'important');
      
      // Display Presentation Section completely
      cuesSection?.classList.remove('d-none', 'workspace-view-hidden');
      if (cuesSection) cuesSection.style.setProperty('display', 'flex', 'important');

      // Requirement 4: Hide RSS Feed button when in Show view
      if (topNavRssFeedsBtn) {
        topNavRssFeedsBtn.style.display = 'none';
      }
      
      localStorage.setItem('proPresenterWorkspaceView', 'show');
    }
  }

  window.setWorkspaceView = setWorkspaceView;

  viewModeShowBtn?.addEventListener('click', () => setWorkspaceView('show'));
  viewModeBibleBtn?.addEventListener('click', () => setWorkspaceView('bible'));

  // Top Nav direct RSS Feeds button
  topNavRssFeedsBtn?.addEventListener('click', () => {
    setWorkspaceView('bible');
    if (window.bibleCtrl) {
      window.bibleCtrl.showRssModal();
    }
  });

  // Initialize with Show view (or user's saved preference)
  const initialView = localStorage.getItem('proPresenterWorkspaceView') || 'show';
  setWorkspaceView(initialView);


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

  // Preload active presentation into cue grid
  presentationCtrl.loadInitialPresentation();

  // =========================================================================
  // 6. MODALS & UTILITIES
  // =========================================================================
  const qrModal = document.getElementById('stageMonitorQRModal');
  const openQRBtn = document.getElementById('openStageMonitorQRBtn');
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

  // Mobile Drawer & Backdrop Controls
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  const leftSidebar = document.querySelector('.col-sidebar-left');
  const rightSidebar = document.querySelector('.col-sidebar-right');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  const leftSidebarCloseBtn = document.getElementById('leftSidebarCloseBtn');
  const rightSidebarCloseBtn = document.getElementById('rightSidebarCloseBtn');

  function closeAllSidebars() {
    leftSidebar?.classList.remove('open');
    rightSidebar?.classList.remove('open');
    sidebarBackdrop?.classList.remove('active');
  }

  function toggleLeftSidebar() {
    rightSidebar?.classList.remove('open');
    const isOpen = leftSidebar?.classList.toggle('open');
    if (isOpen) {
      sidebarBackdrop?.classList.add('active');
    } else {
      sidebarBackdrop?.classList.remove('active');
    }
  }

  function toggleRightSidebar() {
    leftSidebar?.classList.remove('open');
    const isOpen = rightSidebar?.classList.toggle('open');
    if (isOpen) {
      sidebarBackdrop?.classList.add('active');
    } else {
      sidebarBackdrop?.classList.remove('active');
    }
  }

  sidebarToggleBtn?.addEventListener('click', toggleLeftSidebar);
  leftSidebarCloseBtn?.addEventListener('click', closeAllSidebars);
  rightSidebarCloseBtn?.addEventListener('click', closeAllSidebars);
  sidebarBackdrop?.addEventListener('click', closeAllSidebars);

  // Auto-close left sidebar on mobile when selecting a playlist or presentation
  document.getElementById('playlistsList')?.addEventListener('click', (e) => {
    if (window.innerWidth <= 992 && (e.target.closest('.sidebar-item-row') || e.target.closest('.tier-item-song'))) {
      closeAllSidebars();
    }
  });

  // Mobile Bottom Navigation Tabs (5 Ergonomic Actions)
  const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
  mobileNavItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.getAttribute('data-tab');

      if (tab === 'cues') {
        closeAllSidebars();
        mobileNavItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        const isBibleMode = document.getElementById('viewModeBibleBtn')?.classList.contains('active');
        const targetView = isBibleMode ? document.getElementById('middleRow3Bible') : document.getElementById('cuesSectionWrapper');
        targetView?.scrollIntoView({ behavior: 'smooth' });
      } else if (tab === 'clears') {
        closeAllSidebars();
        mobileNavItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        document.getElementById('sidebarClearsRow')?.scrollIntoView({ behavior: 'smooth' });
      } else if (tab === 'sets') {
        closeAllSidebars();
        playlistCtrl?.openModal('library');
      } else if (tab === 'drawer') {
        toggleRightSidebar();
      } else if (tab === 'stage') {
        window.open('/stage', '_blank');
      }
    });
  });

  // Disconnect & Settings
  document.getElementById('disconnectBtn')?.addEventListener('click', () => {
    if (confirm('Disconnect from ProPresenter and return to connection settings?')) {
      streamClient.disconnect();
      AppConfig.clearConfig();
      window.location.href = '/';
    }
  });

  // Keyboard Shortcuts Modal Trigger
  const headerShortcutsBtn = document.getElementById('headerShortcutsBtn');
  const shortcutsModalEl = document.getElementById('keyboardShortcutsModal');
  headerShortcutsBtn?.addEventListener('click', () => {
    if (shortcutsModalEl && window.bootstrap) {
      new bootstrap.Modal(shortcutsModalEl).show();
    }
  });

  // =========================================================================
  // GLOBAL KEYBOARD SHORTCUTS MANAGER
  // =========================================================================
  document.addEventListener('keydown', (e) => {
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable;

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
      document.getElementById('openStageMonitorQRBtn')?.click();
      return;
    }

    // Ctrl+/ or ? -> Open Keyboard Shortcuts Reference
    if ((e.ctrlKey || e.metaKey) && (e.key === '/' || e.key === '?')) {
      e.preventDefault();
      headerShortcutsBtn?.click();
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

  // =========================================================================
  // BIBLE PRESENTER SECTION - Cloudflare D1 Parallel Engine
  // =========================================================================
  if (window.BibleController) {
    const bibleCtrl = new BibleController();
    window.bibleCtrl = bibleCtrl;
    await bibleCtrl.init();
  }

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

