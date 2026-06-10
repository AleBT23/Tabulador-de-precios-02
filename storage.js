/**
 * storage.js
 * LocalStorage abstraction layer for the Architectural Pricing & Proposal Management App.
 * Handles all data persistence including services, proposals, settings, and statistics.
 *
 * Fix #1: Added letterhead Base64 storage key and helper functions.
 */

const STORAGE_KEYS = {
  SERVICES:    'archiquote_services',
  PROPOSALS:   'archiquote_proposals',
  SETTINGS:    'archiquote_settings',
  COUNTER:     'archiquote_proposal_counter',
  LETTERHEAD:  'archiquote_letterhead_b64',  // Fix #1: Base64 letterhead storage
};

/* ─────────────────────────────────────────────
   GENERIC HELPERS
───────────────────────────────────────────── */

/**
 * Read a value from LocalStorage. Returns null if missing or parse error.
 * @param {string} key
 * @returns {*}
 */
function lsGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : null;
  } catch (e) {
    console.error(`[storage] Error reading key "${key}":`, e);
    return null;
  }
}

/**
 * Write a value to LocalStorage.
 * @param {string} key
 * @param {*} value
 */
function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`[storage] Error writing key "${key}":`, e);
  }
}

/**
 * Read a raw (non-JSON) string from LocalStorage.
 * Used for large Base64 strings to avoid double-encoding overhead.
 * @param {string} key
 * @returns {string|null}
 */
function lsGetRaw(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.error(`[storage] Error reading raw key "${key}":`, e);
    return null;
  }
}

/**
 * Write a raw string to LocalStorage (no JSON serialization).
 * @param {string} key
 * @param {string} value
 */
function lsSetRaw(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.error(`[storage] Error writing raw key "${key}":`, e);
  }
}

/* ─────────────────────────────────────────────
   LETTERHEAD (Fix #1)
───────────────────────────────────────────── */

/**
 * Save a Base64 data URL for the letterhead image.
 * @param {string} b64DataUrl  Full data:image/png;base64,... string
 */
function saveLetterheadB64(b64DataUrl) {
  lsSetRaw(STORAGE_KEYS.LETTERHEAD, b64DataUrl);
}

/**
 * Load the stored Base64 letterhead, or null if not set.
 * @returns {string|null}
 */
function loadLetterheadB64() {
  return lsGetRaw(STORAGE_KEYS.LETTERHEAD);
}

/**
 * Convert an image src (relative path or URL) to a Base64 data URL using canvas,
 * then persist it in LocalStorage for use in PDF generation.
 * @param {string} src
 * @returns {Promise<string>}  The Base64 data URL, or '' on failure.
 */
function storeLetterheadFromSrc(src) {
  return new Promise((resolve) => {
    if (!src || !src.trim()) { resolve(''); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        const b64 = canvas.toDataURL('image/png');
        saveLetterheadB64(b64);
        resolve(b64);
      } catch (e) {
        console.warn('[storage] Canvas conversion failed:', e);
        resolve('');
      }
    };
    img.onerror = () => {
      console.warn('[storage] Letterhead image failed to load:', src);
      resolve('');
    };
    img.src = src;
  });
}

/* ─────────────────────────────────────────────
   SETTINGS
───────────────────────────────────────────── */

/**
 * Load persisted settings, falling back to config defaults.
 * @returns {Object} settings
 */
function loadSettings() {
  const saved = lsGet(STORAGE_KEYS.SETTINGS);
  const defaults = {
    vat: CONFIG.DEFAULT_VAT,
    currency: CONFIG.DEFAULT_CURRENCY,
    letterheadPath: CONFIG.LETTERHEAD_PATH,
    applyVat: true,   // Fix #8: VAT toggle default
  };
  return saved ? Object.assign({}, defaults, saved) : defaults;
}

/**
 * Save settings to LocalStorage.
 * @param {Object} settings
 */
function saveSettings(settings) {
  lsSet(STORAGE_KEYS.SETTINGS, settings);
}

/* ─────────────────────────────────────────────
   SERVICES
───────────────────────────────────────────── */

/**
 * Load services catalogue. Seeds with defaults on first run.
 * @returns {Array<Object>}
 */
