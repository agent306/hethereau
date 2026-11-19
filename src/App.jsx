import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import SyncConflictModal from './components/SyncConflictModal.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ImportPage from './pages/ImportPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import TimelinePage from './pages/TimelinePage.jsx';
import CharactersPage from './pages/CharactersPage.jsx';
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
  clearDriveSession,
  countStateRecords,
  createDriveSyncFile,
  downloadDriveSyncFile,
  fetchGoogleUserEmail,
  findDriveSyncFile,
  loadDriveSession,
  requestDriveAccessToken,
  saveDriveSession,
  smartMergeStates,
  statesHaveSamePullIds,
  updateDriveSyncFile,
} from './lib/googleDriveSync.js';

export default function App() {
  const { pathname, poolParam } = useLocation();
  const [catalog, setCatalog] = useState(null);
  const [appState, setAppState] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Restore saved Google Drive session immediately on load so refreshing doesn't log the user out
  const initialSavedDrive = useMemo(() => loadDriveSession(), []);
  const initialTokenValid = Boolean(
    initialSavedDrive?.accessToken &&
      Date.now() < Number(initialSavedDrive.expiresAt || 0) - 60_000
  );

  // Google Drive Sync state (debounced 5s cloud sync)
  const [driveSync, setDriveSync] = useState(() => ({
    signedIn: initialTokenValid,
    needsReconnect: Boolean(!initialTokenValid && initialSavedDrive?.email),
    syncing: false,
    email: initialSavedDrive?.email || '',
    lastSyncAt: initialSavedDrive?.lastSyncAt || null,
    error: null,
  }));
  const [conflict, setConflict] = useState(null);
  const [globalSyncVersion, setGlobalSyncVersion] = useState(0);
  const [globalSyncStatus, setGlobalSyncStatus] = useState(null);

  const driveAuthRef = useRef({
    accessToken: initialTokenValid ? initialSavedDrive.accessToken : null,
    expiresAt: initialTokenValid ? Number(initialSavedDrive.expiresAt) : 0,
    fileId: initialSavedDrive?.fileId || null,
    email: initialSavedDrive?.email || '',
  });
  const syncTimerRef = useRef(null);
  const stateRef = useRef(null);

  function persistCurrentDriveSession(lastSyncAtOverride) {
    const auth = driveAuthRef.current;
    saveDriveSession({
      accessToken: auth.accessToken,
      expiresAt: auth.expiresAt,
      fileId: auth.fileId,
      email: auth.email,
      lastSyncAt: lastSyncAtOverride ?? driveSync.lastSyncAt ?? null,
    });
  }

  useEffect(() => {
    stateRef.current = appState;
  }, [appState]);

  useEffect(() => {
    let mounted = true;
    Promise.all([loadCatalog(), loadAppState()]).then(async ([cat, state]) => {
      if (!mounted) return;
      setCatalog(cat);
      setAppState(state);

      // If we restored an active Drive session after refresh, verify & silently sync remote changes
      const auth = driveAuthRef.current;
      if (auth.accessToken && Date.now() < auth.expiresAt - 60_000) {
        try {
          const remoteFile = await findDriveSyncFile(auth.accessToken);
          if (!mounted) return;
          if (remoteFile?.id) {
            auth.fileId = remoteFile.id;
            const remoteState = await downloadDriveSyncFile(auth.accessToken, remoteFile.id);
            if (!mounted) return;
            if (remoteState && !statesHaveSamePullIds(state, remoteState)) {
              const merged = smartMergeStates(state, remoteState);
              setAppState(merged);
              saveAppState(merged);
              const saved = await updateDriveSyncFile(auth.accessToken, remoteFile.id, merged);
              const syncTs = saved?.modifiedTime || new Date().toISOString();
              saveDriveSession({
                accessToken: auth.accessToken,
                expiresAt: auth.expiresAt,
                fileId: auth.fileId,
                email: auth.email,
                lastSyncAt: syncTs,
              });
              setDriveSync((prev) => ({ ...prev, signedIn: true, lastSyncAt: syncTs, error: null }));
            } else {
              const syncTs = remoteFile.modifiedTime || auth.lastSyncAt || null;
              saveDriveSession({
                accessToken: auth.accessToken,
                expiresAt: auth.expiresAt,
                fileId: auth.fileId,
                email: auth.email,
                lastSyncAt: syncTs,
              });
              if (syncTs) {
                setDriveSync((prev) => ({ ...prev, lastSyncAt: syncTs }));
              }
            }
          }
        } catch (err) {
          if (!mounted) return;
          if (err?.message === 'AUTH_EXPIRED') {
            auth.accessToken = null;
            auth.expiresAt = 0;
            saveDriveSession({
              accessToken: null,
              expiresAt: 0,
              fileId: auth.fileId,
              email: auth.email,
              lastSyncAt: initialSavedDrive?.lastSyncAt || null,
            });
            setDriveSync((prev) => ({
              ...prev,
              signedIn: false,
              needsReconnect: Boolean(auth.email),
              error: null,
            }));
          }
        }
      }
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
    const fresh = await requestDriveAccessToken({ prompt: '', hint: auth.email || '' });
    auth.accessToken = fresh.accessToken;
    auth.expiresAt = fresh.expiresAt;
    persistCurrentDriveSession();
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
      const syncTs = res?.modifiedTime || new Date().toISOString();
      persistCurrentDriveSession(syncTs);
      setDriveSync((prev) => ({
        ...prev,
        signedIn: true,
        needsReconnect: false,
        syncing: false,
        lastSyncAt: syncTs,
        error: null,
      }));
    } catch (err) {
      if (err.message === 'AUTH_EXPIRED') {
        driveAuthRef.current.accessToken = null;
        driveAuthRef.current.expiresAt = 0;
        persistCurrentDriveSession();
        setDriveSync((prev) => ({
          ...prev,
          signedIn: false,
          needsReconnect: Boolean(prev.email),
          syncing: false,
          error: 'Google session expired — click Resume Sync to continue.',
        }));
        return;
      }
      setDriveSync((prev) => ({
        ...prev,
        syncing: false,
        error: err.message,
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

  async function handleDriveConnect({ silentFirst = false } = {}) {
    setDriveSync((prev) => ({ ...prev, syncing: true, error: null }));
    const rememberedEmail = driveAuthRef.current.email || driveSync.email || '';
    try {
      let tokenRes;
      if (silentFirst && rememberedEmail) {
        try {
          tokenRes = await requestDriveAccessToken({
            prompt: '',
            hint: rememberedEmail,
          });
        } catch {
          tokenRes = await requestDriveAccessToken({
            prompt: 'consent',
            hint: rememberedEmail,
          });
        }
      } else {
        tokenRes = await requestDriveAccessToken({
          prompt: rememberedEmail ? '' : 'consent',
          hint: rememberedEmail,
        }).catch(async () =>
          requestDriveAccessToken({ prompt: 'consent', hint: rememberedEmail })
        );
      }

      const { accessToken, expiresAt } = tokenRes;
      driveAuthRef.current = {
        accessToken,
        expiresAt,
        fileId: driveAuthRef.current.fileId || null,
        email: rememberedEmail,
      };

      const [fetchedEmail, remoteFile] = await Promise.all([
        fetchGoogleUserEmail(accessToken),
        findDriveSyncFile(accessToken),
      ]);
      const email = fetchedEmail || rememberedEmail;
      driveAuthRef.current.email = email;

      const local = stateRef.current;
      const localCount = countStateRecords(local);

      if (remoteFile?.id) {
        driveAuthRef.current.fileId = remoteFile.id;
        const remoteState = await downloadDriveSyncFile(accessToken, remoteFile.id);
        const remoteCount = countStateRecords(remoteState);

        if (remoteState && remoteCount > 0 && localCount === 0) {
          const syncTs = remoteFile.modifiedTime || new Date().toISOString();
          updateState(remoteState, { skipRemoteSync: true });
          saveDriveSession({
            accessToken,
            expiresAt,
            fileId: remoteFile.id,
            email,
            lastSyncAt: syncTs,
          });
          setDriveSync({
            signedIn: true,
            needsReconnect: false,
            syncing: false,
            email,
            lastSyncAt: syncTs,
            error: null,
          });
          return;
        }

        if (remoteState && remoteCount > 0 && !statesHaveSamePullIds(local, remoteState)) {
          const syncTs = remoteFile.modifiedTime || null;
          saveDriveSession({
            accessToken,
            expiresAt,
            fileId: remoteFile.id,
            email,
            lastSyncAt: syncTs,
          });
          setDriveSync({
            signedIn: true,
            needsReconnect: false,
            syncing: false,
            email,
            lastSyncAt: syncTs,
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
      const syncTs = saved.modifiedTime || new Date().toISOString();

      saveDriveSession({
        accessToken,
        expiresAt,
        fileId: saved.id,
        email,
        lastSyncAt: syncTs,
      });

      setDriveSync({
        signedIn: true,
        needsReconnect: false,
        syncing: false,
        email,
        lastSyncAt: syncTs,
        error: null,
      });
    } catch (err) {
      driveAuthRef.current.accessToken = null;
      setDriveSync((prev) => ({
        signedIn: false,
        needsReconnect: Boolean(rememberedEmail),
        syncing: false,
        email: rememberedEmail,
        lastSyncAt: prev.lastSyncAt,
        error: err.message,
      }));
      throw err;
    }
  }

  async function handleDriveSyncNow() {
    if (!driveAuthRef.current.accessToken) {
      if (driveSync.needsReconnect) {
        await handleDriveConnect({ silentFirst: true });
      }
      return;
    }
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
    clearDriveSession();
    driveAuthRef.current = {
      accessToken: null,
      expiresAt: 0,
      fileId: null,
      email: '',
    };
    setConflict(null);
    setDriveSync({
      signedIn: false,
      needsReconnect: false,
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

  function handleAdjustManualCharacter(charId, delta) {
    if (!charId || !delta) return;
    updateState((prev) => {
      const pid = prev.activeProfileId;
      const prof = prev.profiles[pid];
      const currentMap = { ...(prof.manualCharacters || {}) };
      const cur = Math.max(0, Number(currentMap[charId] || 0));
      const next = Math.max(0, Math.min(7, cur + delta));
      if (next === 0) {
        delete currentMap[charId];
      } else {
        currentMap[charId] = next;
      }
      return {
        ...prev,
        profiles: {
          ...prev.profiles,
          [pid]: {
            ...prof,
            updatedAt: new Date().toISOString(),
            manualCharacters: currentMap,
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
        onDriveReconnect={() => handleDriveConnect({ silentFirst: true }).catch(() => {})}
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
          ) : pathname === '/timeline' ? (
            <TimelinePage catalog={catalog} />
          ) : pathname === '/characters' ? (
            <CharactersPage
              catalog={catalog}
              allRecords={analysis.allRecords}
              manualCharacters={activeProfile?.manualCharacters || {}}
              onAdjustManualCharacter={handleAdjustManualCharacter}
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
