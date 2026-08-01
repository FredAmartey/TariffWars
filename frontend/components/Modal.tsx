import { ReactNode, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

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
 * The header is rendered here rather than by each caller. Both callers used to
 * pass a `title` that this rendered as an sr-only DialogTitle, then draw their
 * own visible heading and their own close button with the same text: the name
 * was announced twice and the two close affordances were styled differently.
 * DialogContent already ships a close button, so callers now pass a title and
 * a body and nothing else.
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
  description,
  children,
  widthClass = "sm:max-w-md",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Optional supporting line under the title; also names the dialog's body. */
  description?: string;
  children: ReactNode;
  /**
   * Must carry the `sm:` prefix.
   *
   * DialogContent bakes in `sm:max-w-sm`. tailwind-merge only collapses classes
   * that share a group AND a modifier, so an unprefixed `max-w-4xl` does not
   * replace it: both survive, and above 640px the `sm:` rule wins. The market
   * analysis dialog asked for `max-w-4xl` (896px) and rendered at 384px, which
   * is what wrapped its tab strip onto three rows and squeezed its two content
   * columns into ten-character ribbons with a horizontal scrollbar.
   */
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
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocusTo.current?.focus();
        }}
      >
        {/* pr-8 keeps the title clear of the close button DialogContent
            absolutely positions in the same corner. */}
        <DialogHeader className="pr-8">
          <DialogTitle className="text-lg">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {/* Full-bleed, so the rule reads as the edge of the header band rather
            than a line floating inside it. */}
        <Separator className="-mx-4 w-auto" />
        {children}
      </DialogContent>
    </Dialog>
  );
};
