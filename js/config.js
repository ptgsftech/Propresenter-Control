/**
 * @file config.js
 * @description ProPresenter Controller Configuration Manager.
 * Handles server IP, port, connection status, and persistent storage synchronization.
 *
 * @version 1.0.0
 * @license MIT
 */

/**
 * Global configuration object for the ProPresenter Controller application.
 * Manages retrieval and storage of connection parameters via URL parameters and LocalStorage.
 *
 * @namespace AppConfig
 */
const AppConfig = {
  /**
   * Keys used for storing configuration in HTML5 localStorage.
   * @readonly
   * @enum {string}
   */
  STORAGE_KEYS: {
    /** @type {string} LocalStorage key for ProPresenter host IP address */
    IP: 'proPresenterIP',
    /** @type {string} LocalStorage key for ProPresenter network API port */
    PORT: 'proPresenterPort',
    /** @type {string} LocalStorage key for generated ProPresenter base URL */
    BASE_URL: 'proPresenterBaseURL',
    /** @type {string} LocalStorage key for connection state flag */
    CONNECTED: 'proPresenterConnected',
    /** @type {string} LocalStorage key for cached ProPresenter version */
    VERSION: 'proPresenterVersion',
    /** @type {string} LocalStorage key for timestamp of last successful connection */
    LAST_CONNECTED: 'proPresenterLastConnected'
  },

  /**
   * Default fallback IP address for the ProPresenter host server.
   * @constant {string}
   */
  DEFAULT_IP: '192.168.0.200',

  /**
   * Default network API port for ProPresenter OpenAPI.
   * Configurable in ProPresenter Preferences -> Network.
   * @constant {string}
   */
  DEFAULT_PORT: '1025',

  /**
   * Retrieves the effective connection configuration.
   * Prioritizes URL query parameters over localStorage, with fallback to default constants.
   *
   * @returns {{ ip: string, port: string, baseURL: string }} Active connection parameters.
   *
   * @example
   * const config = AppConfig.getConfig();
   * console.log(config.baseURL); // e.g., "http://192.168.0.200:1025"
   */
  getConfig() {
    // 1. Inspect URL parameters (useful for direct QR code scanning or bookmarking)
    const urlParams = new URLSearchParams(window.location.search);
    const queryIp = urlParams.get('ip');
    const queryPort = urlParams.get('port');

    // 2. Read from localStorage (including saved baseURL from user input)
    let savedBaseURL = localStorage.getItem(this.STORAGE_KEYS.BASE_URL);
    let ip = queryIp || localStorage.getItem(this.STORAGE_KEYS.IP);
    let port = queryPort || localStorage.getItem(this.STORAGE_KEYS.PORT);

    // 3. Fallbacks
    if (!ip) {
      ip = (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
        ? window.location.hostname
        : this.DEFAULT_IP;
    }

    if (!port) {
      port = this.DEFAULT_PORT;
    }

    const cleanIp = ip.trim();
    const cleanPort = port.trim();
    const baseURL = (queryIp || queryPort) ? `http://${cleanIp}:${cleanPort}` : (savedBaseURL || `http://${cleanIp}:${cleanPort}`);

    return {
      ip: cleanIp,
      port: cleanPort,
      baseURL: baseURL
    };
  },

  /**
   * Saves updated connection parameters and generated baseURL to localStorage from user input.
   *
   * @param {string} ip - The ProPresenter server IPv4 address or hostname entered by user.
   * @param {string|number} port - The API port number entered by user (e.g. 1025).
   */
  saveConfig(ip, port) {
    const cleanIp = ip ? String(ip).trim() : this.DEFAULT_IP;
    const cleanPort = port ? String(port).trim() : this.DEFAULT_PORT;
    const baseURL = `http://${cleanIp}:${cleanPort}`;

    localStorage.setItem(this.STORAGE_KEYS.IP, cleanIp);
    localStorage.setItem(this.STORAGE_KEYS.PORT, cleanPort);
    localStorage.setItem(this.STORAGE_KEYS.BASE_URL, baseURL);
    localStorage.setItem(this.STORAGE_KEYS.CONNECTED, 'true');
    localStorage.setItem(this.STORAGE_KEYS.LAST_CONNECTED, new Date().toISOString());
  },

  /**
   * Records successful connection verification and software version.
   *
   * @param {string} [version] - The ProPresenter version string returned by GET /version.
   */
  setConnected(version) {
    localStorage.setItem(this.STORAGE_KEYS.CONNECTED, 'true');
    if (version) {
      localStorage.setItem(this.STORAGE_KEYS.VERSION, String(version));
    }
  },

  /**
   * Clears saved connection session state upon user logout or disconnect.
   */
  clearConfig() {
    localStorage.removeItem(this.STORAGE_KEYS.CONNECTED);
    localStorage.removeItem(this.STORAGE_KEYS.VERSION);
  }
};

// Export to window global scope for modular access
window.AppConfig = AppConfig;
