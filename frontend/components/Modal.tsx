import { ReactNode, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * A thin wrapper over the shadcn/Radix dialog primitive.
 *
 * The export and market-analysis overlays used to be bare divs: no dialog
 * role, no Escape, no focus moved into them and none returned on close, and
 * no way for a keyboard user to dismiss them. Radix's Dialog/FocusScope
 * supplies role="dialog", Escape, backdrop dismiss and the focus trap for
 * free (modal mode also hides the rest of the page from assistive tech via
 * aria-hidden on its siblings, which Radix's own source notes is a better-
 * supported equivalent to aria-modal, so that attribute is intentionally
 * absent rather than missing).
 *
 * Focus-restore-on-close is the one piece Radix does NOT provide for free
 * here: it only returns focus automatically to a <Dialog.Trigger> it
 * rendered itself, and every caller of this Modal opens it from a plain
 * button living outside the <Dialog> tree (isOpen/onClose are driven by the
 * caller's own state). So this still captures whatever had focus right
 * before opening -- almost always that trigger button -- and hands it back
 * via onCloseAutoFocus. That is a much smaller piece than the old hand-
 * rolled implementation: it does not touch Tab order or Escape, both of
 * which stay entirely Radix's.
 */
export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  widthClass = "max-w-md",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  widthClass?: string;
}) => {
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      restoreFocusTo.current = document.activeElement as HTMLElement | null;
    }
  }, [isOpen]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={widthClass}
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocusTo.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
};
