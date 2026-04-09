"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MessageSquarePlusIcon, Loader2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function FeedbackDialog() {
  const t = useTranslations("feedback");
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setOpen(false);
    setType("");
    setMessage("");
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("submitSuccess"));
      handleClose();
    } catch {
      toast.error(t("submitFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  const isValid = type !== "" && message.trim().length >= 10;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        aria-label={t("trigger")}
      >
        <MessageSquarePlusIcon className="h-3.5 w-3.5" />
        <span>{t("trigger")}</span>
      </button>

      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="feedback-type">{t("labelType")}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="feedback-type" className="w-full">
                  <SelectValue placeholder={t("placeholderType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUG">{t("typeBug")}</SelectItem>
                  <SelectItem value="FEATURE_REQUEST">{t("typeFeatureRequest")}</SelectItem>
                  <SelectItem value="SUGGESTION">{t("typeSuggestion")}</SelectItem>
                  <SelectItem value="OTHER">{t("typeOther")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="feedback-message">{t("labelMessage")}</Label>
              <Textarea
                id="feedback-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("placeholderMessage")}
                rows={4}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {message.length}/1000
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={submitting}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={!isValid || submitting}>
              {submitting ? (
                <><Loader2Icon className="mr-2 h-4 w-4 animate-spin" />{t("submitting")}</>
              ) : (
                t("submit")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
