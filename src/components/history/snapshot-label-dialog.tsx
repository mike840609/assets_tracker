"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { NotebookPen, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";

export type SnapshotLabelTarget = {
  id: string;
  date: string;
  label?: string | null;
  note?: string | null;
};

type Props = {
  snapshot: SnapshotLabelTarget;
  className?: string;
  trigger?: "icon" | "note";
};

export function SnapshotLabelDialog({ snapshot, className, trigger = "icon" }: Props) {
  const router = useRouter();
  const t = useTranslations("history.snapshotLabel");
  const format = useFormatter();
  const isMobile = useIsMobile();
  const labelId = useId();
  const noteId = useId();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState(() => snapshot?.label ?? "");
  const [note, setNote] = useState(() => snapshot?.note ?? "");

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setLabel(snapshot?.label ?? "");
      setNote(snapshot?.note ?? "");
    }
    setOpen(nextOpen);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!snapshot) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/snapshots/${snapshot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, note }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? t("toastFailed"));
      }

      toast.success(t("toastSaved"));
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toastFailed"));
    } finally {
      setSaving(false);
    }
  }

  const snapshotDate = format.dateTime(new Date(`${snapshot.date}T00:00:00`), {
    dateStyle: "medium",
  });
  const hasLabel = Boolean(snapshot?.label);
  const hasNote = Boolean(snapshot?.note);
  const triggerLabel =
    trigger === "note"
      ? t(hasNote ? "editNoteAction" : "addNoteAction", { date: snapshotDate })
      : t(hasLabel ? "editSnapshotAction" : "addSnapshotAction", { date: snapshotDate });

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={labelId}>{t("label")}</Label>
        <Input
          id={labelId}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("labelPlaceholder")}
          maxLength={80}
          className="min-h-11 md:min-h-8"
        />
        <p className="text-xs text-muted-foreground tabular-nums">
          {t("labelCount", { count: label.length })}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={noteId}>{t("note")}</Label>
        <Textarea
          id={noteId}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("notePlaceholder")}
          maxLength={500}
          className="min-h-24 resize-none"
        />
        <p className="text-xs text-muted-foreground tabular-nums">
          {t("noteCount", { count: note.length })}
        </p>
      </div>
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={trigger === "note" ? "sm" : "icon-sm"}
        onClick={() => handleOpenChange(true)}
        disabled={saving}
        aria-label={triggerLabel}
        title={triggerLabel}
        className={cn("text-muted-foreground hover:text-foreground", className)}
      >
        {trigger === "note" ? (
          <>
            <NotebookPen className="size-3.5" aria-hidden="true" />
            {t(hasNote ? "editNote" : "addNote")}
          </>
        ) : (
          <Tag className="size-3.5" aria-hidden="true" />
        )}
      </Button>

      {isMobile ? (
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent showCloseButton={false}>
            <DrawerHeader>
              <DrawerTitle>{t("title")}</DrawerTitle>
              <p className="text-sm text-muted-foreground">{snapshotDate}</p>
            </DrawerHeader>
            <div className="px-4 pb-4">{form}</div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
              <p className="text-sm text-muted-foreground">{snapshotDate}</p>
            </DialogHeader>
            {form}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
