import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import SyncConflictModal from './components/SyncConflictModal.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ImportPage from './pages/ImportPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import GlobalStatsPage from './pages/GlobalStatsPage.jsx';
import StaffStatsPage from './pages/StaffStatsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { loadCatalog } from './lib/catalog.js';
import { loadAppState, saveAppState } from './lib/storage.js';
import { analyzeAccountPulls, mergePullRecords } from './lib/pityEngine.js';
import { useLocation } from './lib/router.js';
import {
  contributePullRecords,
  getUnsyncedGlobalRecords,
} from './lib/statsApi.js';
import {
  countStateRecords,
  createDriveSyncFile,
  downloadDriveSyncFile,
  fetchGoogleUserEmail,
  findDriveSyncFile,
  requestDriveAccessToken,
  smartMergeStates,
  statesHaveSamePullIds,
  updateDriveSyncFile,
} from './lib/googleDriveSync.js';

export default function App() {
  const { pathname, poolParam } = useLocation();
  const [catalog, setCatalog] = useState(null);
  const [appState, setAppState] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Google Drive Sync state (debounced 5s cloud sync)
  const [driveSync, setDriveSync] = useState({
    signedIn: false,
    syncing: false,
    email: '',
    lastSyncAt: null,
    error: null,
  });
  const [conflict, setConflict] = useState(null);
  const [globalSyncVersion, setGlobalSyncVersion] = useState(0);
  const [globalSyncStatus, setGlobalSyncStatus] = useState(null);

  const driveAuthRef = useRef({
    accessToken: null,
    expiresAt: 0,
    fileId: null,
  });
  const syncTimerRef = useRef(null);
  const stateRef = useRef(null);

  useEffect(() => {
    stateRef.current = appState;
  }, [appState]);

  useEffect(() => {
    let mounted = true;
    Promise.all([loadCatalog(), loadAppState()]).then(([cat, state]) => {
      if (!mounted) return;
      setCatalog(cat);
      setAppState(state);
    });
    return () => {
      mounted = false;
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  async function ensureFreshToken() {
    const auth = driveAuthRef.current;
    if (auth.accessToken && Date.now() < auth.expiresAt - 60_000) {
      return auth.accessToken;
    }
    const fresh = await requestDriveAccessToken({ prompt: '' });
    auth.accessToken = fresh.accessToken;
    auth.expiresAt = fresh.expiresAt;
    return fresh.accessToken;
  }

  async function pushStateToDrive(targetState) {
    if (!driveAuthRef.current.accessToken) return;
    setDriveSync((prev) => ({ ...prev, syncing: true, error: null }));
    try {
      const token = await ensureFreshToken();
      let fileId = driveAuthRef.current.fileId;
      let res;
      if (fileId) {
        res = await updateDriveSyncFile(token, fileId, targetState);
      } else {
        const existing = await findDriveSyncFile(token);
        if (existing?.id) {
          fileId = existing.id;
          driveAuthRef.current.fileId = fileId;
          res = await updateDriveSyncFile(token, fileId, targetState);
        } else {
          res = await createDriveSyncFile(token, targetState);
          driveAuthRef.current.fileId = res.id;
        }
      }
      setDriveSync((prev) => ({
        ...prev,
        syncing: false,
        lastSyncAt: res?.modifiedTime || new Date().toISOString(),
        error: null,
      }));
    } catch (err) {
      setDriveSync((prev) => ({
        ...prev,
        syncing: false,
        error:
          err.message === 'AUTH_EXPIRED'
            ? 'Google session expired -- click Sign in again.'
            : err.message,
      }));
    }
  }

  function scheduleDebouncedDriveSync(nextState) {
    if (!driveAuthRef.current.accessToken) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    setDriveSync((prev) => ({ ...prev, syncing: true }));
    syncTimerRef.current = setTimeout(() => {
      pushStateToDrive(nextState);
    }, 5000);
  }

  function updateState(updater, { skipRemoteSync = false } = {}) {
    setAppState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveAppState(next);
      if (!skipRemoteSync) {
        scheduleDebouncedDriveSync(next);
      }
      return next;
    });
  }

  async function handleDriveConnect() {
    setDriveSync((prev) => ({ ...prev, syncing: true, error: null }));
    try {
      const { accessToken, expiresAt } = await requestDriveAccessToken({
        prompt: 'consent',
      });
      driveAuthRef.current = {
        accessToken,
        expiresAt,
        fileId: null,
      };

      const [email, remoteFile] = await Promise.all([
        fetchGoogleUserEmail(accessToken),
        findDriveSyncFile(accessToken),
      ]);

      const local = stateRef.current;
      const localCount = countStateRecords(local);

      if (remoteFile?.id) {
        driveAuthRef.current.fileId = remoteFile.id;
        const remoteState = await downloadDriveSyncFile(accessToken, remoteFile.id);
        const remoteCount = countStateRecords(remoteState);

        if (remoteState && remoteCount > 0 && localCount === 0) {
          updateState(remoteState, { skipRemoteSync: true });
          setDriveSync({
            signedIn: true,
            syncing: false,
            email,
            lastSyncAt: remoteFile.modifiedTime || new Date().toISOString(),
            error: null,
          });
          return;
        }

        if (remoteState && remoteCount > 0 && !statesHaveSamePullIds(local, remoteState)) {
          setDriveSync({
            signedIn: true,
            syncing: false,
            email,
            lastSyncAt: remoteFile.modifiedTime || null,
            error: null,
          });
          setConflict({
            remoteState,
            remoteModifiedTime: remoteFile.modifiedTime,
          });
          return;
        }
      }

      const saved = driveAuthRef.current.fileId
        ? await updateDriveSyncFile(accessToken, driveAuthRef.current.fileId, local)
        : await createDriveSyncFile(accessToken, local);
      driveAuthRef.current.fileId = saved.id;

      setDriveSync({
        signedIn: true,
        syncing: false,
        email,
        lastSyncAt: saved.modifiedTime || new Date().toISOString(),
        error: null,
      });
    } catch (err) {
      driveAuthRef.current.accessToken = null;
      setDriveSync({
        signedIn: false,
        syncing: false,
        email: '',
        lastSyncAt: null,
        error: err.message,
      });
      throw err;
    }
  }

  async function handleDriveSyncNow() {
    if (!driveAuthRef.current.accessToken) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    setDriveSync((prev) => ({ ...prev, syncing: true, error: null }));
    try {
      const token = await ensureFreshToken();
      const remoteFile = await findDriveSyncFile(token);
      if (remoteFile?.id) {
        driveAuthRef.current.fileId = remoteFile.id;
        const remoteState = await downloadDriveSyncFile(token, remoteFile.id);
        if (remoteState && !statesHaveSamePullIds(stateRef.current, remoteState)) {
          const merged = smartMergeStates(stateRef.current, remoteState);
          updateState(merged, { skipRemoteSync: true });
          await pushStateToDrive(merged);
          return;
        }
      }
      await pushStateToDrive(stateRef.current);
    } catch (err) {
      setDriveSync((prev) => ({ ...prev, syncing: false, error: err.message }));
    }
  }

  function handleDriveDisconnect() {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    const token = driveAuthRef.current.accessToken;
    if (token && window.google?.accounts?.oauth2?.revoke) {
      try {
        window.google.accounts.oauth2.revoke(token, () => {});
      } catch {
        // ignore revoke error
      }
    }
    driveAuthRef.current = {
      accessToken: null,
      expiresAt: 0,
      fileId: null,
    };
    setConflict(null);
    setDriveSync({
      signedIn: false,
      syncing: false,
      email: '',
      lastSyncAt: null,
      error: null,
    });
  }

  const activeProfile = appState?.profiles?.[appState.activeProfileId] || null;

  const analysis = useMemo(() => {
    return analyzeAccountPulls(activeProfile?.records || [], catalog);
  }, [activeProfile, catalog]);

  const unsyncedGlobalCount = useMemo(() => {
    return getUnsyncedGlobalRecords(activeProfile?.records || []).length;
  }, [activeProfile, globalSyncVersion]);

  async function runGlobalContribution(records, meta = {}) {
    setGlobalSyncStatus({ syncing: true, type: 'ok', message: '' });
    try {
      const res = await contributePullRecords(records, {
        format: meta.format || 'nte-gacha-export',
        region: activeProfile?.region || 'Global',
        source: meta.source || 'pktmon_zero_install',
      });
      setGlobalSyncVersion((v) => v + 1);
      setGlobalSyncStatus({
        syncing: false,
        type: 'ok',
        message:
          res.accepted > 0
            ? `Contributed +${res.accepted.toLocaleString()} anonymized pulls to Global Stats${
                res.duplicates > 0 ? ` (${res.duplicates.toLocaleString()} already counted)` : ''
              }.`
            : `All ${res.duplicates.toLocaleString()} pulls are already synced to Global Stats.`,
      });
    } catch (err) {
      setGlobalSyncStatus({
        syncing: false,
        type: 'err',
        message: `Global Stats sync skipped: ${err.message}`,
      });
    }
  }

  function handleCommitImport(incomingRecords, options = {}) {
    let result = { added: 0, duplicates: 0 };
    let mergedAll = [];
    updateState((prev) => {
      const pid = prev.activeProfileId;
      const prof = prev.profiles[pid];
      const merged = mergePullRecords(prof.records, incomingRecords);
      result = { added: merged.added, duplicates: merged.duplicates };
      mergedAll = merged.merged;
      return {
        ...prev,
        profiles: {
          ...prev.profiles,
          [pid]: {
            ...prof,
            updatedAt: new Date().toISOString(),
            records: merged.merged,
          },
        },
      };
    });

    if (options.contributeToGlobal) {
      // Send full merged eligible timeline so server computes exact inter-S pity
      // while deduplicating previously counted pulls cleanly.
      const toSend = mergedAll.length > 0 ? mergedAll : incomingRecords;
      runGlobalContribution(toSend, {
        format: options.format || 'nte-gacha-export',
        source: 'pktmon_zero_install',
      });
    }
    return result;
  }

  function handleSyncUnsyncedGlobal() {
    if (!activeProfile?.records?.length) return;
    runGlobalContribution(activeProfile.records, {
      format: 'unsynced_profile_sync',
      source: 'pktmon_zero_install',
    });
  }

  function handleAddProfile(name, region) {
    const id = `prof_${Date.now()}`;
    updateState((prev) => ({
      ...prev,
      activeProfileId: id,
      profiles: {
        ...prev.profiles,
        [id]: {
          id,
          name,
          region,
          uid: '',
          updatedAt: null,
          records: [],
        },
      },
    }));
  }

  function handleDeleteProfile(id) {
    updateState((prev) => {
      const keys = Object.keys(prev.profiles).filter((k) => k !== id);
      if (keys.length === 0) return prev;
      const nextProfiles = { ...prev.profiles };
      delete nextProfiles[id];
      return {
        ...prev,
        activeProfileId: prev.activeProfileId === id ? keys[0] : prev.activeProfileId,
        profiles: nextProfiles,
      };
    });
  }

  function handleClearActivePulls() {
    updateState((prev) => {
      const pid = prev.activeProfileId;
      return {
        ...prev,
        profiles: {
          ...prev.profiles,
          [pid]: {
            ...prev.profiles[pid],
            updatedAt: new Date().toISOString(),
            records: [],
          },
        },
      };
    });
  }

  if (!appState || !catalog) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        Loading NTE catalog &amp; local database...
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar
        pathname={pathname}
        profiles={appState.profiles}
        activeProfileId={appState.activeProfileId}
        onSwitchProfile={(id) =>
          updateState((prev) => ({ ...prev, activeProfileId: id }))
        }
        totalPulls={analysis.totals.pulls}
        driveSync={driveSync}
        onDriveSyncNow={handleDriveSyncNow}
        mobileOpen={mobileOpen}
        onToggleMobile={() => setMobileOpen((o) => !o)}
      />

      <main className="px-4 py-6 sm:px-6 lg:ml-64 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">
          {pathname === '/import' ? (
            <ImportPage
              existingRecords={activeProfile.records}
              catalog={catalog}
              onCommitImport={handleCommitImport}
            />
          ) : pathname === '/history' ? (
            <HistoryPage
              allRecords={analysis.allRecords}
              initialPool={poolParam}
            />
          ) : pathname === '/stats' ? (
            <GlobalStatsPage
              catalog={catalog}
              activeProfile={activeProfile}
              globalSyncVersion={globalSyncVersion}
              onGlobalSynced={() => setGlobalSyncVersion((v) => v + 1)}
            />
          ) : pathname === '/staff' ? (
            <StaffStatsPage
              activeGoogleToken={driveAuthRef.current.accessToken}
              activeGoogleEmail={driveSync.email}
            />
          ) : pathname === '/settings' ? (
            <SettingsPage
              appState={appState}
              driveSync={driveSync}
              onDriveConnect={handleDriveConnect}
              onDriveSyncNow={handleDriveSyncNow}
              onDriveDisconnect={handleDriveDisconnect}
              onAddProfile={handleAddProfile}
              onDeleteProfile={handleDeleteProfile}
              onClearActivePulls={handleClearActivePulls}
              onRestoreState={(next) => updateState(next)}
            />
          ) : (
            <DashboardPage
              analysis={analysis}
              unsyncedGlobalCount={unsyncedGlobalCount}
              globalSyncStatus={globalSyncStatus}
              onSyncUnsyncedGlobal={handleSyncUnsyncedGlobal}
            />
          )}

          <footer className="mt-12 border-t border-white/8 pt-6 pb-4 text-center text-xs text-slate-500">
            <p>
              Hethereau is an unofficial fan tool and is not affiliated with Hotta Studio or Perfect World Games.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-slate-400">
              <a href="/privacy" className="transition hover:text-cyan-300">
                Privacy Policy
              </a>
              <span aria-hidden="true" className="text-slate-600">&middot;</span>
              <a href="/terms" className="transition hover:text-cyan-300">
                Terms of Service
              </a>
              <span aria-hidden="true" className="text-slate-600">&middot;</span>
              <a
                href="https://github.com/agent306/hethereau"
                target="_blank"
                rel="noopener noreferrer"
                className="transition hover:text-cyan-300"
              >
                GitHub
              </a>
            </div>
          </footer>
        </div>
      </main>

      {conflict && (
        <SyncConflictModal
          localState={appState}
          remoteState={conflict.remoteState}
          remoteModifiedTime={conflict.remoteModifiedTime}
          onChooseMerge={async () => {
            const merged = smartMergeStates(appState, conflict.remoteState);
            setConflict(null);
            updateState(merged, { skipRemoteSync: true });
            await pushStateToDrive(merged);
          }}
          onChooseRemote={() => {
            const remote = conflict.remoteState;
            setConflict(null);
            updateState(remote, { skipRemoteSync: true });
          }}
          onChooseLocal={async () => {
            setConflict(null);
            await pushStateToDrive(appState);
          }}
          onClose={() => setConflict(null)}
        />
      )}
    </div>
  );
}
