// Simple device helpers for mobile detection
// Heuristic: user agent OR small viewport width

export function isMobileDeviceUA(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= 768; // tailwind md breakpoint
}

export function isMobileDevice(): boolean {
  return isMobileDeviceUA() || isMobileViewport();
}

import { useEffect, useState } from 'react';

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState<boolean>(isMobileDevice());
  useEffect(() => {
    const onResize = () => setMobile(isMobileDevice());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return mobile;
}
