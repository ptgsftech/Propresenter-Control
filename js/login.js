/**
 * @file login.js
 * @description ProPresenter Connection tester and login handler.
 */

document.addEventListener('DOMContentLoaded', () => {
  const ipInput = document.getElementById('ipAddress');
  const portInput = document.getElementById('port');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const connectBtn = document.getElementById('connectBtn');
  const directStudioBtn = document.getElementById('directStudioBtn');
  const footerStudioLink = document.getElementById('footerStudioLink');
  const connectionForm = document.getElementById('connectionForm');

  // Pre-fill from AppConfig / localStorage
  const currentConfig = window.AppConfig ? window.AppConfig.getConfig() : { ip: '192.168.0.200', port: '1025' };
  if (ipInput) ipInput.value = currentConfig.ip;
  if (portInput) portInput.value = currentConfig.port;

  const savedUser = localStorage.getItem('proPresenterUsername');
  if (usernameInput && savedUser) usernameInput.value = savedUser;

  // Preset buttons handler
  document.querySelectorAll('.preset-ip').forEach(btn => {
    btn.addEventListener('click', () => {
      if (ipInput) ipInput.value = btn.getAttribute('data-ip');
    });
  });

  document.querySelectorAll('.preset-port').forEach(btn => {
    btn.addEventListener('click', () => {
      if (portInput) portInput.value = btn.getAttribute('data-port');
    });
  });

  /**
   * Safe navigation to the main Studio Controller website at /controller.
   * @param {boolean} [bypass=false]
   */
  function goToWebsite(bypass = false) {
    window.location.href = bypass ? '/controller?bypass=true' : '/controller';
  }

  /**
   * Persists active connection settings to local storage.
   * @param {string} ip
   * @param {string} port
   * @param {string} [version='v7']
   */
  function persistSettings(ip, port, version = 'v7') {
    if (window.AppConfig) {
      window.AppConfig.saveConfig(ip, port);
      window.AppConfig.setConnected(version);
    } else {
      localStorage.setItem('proPresenterIP', ip);
      localStorage.setItem('proPresenterPort', port);
      localStorage.setItem('proPresenterConnected', 'true');
    }

    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    if (username) localStorage.setItem('proPresenterUsername', username);
    if (password) sessionStorage.setItem('proPresenterSessionPass', btoa(password));
  }

  // Direct Website Entry button handler
  if (directStudioBtn) {
    directStudioBtn.addEventListener('click', () => {
      const ip = (ipInput ? ipInput.value.trim() : '') || '192.168.0.200';
      const port = (portInput ? portInput.value.trim() : '') || '1025';
      persistSettings(ip, port, 'Direct Access');
      goToWebsite(true);
    });
  }

  // Footer direct website link handler
  if (footerStudioLink) {
    footerStudioLink.addEventListener('click', (e) => {
      const ip = (ipInput ? ipInput.value.trim() : '') || '192.168.0.200';
      const port = (portInput ? portInput.value.trim() : '') || '1025';
      persistSettings(ip, port, 'Direct Link');
    });
  }

  // Form submit (Connect & Test)
  if (connectionForm) {
    connectionForm.addEventListener('submit', (e) => {
      e.preventDefault();
      connectToProPresenter();
    });
  }

  async function connectToProPresenter() {
    const ip = ipInput.value.trim() || '192.168.0.200';
    const port = portInput.value.trim() || '1025';

    const originalContent = connectBtn.innerHTML;
    connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
    connectBtn.disabled = true;

    const baseURL = `http://${ip}:${port}`;

    try {
      // 2.5-second timeout so user is never blocked or hanging indefinitely
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const response = await fetch(`${baseURL}/version`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        persistSettings(ip, port, data.version || data.api_version || 'v7');

        connectBtn.innerHTML = '<i class="fas fa-check"></i> Connected! Opening Website...';
        connectBtn.classList.remove('btn-warning');
        connectBtn.classList.add('btn-success');

        setTimeout(() => {
          goToWebsite(false);
        }, 300);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      console.warn('Live connection check warning:', err);
      // Persist user-entered values so they carry over to the controller
      persistSettings(ip, port, 'Offline Mode');

      const proceed = confirm(
        `Unable to verify real-time link at ${baseURL} (${err.name === 'AbortError' ? 'Connection timed out' : 'Host unreachable'}).\n\nWould you like to open the Studio Website anyway in ready/offline mode?`
      );

      if (proceed) {
        connectBtn.innerHTML = '<i class="fas fa-arrow-right"></i> Opening Website...';
        setTimeout(() => {
          goToWebsite(true);
        }, 200);
      } else {
        connectBtn.innerHTML = originalContent;
        connectBtn.disabled = false;
      }
    }
  }
});