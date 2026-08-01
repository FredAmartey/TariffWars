import { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * A thin wrapper over the shadcn/Radix dialog primitive.
 *
 * The export and market-analysis overlays used to be bare divs: no dialog
 * role, no Escape, no focus moved into them and none returned on close, and
 * no way for a keyboard user to dismiss them. Radix's Dialog/FocusScope
 * supplies all of that (role, aria-modal, Escape, backdrop dismiss, focus
 * trap, and focus restoration to the trigger on close) so the hand-written
 * focus trap and key handler are no longer needed here.
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
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className={widthClass} showCloseButton={false}>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
};
