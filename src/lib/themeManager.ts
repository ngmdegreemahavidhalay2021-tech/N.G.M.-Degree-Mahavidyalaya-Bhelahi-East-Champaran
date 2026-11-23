import { useEffect, useState, useCallback } from 'react';
import { AppearanceMode } from '../types';

export type PortalScope = 'admin' | 'staff';

const ADMIN_THEME_STORAGE_KEY = 'ngm_erp_admin_theme_mode';
const STAFF_THEME_STORAGE_KEY = 'ngm_erp_staff_theme_mode';
const THEME_CHANGE_EVENT = 'ngm-portal-theme-changed';

export function getStorageKeyForScope(scope: PortalScope): string {
  return scope === 'staff' ? STAFF_THEME_STORAGE_KEY : ADMIN_THEME_STORAGE_KEY;
}

export function getDefaultThemeForScope(scope: PortalScope): AppearanceMode {
  return scope === 'staff' ? 'light' : 'dark';
}

export function detectPortalScopeFromUrl(): PortalScope {
  if (typeof window === 'undefined') return 'admin';
  try {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get('token') ||
      params.get('key') ||
      params.get('selectionToken') ||
      params.get('examId')
    ) {
      return 'staff';
    }
  } catch {
    // ignore URL parse error
  }
  return 'admin';
}

export function isValidAppearanceMode(val: unknown): val is AppearanceMode {
  return val === 'light' || val === 'dark' || val === 'system';
}

export function getStoredPortalThemeMode(scope: PortalScope): AppearanceMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getStorageKeyForScope(scope));
    if (isValidAppearanceMode(raw)) {
      return raw;
    }
  } catch {
    // ignore storage access errors
  }
  return null;
}

export function getPortalThemeMode(scope: PortalScope): AppearanceMode {
  return getStoredPortalThemeMode(scope) ?? getDefaultThemeForScope(scope);
}

export function resolveEffectiveTheme(mode: AppearanceMode): 'light' | 'dark' {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
}

export function applyPortalThemeToDom(scope: PortalScope, mode: AppearanceMode): 'light' | 'dark' {
  const resolved = resolveEffectiveTheme(mode);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.setAttribute('data-theme-mode', resolved);
    root.setAttribute('data-theme-preference', mode);
    root.setAttribute('data-portal-scope', scope);
    root.style.colorScheme = resolved;
  }
  return resolved;
}

export function setPortalThemeMode(scope: PortalScope, mode: AppearanceMode): 'light' | 'dark' {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(getStorageKeyForScope(scope), mode);
    } catch {
      // ignore storage errors
    }
    const resolved = applyPortalThemeToDom(scope, mode);
    window.dispatchEvent(
      new CustomEvent(THEME_CHANGE_EVENT, {
        detail: { scope, mode, resolved },
      })
    );
    return resolved;
  }
  return resolveEffectiveTheme(mode);
}

export function usePortalTheme(scope: PortalScope) {
  const [mode, setModeState] = useState<AppearanceMode>(() => getPortalThemeMode(scope));
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    resolveEffectiveTheme(getPortalThemeMode(scope))
  );

  // Ensure initial mount and scope changes sync immediately
  useEffect(() => {
    const current = getPortalThemeMode(scope);
    setModeState(current);
    setResolvedTheme(applyPortalThemeToDom(scope, current));
  }, [scope]);

  // Listen for explicit updates (same tab / cross tab) and OS prefers-color-scheme changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleCustomEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ scope: PortalScope; mode: AppearanceMode }>).detail;
      if (detail && detail.scope === scope) {
        setModeState(detail.mode);
        setResolvedTheme(applyPortalThemeToDom(scope, detail.mode));
      }
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === getStorageKeyForScope(scope)) {
        const nextMode = getPortalThemeMode(scope);
        setModeState(nextMode);
        setResolvedTheme(applyPortalThemeToDom(scope, nextMode));
      }
    };

    const mediaQuery = window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

    const handleMediaChange = () => {
      const currentMode = getPortalThemeMode(scope);
      if (currentMode === 'system') {
        setResolvedTheme(applyPortalThemeToDom(scope, 'system'));
      }
    };

    window.addEventListener(THEME_CHANGE_EVENT, handleCustomEvent);
    window.addEventListener('storage', handleStorageEvent);
    if (mediaQuery) {
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleMediaChange);
      } else if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(handleMediaChange);
      }
    }

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, handleCustomEvent);
      window.removeEventListener('storage', handleStorageEvent);
      if (mediaQuery) {
        if (typeof mediaQuery.removeEventListener === 'function') {
          mediaQuery.removeEventListener('change', handleMediaChange);
        } else if (typeof mediaQuery.removeListener === 'function') {
          mediaQuery.removeListener(handleMediaChange);
        }
      }
    };
  }, [scope]);

  const setMode = useCallback(
    (nextMode: AppearanceMode) => {
      const resolved = setPortalThemeMode(scope, nextMode);
      setModeState(nextMode);
      setResolvedTheme(resolved);
    },
    [scope]
  );

  return { mode, resolvedTheme, setMode };
}
