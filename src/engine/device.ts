/**
 * Телефон: полный экран, альбомная ориентация и установка как приложение.
 * Браузеры разрешают полный экран и окно установки только в ответ на жест пользователя,
 * поэтому игра просит их на тапе, а не при загрузке страницы.
 */
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type LockableOrientation = ScreenOrientation & { lock?: (o: 'landscape') => Promise<void> };
interface InstallPromptEvent extends Event { prompt(): Promise<void> }

/** Dev-превью iPhone: ?iphone в адресе притворяется Safari на iPhone (только в npm run dev). */
function devIPhone(): boolean {
  return import.meta.env.DEV && new URLSearchParams(location.search).has('iphone');
}

export function fullscreenSupported(): boolean {
  if (devIPhone()) return false;
  const el = document.documentElement as FsElement;
  return typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function';
}

export function isFullscreen(): boolean {
  const d = document as FsDocument;
  return !!(d.fullscreenElement ?? d.webkitFullscreenElement);
}

/** Игра запущена как установленное приложение: окно и так без интерфейса браузера. */
export function isInstalledApp(): boolean {
  return matchMedia('(display-mode: fullscreen)').matches
    || matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iPhone, iPod или iPad: iPadOS представляется Mac, но с сенсорным экраном. */
export function isIOS(): boolean {
  if (devIPhone()) return true;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** На iPhone и iPad браузер не умеет предлагать установку: значок ставят вручную через «Поделиться». */
export function manualInstall(): boolean {
  return isIOS() && !isInstalledApp();
}

/** Основной указатель палец: телефон или планшет. */
export function isTouchDevice(): boolean {
  return matchMedia('(pointer: coarse)').matches;
}

/** Развернуть на весь экран и закрепить альбомную ориентацию; если браузер не даёт, играем в окне. */
export function enterFullscreen(): void {
  if (isFullscreen() || !fullscreenSupported()) return;
  const el = document.documentElement as FsElement;
  try {
    const r = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.();
    Promise.resolve(r).then(lockLandscape, () => {});
  } catch {
    // Браузер отказал: остаёмся в окне.
  }
}

export function exitFullscreen(): void {
  if (!isFullscreen()) return;
  const d = document as FsDocument;
  try {
    const r = d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen?.();
    Promise.resolve(r).catch(() => {});
  } catch {
    // Уже вышли.
  }
}

/** Работает только в полноэкранном режиме и не везде: ошибки глотаем. */
function lockLandscape(): void {
  const o = screen.orientation as LockableOrientation | undefined;
  o?.lock?.('landscape').catch(() => {});
}

let installPrompt: InstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Своя кнопка «Установить» на заставке вместо панели браузера поверх игры.
    e.preventDefault();
    installPrompt = e as InstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => { installPrompt = null; });
}

/** Браузер готов установить игру как приложение (Chrome на Android и на ПК). */
export function canInstall(): boolean {
  return installPrompt !== null;
}

export function promptInstall(): void {
  const p = installPrompt;
  if (!p) return;
  installPrompt = null;
  p.prompt().catch(() => {});
}
