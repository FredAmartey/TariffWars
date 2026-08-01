import { useEffect, useRef, ReactNode } from "react";

/**
 * A dialog with the semantics the two hand-rolled overlays were missing.
 *
 * The export and market-analysis overlays were bare divs: no dialog role, no
 * Escape, no focus moved into them and none returned on close, and no way for a
 * keyboard user to dismiss them. Focus is trapped while open so Tab cannot walk
 * behind the overlay into the page underneath.
 */
export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  isDarkMode,
  widthClass = "max-w-md",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  isDarkMode: boolean;
  widthClass?: string;
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  // Focus handling is deliberately separate from the key listener below.
  // Callers pass `onClose` as an inline arrow, so its identity changes on every
  // parent render; with both concerns in one effect, any unrelated re-render
  // (a notification, a stock refresh) would run the cleanup and pull focus back
  // to the trigger behind the still-open dialog. This effect depends only on
  // `isOpen`, so it runs on open and on close, and never in between.
  useEffect(() => {
    if (!isOpen) return;

    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    return () => {
      restoreFocusTo.current?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) {
        // Nothing to move to, so Tab must not leave the dialog either.
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      // The panel itself holds focus right after opening, and it is not in the
      // list above. Without counting that as "before the first control",
      // Shift+Tab on a freshly opened dialog matched neither branch and moved
      // focus to the page behind an aria-modal overlay.
      const atStart = active === first || active === panelRef.current;

      if (e.shiftKey && atStart) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    // Only the listener is torn down here; focus restoration belongs to the
    // effect above, which does not re-run on an `onClose` identity change.
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const titleId = `modal-title-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => {
        // Only a click that both starts and ends on the backdrop dismisses;
        // dragging a selection out of the panel should not close it.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`rounded-xl w-full ${widthClass} outline-hidden ${
          isDarkMode ? "bg-gray-800 border border-gray-700" : "bg-white shadow-xl"
        }`}
      >
        <span id={titleId} className="sr-only">
          {title}
        </span>
        {children}
      </div>
    </div>
  );
};
