import { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export default function Portal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null as any;
  return createPortal(children, document.body);
}
