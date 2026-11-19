/**
 * Paimon.moe-style zero-backend Google Drive Sync (`drive.appdata` private folder).
 * Uses Google Identity Services (GIS) OAuth2 Token Client + Drive REST API v3.
 *
 * Site owner configures ONE public OAuth Web Client ID via `VITE_GOOGLE_CLIENT_ID` in `.env`
 * (or Cloudflare Pages / Vercel environment variables). Visitors just click "Sign in with Google".
 */

import { mergePullRecords } from './pityEngine.js';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const SYNC_FILENAME = 'hethereau-sync-v1.json';
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

let gisLoadPromise = null;

export function getGoogleClientId() {
  const id = typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_GOOGLE_CLIENT_ID
    : '';
  return (id || '').trim();
}

export function isDriveSyncConfigured() {
  return getGoogleClientId().length > 0;
}

export function loadGoogleIdentityScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Sign-In requires a browser environment.'));
  }
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load Google Identity Services script.'))
      );
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoadPromise = null;
      reject(new Error('Failed to load Google Identity Services script. Check your connection.'));
    };
    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

export async function requestDriveAccessToken({ prompt = 'consent' } = {}) {
  const id = getGoogleClientId();
  if (!id) {
    throw new Error('Google Drive sync is not configured yet (missing VITE_GOOGLE_CLIENT_ID).');
  }
  await loadGoogleIdentityScript();

  return await new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: id,
      scope: `${DRIVE_SCOPE} https://www.googleapis.com/auth/userinfo.email`,
      include_granted_scopes: true,
      callback: (resp) => {
        if (resp?.error) {
          reject(new Error(resp.error_description || resp.error));
          return;
        }
        if (!resp?.access_token) {
          reject(new Error('Google did not return an access token.'));
          return;
        }
        const hasDrive =
          typeof window.google?.accounts?.oauth2?.hasGrantedAllScopes === 'function'
            ? window.google.accounts.oauth2.hasGrantedAllScopes(resp, DRIVE_SCOPE)
            : String(resp.scope || '').split(/\s+/).includes(DRIVE_SCOPE);
        if (!hasDrive) {
          reject(
            new Error(
              'Google Drive permission was not checked. Click "Sign in with Google Drive" again and tick the box for "See, create, and delete its own configuration data in your Google Drive".'
            )
          );
          return;
        }
        resolve({
          accessToken: resp.access_token,
          expiresAt: Date.now() + Number(resp.expires_in || 3500) * 1000,
        });
      },
      error_callback: (err) => {
        reject(new Error(err?.message || 'Google sign-in popup was closed or blocked.'));
      },
    });
    tokenClient.requestAccessToken({ prompt });
  });
}

function formatDriveApiError(action, status, bodyText) {
  if (status === 403) {
    const lower = String(bodyText || '').toLowerCase();
    if (lower.includes('insufficient') || lower.includes('scope')) {
      return 'Google Drive permission was not granted. Click "Sign in with Google Drive" again and tick the checkbox for Drive app data access.';
    }
    if (lower.includes('accessnotconfigured') || lower.includes('has not been used in project')) {
      return 'Google Drive API is not enabled on the Google Cloud project yet.';
    }
  }
  return `Drive ${action} failed (${status}): ${String(bodyText || '').slice(0, 180)}`;
}

export async function fetchGoogleUserEmail(accessToken) {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return '';
    const json = await res.json();
    return json.email || '';
  } catch {
    return '';
  }
}

export async function findDriveSyncFile(accessToken) {
  const q = encodeURIComponent(`name='${SYNC_FILENAME}' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime)&pageSize=5`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) throw new Error('AUTH_EXPIRED');
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(formatDriveApiError('search', res.status, txt));
  }
  const data = await res.json();
  return data.files?.[0] || null;
}

export async function downloadDriveSyncFile(accessToken, fileId) {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) throw new Error('AUTH_EXPIRED');
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(formatDriveApiError('download', res.status, txt));
  }
  const json = await res.json();
  return json?.state && json.state.profiles ? json.state : null;
}

export async function createDriveSyncFile(accessToken, state) {
  const metadata = {
    name: SYNC_FILENAME,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
  };
  const payload = JSON.stringify({
    format: 'hethereau-drive-sync',
    version: 1,
    updated_at: new Date().toISOString(),
    state,
  });

  const boundary = 'hethereau_sync_boundary_' + Math.random().toString(36).slice(2);
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${payload}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (res.status === 401) throw new Error('AUTH_EXPIRED');
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Drive create failed (${res.status}): ${txt.slice(0, 180)}`);
  }
  return await res.json();
}

export async function updateDriveSyncFile(accessToken, fileId, state) {
  const payload = JSON.stringify({
    format: 'hethereau-drive-sync',
    version: 1,
    updated_at: new Date().toISOString(),
    state,
  });

  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,modifiedTime`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: payload,
    }
  );
  if (res.status === 401) throw new Error('AUTH_EXPIRED');
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Drive upload failed (${res.status}): ${txt.slice(0, 180)}`);
  }
  return await res.json();
}

export function countStateRecords(state) {
  if (!state?.profiles) return 0;
  return Object.values(state.profiles).reduce(
    (sum, p) => sum + (Array.isArray(p.records) ? p.records.length : 0),
    0
  );
}

export function smartMergeStates(localState, remoteState) {
  const mergedProfiles = {};
  const allIds = new Set([
    ...Object.keys(localState?.profiles || {}),
    ...Object.keys(remoteState?.profiles || {}),
  ]);

  for (const pid of allIds) {
    const lp = localState?.profiles?.[pid];
    const rp = remoteState?.profiles?.[pid];
    if (lp && !rp) {
      mergedProfiles[pid] = { ...lp, records: [...(lp.records || [])] };
    } else if (rp && !lp) {
      mergedProfiles[pid] = { ...rp, records: [...(rp.records || [])] };
    } else {
      const { merged } = mergePullRecords(rp.records || [], lp.records || []);
      const lTime = lp.updatedAt || '';
      const rTime = rp.updatedAt || '';
      const newer = lTime >= rTime ? lp : rp;
      mergedProfiles[pid] = {
        ...newer,
        updatedAt: new Date().toISOString(),
        records: merged,
      };
    }
  }

  const activeProfileId =
    (localState?.activeProfileId && mergedProfiles[localState.activeProfileId]
      ? localState.activeProfileId
      : remoteState?.activeProfileId) || Object.keys(mergedProfiles)[0];

  return {
    activeProfileId,
    profiles: mergedProfiles,
  };
}

export function statesHaveSamePullIds(a, b) {
  const keysA = Object.keys(a?.profiles || {}).sort();
  const keysB = Object.keys(b?.profiles || {}).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i]) return false;
    const ra = a.profiles[keysA[i]]?.records || [];
    const rb = b.profiles[keysB[i]]?.records || [];
    if (ra.length !== rb.length) return false;
    const setA = new Set(ra.map((r) => r.id));
    for (const r of rb) {
      if (!setA.has(r.id)) return false;
    }
  }
  return true;
}
