"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Pause, Play } from "lucide-react";

/** Shared trailing action menu for a recurring rule row (edit / pause-resume / delete). */
export function RecurringRowMenu({
  ariaLabel,
  ended,
  isActive,
  labels,
  onEdit,
  onToggle,
  onDelete,
}: {
  ariaLabel: string;
  ended: boolean;
  isActive: boolean;
  labels: { edit: string; pause: string; resume: string; delete: string };
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        className="inline-flex items-center justify-center rounded-md h-9 w-9 sm:h-7 sm:w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          {labels.edit}
        </DropdownMenuItem>
        {!ended && (
          <DropdownMenuItem onClick={onToggle}>
            {isActive ? (
              <>
                <Pause className="mr-2 h-4 w-4" />
                {labels.pause}
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                {labels.resume}
              </>
            )}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="text-destructive" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          {labels.delete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
