/**
 * @file config.js
 * @description Centralized Configuration Loader for ProPresenter Web Studio Controller.
 * Loads configuration with fallback priority:
 *   1. config.local.json (Local machine overrides containing private church tokens)
 *   2. config.json (Main project configuration, safe for GitHub)
 *   3. process.env (System environment variables)
 *   4. Built-in defaults
 *
 * Keeps real secret tokens in config.local.json (git-ignored) while config.json
 * remains clean and safe for GitHub push protection.
 *
 * @version 1.2.0
 * @license MIT
 */

const fs = require('fs');
const path = require('path');

function loadConfiguration() {
  const rootDir = path.resolve(__dirname, '..');
  let loaded = {};
  let source = 'defaults';

  // 1. Base configuration: config.json
  const jsonPath = path.join(rootDir, 'config.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const jsonContent = fs.readFileSync(jsonPath, 'utf8');
      Object.assign(loaded, JSON.parse(jsonContent));
      source = 'config.json';
    } catch (err) {
      console.warn('[Config] Failed to read config.json:', err.message);
    }
  }

  // 2. Local overrides: config.local.json (if present on local machine)
  const localJsonPath = path.join(rootDir, 'config.local.json');
  if (fs.existsSync(localJsonPath)) {
    try {
      const localContent = fs.readFileSync(localJsonPath, 'utf8');
      const parsedLocal = JSON.parse(localContent);
      Object.assign(loaded, parsedLocal);
      source = 'config.json + config.local.json';
    } catch (err) {
      console.warn('[Config] Failed to read config.local.json:', err.message);
    }
  }

  // 3. Fallback: Check legacy .env if present
  const envPath = path.join(rootDir, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split(/\r?\n/);
      for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        const eqIdx = line.indexOf('=');
        if (eqIdx !== -1) {
          const k = line.slice(0, eqIdx).trim();
          let v = line.slice(eqIdx + 1).trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          if (!loaded[k] || loaded[k].includes('<YOUR_') || loaded[k] === 'your_cloudflare_api_token_here') {
            loaded[k] = v;
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // 4. Populate process.env for any key not already provided by system
  for (const [key, val] of Object.entries(loaded)) {
    if (process.env[key] === undefined && val !== undefined) {
      process.env[key] = String(val);
    }
  }

  // 5. Final resolution with system environment overrides and sensible fallbacks
  const PORT = parseInt(process.env.PORT || loaded.PORT, 10) || 8080;
  const PROPRESENTER_HOST = (process.env.PROPRESENTER_HOST || loaded.PROPRESENTER_HOST || '192.168.0.200').trim();
  const PROPRESENTER_PORT = String(process.env.PROPRESENTER_PORT || loaded.PROPRESENTER_PORT || '1025').trim();
  const PROPRESENTER_BASE_URL = `http://${PROPRESENTER_HOST}:${PROPRESENTER_PORT}`;

  const CLOUDFLARE_QUERY_URL = (process.env.CLOUDFLARE_QUERY_URL || loaded.CLOUDFLARE_QUERY_URL || '').trim();
  const CLOUDFLARE_API_TOKEN = (process.env.CLOUDFLARE_API_TOKEN || loaded.CLOUDFLARE_API_TOKEN || '').trim();

  return {
    PORT,
    PROPRESENTER_HOST,
    PROPRESENTER_PORT,
    PROPRESENTER_BASE_URL,
    CLOUDFLARE_QUERY_URL,
    CLOUDFLARE_API_TOKEN,
    loadedFrom: source,
    raw: loaded
  };
}

const config = loadConfiguration();

module.exports = config;
