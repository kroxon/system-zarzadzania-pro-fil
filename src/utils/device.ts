import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768; // tailwind md breakpoint

// Simple device helpers for mobile detection
// Heuristic: rely on viewport width, fall back to UA when sizing info is unavailable

export function isMobileDeviceUA(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || (typeof window !== 'undefined' ? (window as any).opera : '') || '';
  const mobileIndicators = /(Mobi|Mobile|iPhone|iPod|iPad|BlackBerry|IEMobile|Opera Mini)/i;
  if (mobileIndicators.test(ua)) return true;
  // Treat Android as mobile only when UA explicitly marks it as such (contains "Mobile")
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return true;
  return false;
}

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  const sizes: number[] = [];
  if (typeof window.innerWidth === 'number') sizes.push(window.innerWidth);
  if (typeof window.outerWidth === 'number') sizes.push(window.outerWidth);
  if (typeof document !== 'undefined') {
    const docEl = document.documentElement;
    const body = document.body;
    if (docEl?.clientWidth) sizes.push(docEl.clientWidth);
    if (body?.clientWidth) sizes.push(body.clientWidth);
  }
  const effectiveWidth = sizes.length ? Math.min(...sizes.filter(Boolean)) : 0;
  if (effectiveWidth > 0) {
    return effectiveWidth <= MOBILE_BREAKPOINT;
  }
  // As a last resort fall back to UA heuristics
  return isMobileDeviceUA();
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  const uaData = (navigator as any)?.userAgentData;
  if (uaData && typeof uaData.mobile === 'boolean') {
    // Respect the browser's explicit client hint when viewport is large enough for desktop
    if (!uaData.mobile && !isMobileViewport()) {
      return false;
    }
  }

  return isMobileViewport();
}

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState<boolean>(isMobileDevice());
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setMobile(isMobileDevice());
    update();

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    const mql = window.matchMedia ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`) : null;
    const mediaListener = (event: MediaQueryListEvent) => setMobile(event.matches);

    if (mql) {
      // Ensure initial match is respected even if resize listener didn't fire yet
      setMobile(mql.matches);
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', mediaListener);
      } else if (typeof mql.addListener === 'function') {
        mql.addListener(mediaListener);
      }
    }

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      if (mql) {
        if (typeof mql.removeEventListener === 'function') {
          mql.removeEventListener('change', mediaListener);
        } else if (typeof mql.removeListener === 'function') {
          mql.removeListener(mediaListener);
        }
      }
    };
  }, []);
  return mobile;
}
