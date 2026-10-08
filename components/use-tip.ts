'use client';

import { useCallback, useEffect, useId, useRef, useState, type FocusEvent, type PointerEvent as ReactPointerEvent } from 'react';

const TIP_EVENT = 'rah-tip-open';
const CLOSE_GRACE_MS = 200;
const TOUCH_FOCUS_MS = 700;

export function useTip() {
  const id = useId();
  const rootRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const touchPinned = useRef(false);
  const suppressFocus = useRef(false);
  const closeTimer = useRef<number | null>(null);
  const touchAt = useRef(0);
  const openRef = useRef(false);
  const [open, setOpen] = useState(false);

  const clearTimer = () => {
    if (closeTimer.current == null) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const setOpenState = useCallback((next: boolean) => {
    openRef.current = next;
    setOpen(next);
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    touchPinned.current = false;
    setOpenState(false);
  }, [setOpenState]);

  const show = useCallback(() => {
    clearTimer();
    if (openRef.current) return;
    document.dispatchEvent(new CustomEvent(TIP_EVENT, { detail: id }));
    setOpenState(true);
  }, [id, setOpenState]);

  const scheduleHide = useCallback(() => {
    if (touchPinned.current) return;
    if (rootRef.current?.contains(document.activeElement)) return;
    clearTimer();
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      if (touchPinned.current) return;
      if (rootRef.current?.contains(document.activeElement)) return;
      setOpenState(false);
    }, CLOSE_GRACE_MS);
  }, [setOpenState]);

  useEffect(() => {
    const onOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail === id) return;
      clearTimer();
      touchPinned.current = false;
      setOpenState(false);
    };
    document.addEventListener(TIP_EVENT, onOther);
    return () => {
      document.removeEventListener(TIP_EVENT, onOther);
      clearTimer();
    };
  }, [id, setOpenState]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      hide();
      const trigger = triggerRef.current;
      if (!trigger) return;
      suppressFocus.current = true;
      trigger.focus();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) return;
      hide();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [hide, open]);

  return {
    id,
    open,
    rootRef,
    triggerRef,
    onPointerOver: (event: ReactPointerEvent) => {
      if (event.pointerType === 'touch') return;
      clearTimer();
      show();
    },
    onPointerLeave: (event: ReactPointerEvent) => {
      if (event.pointerType === 'touch') return;
      scheduleHide();
    },
    onPointerDown: (event: ReactPointerEvent) => {
      if (event.pointerType === 'touch') touchAt.current = performance.now();
    },
    onFocus: () => {
      if (suppressFocus.current) {
        suppressFocus.current = false;
        return;
      }
      if (performance.now() - touchAt.current < TOUCH_FOCUS_MS) return;
      show();
    },
    onBlur: (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (next && rootRef.current?.contains(next)) return;
      if (touchPinned.current) return;
      hide();
    },
    onActivate: (event: { detail?: number; pointerType?: string }) => {
      const touch = event.pointerType === 'touch' || performance.now() - touchAt.current < TOUCH_FOCUS_MS;
      if (!touch || event.detail === 0) return;
      if (touchPinned.current && openRef.current) {
        hide();
        return;
      }
      touchPinned.current = true;
      show();
    },
  };
}