function loadServices() {
  let services = lsGet(STORAGE_KEYS.SERVICES);
  if (!services || !Array.isArray(services) || services.length === 0) {
    services = CONFIG.DEFAULT_SERVICES.map(s => ({ ...s }));
    lsSet(STORAGE_KEYS.SERVICES, services);
  }
  return services;
}

/**
 * Persist the entire services array.
 * @param {Array<Object>} services
 */
function saveServices(services) {
  lsSet(STORAGE_KEYS.SERVICES, services);
}

/**
 * Add or update a single service in the catalogue.
 * @param {Object} service
 */
function upsertService(service) {
  const services = loadServices();
  const idx = services.findIndex(s => s.id === service.id);
  if (idx >= 0) {
    services[idx] = { ...service };
  } else {
    services.push({ ...service });
  }
  saveServices(services);
}

/**
 * Delete a service by id.
 * @param {string} id
 */
function deleteService(id) {
  const services = loadServices().filter(s => s.id !== id);
  saveServices(services);
}

/* ─────────────────────────────────────────────
   PROPOSALS
───────────────────────────────────────────── */

/**
 * Load all proposals from storage.
 * @returns {Array<Object>}
 */
function loadProposals() {
  const proposals = lsGet(STORAGE_KEYS.PROPOSALS);
  return Array.isArray(proposals) ? proposals : [];
}

/**
 * Persist all proposals.
 * @param {Array<Object>} proposals
 */
function saveProposals(proposals) {
  lsSet(STORAGE_KEYS.PROPOSALS, proposals);
}

/**
 * Save (insert or update) a single proposal.
 * @param {Object} proposal  Must have a unique `id`.
 */
function upsertProposal(proposal) {
  const proposals = loadProposals();
  const idx = proposals.findIndex(p => p.id === proposal.id);
  if (idx >= 0) {
    proposals[idx] = { ...proposal, updatedAt: new Date().toISOString() };
  } else {
    proposals.unshift({ ...proposal, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  saveProposals(proposals);
}

/**
 * Load a single proposal by id.
 * @param {string} id
 * @returns {Object|null}
 */
function loadProposal(id) {
  return loadProposals().find(p => p.id === id) || null;
}

/**
 * Delete a proposal by id.
 * @param {string} id
 */
function deleteProposal(id) {
  const proposals = loadProposals().filter(p => p.id !== id);
  saveProposals(proposals);
}

/* ─────────────────────────────────────────────
   PROPOSAL NUMBERING
───────────────────────────────────────────── */

/**
 * Generate the next sequential proposal number.
 * Format: COT-YYYY-NNN
 * @returns {string}
 */
function nextProposalNumber() {
  const year = new Date().getFullYear();
  const counter = (lsGet(STORAGE_KEYS.COUNTER) || 0) + 1;
  lsSet(STORAGE_KEYS.COUNTER, counter);
  const seq = String(counter).padStart(3, '0');
  return `${CONFIG.PROPOSAL_PREFIX}-${year}-${seq}`;
}

/* ─────────────────────────────────────────────
   STATISTICS (computed on-the-fly)
───────────────────────────────────────────── */

/**
 * Compute dashboard statistics from stored proposals.
 * @returns {Object}
 */
function computeStats() {
  const proposals = loadProposals();
  const total = proposals.length;
  const totalValue = proposals.reduce((sum, p) => sum + (p.grandTotal || 0), 0);
  const avgValue = total > 0 ? totalValue / total : 0;

  // Service frequency
  const freq = {};
  proposals.forEach(p => {
    (p.items || []).forEach(item => {
      if (item.serviceName) {
        freq[item.serviceName] = (freq[item.serviceName] || 0) + 1;
      }
    });
  });
  const topService = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

  // Monthly aggregation (last 6 months)
  const monthly = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthly[key] = { count: 0, value: 0 };
  }
  proposals.forEach(p => {
    const d = new Date(p.createdAt || p.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (monthly[key] !== undefined) {
      monthly[key].count++;
      monthly[key].value += p.grandTotal || 0;
    }
  });

  return { total, totalValue, avgValue, topService, monthly };
}

/* ─────────────────────────────────────────────
   UNIQUE ID GENERATOR
───────────────────────────────────────────── */

/**
 * Generate a short unique ID.
 * @returns {string}
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
