// app\(main)\templates\templates-client.tsx
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  PlusIcon,
  LayoutTemplateIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
  PlayIcon,
  SearchIcon,
  XIcon,
  TagIcon,
  ChevronDownIcon,
  LayoutGridIcon,
  ListIcon,
  LinkIcon,
  CheckIcon,
  FolderIcon,
  FolderOpenIcon,
  DownloadIcon,
  FileTextIcon,
  MinusIcon,
  CheckSquareIcon,
  FolderInputIcon,
  AlignLeftIcon,
  PackageIcon,
} from "lucide-react";
import { differenceInHours, format, formatDistanceToNow } from "date-fns";
import { Doc } from "@/convex/_generated/dataModel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useEditorExitGuard } from "@/hooks/useEditorExitGuard";
import { SyncCooldownButton } from "@/components/SyncCooldownButton";

// ────────────────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────────────────

function smartDate(ts: number): string {
  if (differenceInHours(Date.now(), ts) < 24)
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  return format(new Date(ts), "MMM d, yyyy");
}

const PAGE_SIZE = 20;

/** First tag = folder, rest = labels */
function extractFolder(tags: string[] | undefined): string | null {
  return tags?.[0] ?? null;
}
function extractLabels(tags: string[] | undefined): string[] {
  return tags?.slice(1) ?? [];
}

// ────────────────────────────────────────────────────────────────────────────────
// Export helper (single template)
// ────────────────────────────────────────────────────────────────────────────────

async function handleExport(template: Doc<"templates">, fmt: "docx" | "pdf") {
  if (!template.fileUrl) {
    toast.error("No file available for this template.");
    return;
  }
  if (fmt === "docx") {
    const res = await fetch(template.fileUrl);
    if (!res.ok) {
      toast.error("Failed to fetch file.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.name}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Downloading template file");
  } else {
    const id = toast.loading("Converting to PDF");
    try {
      const res = await fetch("/api/onlyoffice-convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl: template.fileUrl,
          fileName: template.name,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${template.name}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.dismiss(id);
      toast.success("PDF downloaded");
    } catch {
      toast.dismiss(id);
      toast.error("PDF export failed. Check OnlyOffice setup.");
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// Checkbox
// ────────────────────────────────────────────────────────────────────────────────

function SelectCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className="rounded-md flex items-center justify-center shrink-0 transition-all"
      style={{
        width: 16,
        height: 16,
        background:
          checked || indeterminate ? "var(--primary)" : "var(--bg-input)",
        border: `1.5px solid ${checked || indeterminate ? "var(--primary)" : "var(--border-hover)"}`,
      }}
    >
      {indeterminate ? (
        <MinusIcon style={{ width: 9, height: 9, color: "var(--text)" }} />
      ) : checked ? (
        <CheckIcon style={{ width: 9, height: 9, color: "var(--text)" }} />
      ) : null}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Rename Dialog — modal, not inline
// ────────────────────────────────────────────────────────────────────────────────

function RenameDialog({
  id,
  currentName,
  open,
  onClose,
}: {
  id: Doc<"templates">["_id"];
  currentName: string;
  open: boolean;
  onClose: () => void;
}) {
  const updateTemplate = useMutation(api.templates.update);
  const [val, setVal] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setVal(currentName);
      const t = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 80);
      return () => clearTimeout(t);
    }
  }, [open, currentName]);

  const save = async () => {
    const trimmed = val.trim();
    if (!trimmed) return;
    if (trimmed === currentName) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await updateTemplate({ id, name: trimmed });
      toast.success("Template renamed");
      onClose();
    } catch {
      toast.error("Couldn't rename. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        style={{
          background: "var(--popover)",
          border: "1px solid var(--accent-border)",
          boxShadow: "var(--shadow-elevated)",
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "var(--text)", fontSize: 14 }}>
            Rename template
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <input
            ref={inputRef}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") onClose();
            }}
            placeholder="Template name"
            className="w-full rounded-xl px-3 py-2.5 text-[13px] outline-none"
            style={{
              background: "var(--bg-input)",
              border: `1px solid var(--accent-border)`,
              color: "var(--text)",
            }}
            onFocus={(e) =>
              (e.currentTarget.style.border = `1px solid rgba(129,140,248,0.6)`)
            }
            onBlur={(e) =>
              (e.currentTarget.style.border = `1px solid var(--accent-border)`)
            }
          />
        </div>

        <DialogFooter className="gap-2 flex-row justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[12px] font-medium transition-colors"
            style={{
              background: "var(--bg-muted)",
              color: "var(--text-muted)",
              border: `1px solid var(--border-subtle)`,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--bg-input)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "var(--bg-muted)")
            }
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!val.trim() || saving}
            className="px-4 py-2 rounded-xl text-[12px] font-medium transition-all"
            style={{
              background:
                val.trim() && !saving
                  ? "var(--accent-bg)"
                  : "rgba(99,102,241,0.05)",
              color:
                val.trim() && !saving
                  ? "var(--accent-pale)"
                  : "var(--text-dim)",
              border: `1px solid ${val.trim() && !saving ? "var(--accent-border)" : "transparent"}`,
              opacity: saving ? 0.7 : 1,
              cursor: !val.trim() || saving ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (val.trim() && !saving)
                e.currentTarget.style.background = "var(--accent-bg-hover)";
            }}
            onMouseLeave={(e) => {
              if (val.trim() && !saving)
                e.currentTarget.style.background = "var(--accent-bg)";
            }}
          >
            {saving ? "Saving" : "Rename"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InlineDescriptionEdit({
  id,
  currentDescription,
  onDone,
}: {
  id: Doc<"templates">["_id"];
  currentDescription: string;
  onDone: () => void;
}) {
  const updateTemplate = useMutation(api.templates.update);
  const [val, setVal] = useState(currentDescription);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const len = val.length;
    ref.current?.setSelectionRange(len, len);
  }, []);

  const save = async () => {
    const trimmed = val.trim();
    if (trimmed === (currentDescription ?? "").trim()) {
      onDone();
      return;
    }
    try {
      await updateTemplate({ id, description: trimmed || undefined });
      toast.success("Description updated");
    } catch {
      toast.error("Couldn't update description.");
    }
    onDone();
  };

  return (
    <textarea
      ref={ref}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") onDone();
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
      }}
      onBlur={save}
      rows={3}
      placeholder="Add a description"
      className="w-full rounded-lg px-2 py-1.5 text-[11px] outline-none resize-none leading-relaxed"
      style={{
        background: "var(--bg-input)",
        border: `1px solid var(--accent-border)`,
        color: "var(--text)",
      }}
    />
  );
}

function FolderAndLabelEditor({
  id,
  currentTags,
  allExistingFolders,
  onDone,
}: {
  id: Doc<"templates">["_id"];
  currentTags: string[];
  allExistingFolders: string[];
  onDone: () => void;
}) {
  const updateTemplate = useMutation(api.templates.update);

  const [folderInput, setFolderInput] = useState(currentTags[0] ?? "");
  const [labels, setLabels] = useState<string[]>(currentTags.slice(1));
  const [labelInput, setLabelInput] = useState("");
  const [showFolderSuggestions, setShowFolderSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);

  const folderSuggestions = allExistingFolders.filter(
    (f) =>
      f.toLowerCase().includes(folderInput.toLowerCase()) && f !== folderInput
  );

  const addLabel = (raw: string) => {
    const newLabels = raw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(
        (t) => t && !labels.includes(t) && t !== folderInput.toLowerCase()
      );
    if (newLabels.length) setLabels((p) => [...p, ...newLabels]);
  };

  const removeLabel = (label: string) =>
    setLabels((p) => p.filter((t) => t !== label));

  const save = async () => {
    if (labelInput.trim()) addLabel(labelInput);
    const cleanFolder = folderInput.trim().toLowerCase();
    const allTags = [cleanFolder, ...labels].filter(Boolean);
    setSaving(true);
    try {
      await updateTemplate({ id, tags: allTags });
      toast.success("Saved");
      onDone();
    } catch {
      toast.error("Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="rounded-xl p-3 space-y-3"
      style={{
        background: "var(--popover-surface)",
        border: `1px solid var(--accent-border)`,
        boxShadow: "var(--shadow-flyout)",
      }}
    >
      {/* Folder */}
      <div className="space-y-1.5">
        <label
          className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest"
          style={{ color: "var(--text-dim)" }}
        >
          <FolderIcon className="w-2.5 h-2.5" />
          Folder
          <span
            style={{
              color: "var(--text-dim)",
              fontWeight: 400,
              textTransform: "none",
              letterSpacing: 0,
            }}
          >
            — one home for this template
          </span>
        </label>
        <div className="relative">
          <input
            value={folderInput}
            onChange={(e) => {
              setFolderInput(e.target.value);
              setShowFolderSuggestions(true);
            }}
            onFocus={(e) => {
              setShowFolderSuggestions(true);
              e.currentTarget.style.border = `1px solid var(--accent-border)`;
            }}
            onBlur={(e) => {
              setTimeout(() => setShowFolderSuggestions(false), 160);
              e.currentTarget.style.border = `1px solid var(--border-subtle)`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setShowFolderSuggestions(false);
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === "Escape") onDone();
            }}
            placeholder="Type or select a folder"
            className="w-full rounded-lg px-2.5 py-1.5 text-[11px] outline-none"
            style={{
              background: "var(--bg-muted)",
              border: `1px solid var(--border-subtle)`,
              color: "var(--text)",
            }}
          />
          {showFolderSuggestions && folderSuggestions.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1 rounded-lg overflow-hidden z-20"
              style={{
                background: "var(--popover-surface)",
                border: `1px solid var(--border-subtle)`,
                boxShadow: "var(--shadow-flyout)",
              }}
            >
              {folderSuggestions.map((f) => (
                <button
                  key={f}
                  onMouseDown={() => {
                    setFolderInput(f);
                    setShowFolderSuggestions(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(99,102,241,0.1)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <FolderIcon
                    className="w-3 h-3"
                    style={{ color: "var(--accent-light)" }}
                  />
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Labels */}
      <div className="space-y-1.5">
        <label
          className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest"
          style={{ color: "var(--text-dim)" }}
        >
          <TagIcon className="w-2.5 h-2.5" />
          Labels
          <span
            style={{
              color: "var(--text-dim)",
              fontWeight: 400,
              textTransform: "none",
              letterSpacing: 0,
            }}
          >
            — for filtering &amp; search
          </span>
        </label>
        <div
          className="flex flex-wrap gap-1 min-h-[32px] rounded-lg px-2 py-1.5 cursor-text"
          style={{
            background: "var(--bg-muted)",
            border: `1px solid var(--border-subtle)`,
          }}
          onClick={() => document.getElementById(`label-input-${id}`)?.focus()}
        >
          {labels.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium"
              style={{
                background: "rgba(129,140,248,0.15)",
                color: "var(--accent-light)",
                border: "1px solid rgba(129,140,248,0.25)",
              }}
            >
              {label}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeLabel(label);
                }}
                className="hover:opacity-60 transition-opacity"
              >
                <XIcon className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          <input
            id={`label-input-${id}`}
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                if (labelInput.trim()) {
                  addLabel(labelInput);
                  setLabelInput("");
                }
              }
              if (e.key === "Backspace" && !labelInput && labels.length)
                removeLabel(labels[labels.length - 1]);
              if (e.key === "Escape") onDone();
            }}
            placeholder={labels.length === 0 ? "Add labels" : ""}
            className="flex-1 min-w-[80px] text-[11px] bg-transparent outline-none"
            style={{ color: "var(--text)" }}
          />
        </div>
        <p className="text-[9px]" style={{ color: "var(--text-dim)" }}>
          Press Enter or comma to add · Backspace to remove last
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-0.5">
        <button
          onClick={onDone}
          className="flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
          style={{
            background: "var(--bg-muted)",
            color: "var(--text-muted)",
            border: `1px solid var(--border-subtle)`,
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--bg-input)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "var(--bg-muted)")
          }
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all"
          style={{
            background: "var(--accent-bg)",
            color: "var(--accent-pale)",
            border: `1px solid var(--accent-border)`,
            opacity: saving ? 0.7 : 1,
          }}
          onMouseEnter={(e) => {
            if (!saving)
              e.currentTarget.style.background = "var(--accent-bg-hover)";
          }}
          onMouseLeave={(e) => {
            if (!saving) e.currentTarget.style.background = "var(--accent-bg)";
          }}
        >
          {saving ? "Saving" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Template actions menu
// ────────────────────────────────────────────────────────────────────────────────

function TemplateMenu({
  template,
  onDelete,
  onRename,
  onEditFolderLabels,
  onEditFields,
}: {
  template: Doc<"templates">;
  onDelete: () => void;
  onRename: () => void;
  onEditFolderLabels: () => void;
  onEditFields: () => void;
}) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors"
          style={{
            background: "var(--bg-input)",
            border: `1px solid var(--border-subtle)`,
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--bg-input)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "var(--bg-input)")
          }
        >
          <MoreHorizontalIcon
            className="w-3.5 h-3.5"
            style={{ color: "var(--text-muted)" }}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/templates/${template._id}/fill`);
          }}
        >
          <PlayIcon className="w-3.5 h-3.5 mr-2" /> Use template
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onRename();
          }}
        >
          <PencilIcon className="w-3.5 h-3.5 mr-2" /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onEditFields();
          }}
        >
          <LayoutTemplateIcon className="w-3.5 h-3.5 mr-2" /> Edit fields
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onEditFolderLabels();
          }}
        >
          <FolderIcon className="w-3.5 h-3.5 mr-2" /> Edit folder &amp; labels
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/templates/${template._id}/connect`);
          }}
        >
          <LinkIcon className="w-3.5 h-3.5 mr-2" /> Connect form
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            handleExport(template, "docx");
          }}
        >
          <DownloadIcon className="w-3.5 h-3.5 mr-2" /> Export as .docx
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            handleExport(template, "pdf");
          }}
        >
          <FileTextIcon className="w-3.5 h-3.5 mr-2" /> Export as PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2Icon className="w-3.5 h-3.5 mr-2 text-destructive" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Folder + Label badges — visual display (not editing)
// ────────────────────────────────────────────────────────────────────────────────

function FolderLabelBadges({
  tags,
  onEditClick,
  compact = false,
}: {
  tags: string[];
  onEditClick: () => void;
  compact?: boolean;
}) {
  const folder = extractFolder(tags);
  const labels = extractLabels(tags);
  const visibleLabels = compact ? labels.slice(0, 2) : labels;
  const overflow = compact ? labels.length - 2 : 0;

  return (
    <div
      className="flex flex-wrap gap-1 items-center"
      onClick={(e) => e.stopPropagation()}
    >
      {folder && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-px rounded-md text-[10px] font-medium"
          style={{
            background: "rgba(99,102,241,0.12)",
            color: "var(--accent-light)",
            border: "1px solid rgba(99,102,241,0.22)",
          }}
        >
          <FolderIcon className="w-2.5 h-2.5" />
          {folder}
        </span>
      )}
      {visibleLabels.map((label) => (
        <span
          key={label}
          className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-md text-[10px] font-medium"
          style={{
            background: "rgba(52,211,153,0.08)",
            color: "var(--success)",
            border: "1px solid rgba(52,211,153,0.18)",
          }}
        >
          <TagIcon className="w-2 h-2" />
          {label}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="text-[10px] px-1.5 py-px rounded-md"
          style={{
            background: "var(--bg-muted)",
            color: "var(--text-muted)",
            border: `1px solid var(--border-subtle)`,
          }}
        >
          +{overflow}
        </span>
      )}
      {tags.length === 0 && (
        <button
          onClick={onEditClick}
          className="text-[10px] px-1.5 py-px rounded-md font-medium transition-colors"
          style={{
            background: "var(--bg-muted)",
            color: "var(--text-muted)",
            border: `1px solid var(--border-subtle)`,
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--bg-input)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "var(--bg-muted)")
          }
        >
          + folder / label
        </button>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Grid card
// ────────────────────────────────────────────────────────────────────────────────

function TemplateGridCard({
  template,
  onDelete,
  selected,
  selectMode,
  onSelect,
  allExistingFolders,
  canEnterEditor,
  getCooldownMs,
}: {
  template: Doc<"templates">;
  onDelete: () => void;
  selected: boolean;
  selectMode: boolean;
  onSelect: (shift: boolean) => void;
  allExistingFolders: string[];
  canEnterEditor: () => boolean;
  getCooldownMs: () => number;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [editingFolderLabels, setEditingFolderLabels] = useState(false);
  const tags = template.tags ?? [];

  const handleEditFields = () => {
    const remaining = getCooldownMs();
    if (remaining > 0) {
      toast.info(
        `Template is syncing to storage. Please wait ${Math.ceil(remaining / 1000)}s…`
      );
      return;
    }
    router.push(`/templates/${template._id}/edit`);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (editingDesc || editingFolderLabels || renameOpen) return;
    if (selectMode) {
      onSelect(e.shiftKey);
      return;
    }
    router.push(`/templates/${template._id}/fill`);
  };

  return (
    <>
      <div
        className="rounded-2xl flex flex-col overflow-hidden transition-all duration-200 h-full cursor-pointer"
        style={{
          background: selected
            ? "var(--accent-bg)"
            : hovered
              ? "var(--bg-card)"
              : "var(--bg-card)",
          border: `1px solid ${
            selected
              ? "var(--accent-border)"
              : hovered
                ? "var(--border-hover)"
                : "var(--border-subtle)"
          }`,
          boxShadow: selected
            ? "0 0 0 1px var(--accent-border)"
            : hovered
              ? "0 2px 8px rgba(15, 23, 42, 0.05)"
              : "none",
          transform: "none",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleClick}
      >
        <div className="flex flex-col gap-3 p-3.5 flex-1">
          {/* Header */}
          <div className="flex items-start gap-2.5">
            {selectMode && (
              <div
                className="mt-0.5 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(e.shiftKey);
                }}
              >
                <SelectCheckbox
                  checked={selected}
                  onChange={() => onSelect(false)}
                />
              </div>
            )}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(99,102,241,0.25)",
              }}
            >
              <LayoutTemplateIcon
                className="w-4 h-4"
                style={{ color: "var(--accent-light)" }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-[13px] font-semibold leading-snug line-clamp-2"
                style={{ color: "var(--text)" }}
              >
                {template.name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {template.fields.length} field
                  {template.fields.length !== 1 ? "s" : ""}
                </span>
                <span style={{ color: "var(--text-dim)" }}>·</span>
                <span
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {smartDate(template._creationTime)}
                </span>
              </div>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <TemplateMenu
                template={template}
                onDelete={onDelete}
                onRename={() => setRenameOpen(true)}
                onEditFolderLabels={() => setEditingFolderLabels(true)}
                onEditFields={handleEditFields}
              />
            </div>
          </div>

          {/* Description — click to edit */}
          <div
            className="flex-1 min-h-[28px]"
            onClick={(e) => {
              e.stopPropagation();
              if (!selectMode) setEditingDesc(true);
            }}
          >
            {editingDesc ? (
              <InlineDescriptionEdit
                id={template._id}
                currentDescription={template.description ?? ""}
                onDone={() => setEditingDesc(false)}
              />
            ) : (
              <div className="group flex items-start gap-1.5">
                <p
                  className="text-[11px] leading-relaxed line-clamp-2 flex-1"
                  style={{
                    color: template.description
                      ? "var(--text-secondary)"
                      : "var(--text-muted)",
                    fontStyle: template.description ? "normal" : "italic",
                  }}
                >
                  {template.description || "Click to add description"}
                </p>
                {template.description && !selectMode && (
                  <AlignLeftIcon
                    className="w-3 h-3 shrink-0 mt-0.5 opacity-0 group-hover:opacity-40 transition-opacity"
                    style={{ color: "var(--text-dim)" }}
                  />
                )}
              </div>
            )}
          </div>

          {/* Folder + Label editor or display */}
          {editingFolderLabels ? (
            <FolderAndLabelEditor
              id={template._id}
              currentTags={tags}
              allExistingFolders={allExistingFolders}
              onDone={() => setEditingFolderLabels(false)}
            />
          ) : (
            <FolderLabelBadges
              tags={tags}
              compact
              onEditClick={() => setEditingFolderLabels(true)}
            />
          )}

          {/* Action buttons */}
          {!selectMode && (
            <div className="flex gap-2 pt-0.5">
              <div className="flex-1" onClick={(e) => e.stopPropagation()}>
                <SyncCooldownButton
                  onClick={handleEditFields}
                  remainingMs={getCooldownMs()}
                  isOnCooldown={!canEnterEditor()}
                  label="Edit"
                  icon="edit"
                />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/templates/${template._id}/fill`);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-medium transition-all"
                style={{
                  background: "var(--accent-bg)",
                  color: "var(--accent-pale)",
                  border: "1px solid var(--accent-border)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--accent-bg-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "var(--accent-bg)")
                }
              >
                <PlayIcon className="w-3 h-3" /> Use
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/templates/${template._id}/connect`);
                }}
                className="flex items-center justify-center py-1.5 px-2.5 rounded-xl text-[11px] font-medium transition-all"
                style={{
                  background: "rgba(52,211,153,0.07)",
                  color: "var(--success)",
                  border: "1px solid rgba(52,211,153,0.15)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(52,211,153,0.14)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "rgba(52,211,153,0.07)")
                }
              >
                <LinkIcon className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Rename dialog rendered outside the card to avoid clipping */}
      <RenameDialog
        id={template._id}
        currentName={template.name}
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
      />
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// List row
// ────────────────────────────────────────────────────────────────────────────────

function TemplateListRow({
  template,
  onDelete,
  selected,
  selectMode,
  onSelect,
  allExistingFolders,
  canEnterEditor,
  getCooldownMs,
}: {
  template: Doc<"templates">;
  onDelete: () => void;
  selected: boolean;
  selectMode: boolean;
  onSelect: (shift: boolean) => void;
  allExistingFolders: string[];
  canEnterEditor: () => boolean;
  getCooldownMs: () => number;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [editingFolderLabels, setEditingFolderLabels] = useState(false);
  const tags = template.tags ?? [];

  const handleEditFields = () => {
    const remaining = getCooldownMs();
    if (remaining > 0) {
      toast.info(
        `Template is syncing to storage. Please wait ${Math.ceil(remaining / 1000)}s…`
      );
      return;
    }
    router.push(`/templates/${template._id}/edit`);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (editingFolderLabels || renameOpen) return;
    if (selectMode) {
      onSelect(e.shiftKey);
      return;
    }
    router.push(`/templates/${template._id}/fill`);
  };

  return (
    <>
      <div
        className="flex items-start gap-3 px-4 sm:px-5 py-3 cursor-pointer transition-all duration-150"
        style={{
          borderBottom: `1px solid var(--border-subtle)`,
          background: selected
            ? "var(--accent-bg)"
            : hovered
              ? "var(--bg-muted)"
              : "transparent",
        }}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {selectMode && (
          <div
            className="mt-1 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(e.shiftKey);
            }}
          >
            <SelectCheckbox
              checked={selected}
              onChange={() => onSelect(false)}
            />
          </div>
        )}

        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{
            background: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(99,102,241,0.2)",
          }}
        >
          <LayoutTemplateIcon
            className="w-3.5 h-3.5"
            style={{ color: "var(--accent-light)" }}
          />
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <p
            className="text-[13px] font-semibold"
            style={{ color: "var(--text)" }}
          >
            {template.name}
          </p>
          {template.description && (
            <p
              className="text-[11px] line-clamp-1"
              style={{ color: "var(--text-muted)" }}
            >
              {template.description}
            </p>
          )}
          <div className="flex items-center gap-2">
            <span
              className="text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              {template.fields.length} field
              {template.fields.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Folder / Labels */}
          {editingFolderLabels ? (
            <div onClick={(e) => e.stopPropagation()}>
              <FolderAndLabelEditor
                id={template._id}
                currentTags={tags}
                allExistingFolders={allExistingFolders}
                onDone={() => setEditingFolderLabels(false)}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <FolderLabelBadges
                tags={tags}
                compact
                onEditClick={() => setEditingFolderLabels(true)}
              />
              {tags.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingFolderLabels(true);
                  }}
                  className="text-[10px] px-1.5 py-px rounded-md transition-colors"
                  style={{
                    background: "var(--bg-muted)",
                    color: "var(--text-dim)",
                    border: `1px solid var(--border-subtle)`,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg-input)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "var(--bg-muted)")
                  }
                >
                  ✏
                </button>
              )}
            </div>
          )}
        </div>

        <span
          className="hidden sm:block text-[11px] tabular-nums shrink-0 mt-0.5"
          style={{ color: "var(--text-dim)" }}
        >
          {smartDate(template._creationTime)}
        </span>

        <div
          className="flex items-center gap-1 shrink-0 mt-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {!selectMode && (
            <button
              onClick={() => router.push(`/templates/${template._id}/fill`)}
              className="hidden sm:flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors"
              style={{
                background: "var(--accent-bg)",
                color: "var(--accent-light)",
                border: "1px solid var(--accent-border)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--accent-bg-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "var(--accent-bg)")
              }
            >
              <PlayIcon className="w-3 h-3" /> Use
            </button>
          )}
          <TemplateMenu
            template={template}
            onDelete={onDelete}
            onRename={() => setRenameOpen(true)}
            onEditFolderLabels={() => setEditingFolderLabels(true)}
            onEditFields={handleEditFields}
          />
        </div>
      </div>

      <RenameDialog
        id={template._id}
        currentName={template.name}
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
      />
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Bulk action floating bar
// ────────────────────────────────────────────────────────────────────────────────

function BulkBar({
  count,
  total,
  onDelete,
  onClear,
  onSelectAll,
  onMoveToFolder,
  onExportZip,
  allFolders,
}: {
  count: number;
  total: number;
  onDelete: () => void;
  onClear: () => void;
  onSelectAll: () => void;
  onMoveToFolder: (folder: string) => void;
  onExportZip: (fmt: "docx" | "pdf") => void;
  allFolders: string[];
}) {
  return (
    <div
      className="fixed bottom-[calc(52px+env(safe-area-inset-bottom)+10px)] md:bottom-8 left-1/2 z-50 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-2xl overflow-x-auto"
      style={{
        transform: "translateX(-50%)",
        maxWidth: "calc(100vw - 2rem)",
        scrollbarWidth: "none",
        background: "var(--bg-card)",
        border: "1px solid rgba(99,102,241,0.3)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)",
        backdropFilter: "blur(16px)",
        whiteSpace: "nowrap",
      }}
    >
      <span
        className="text-[12px] font-semibold tabular-nums"
        style={{ color: "var(--accent-pale)" }}
      >
        {count} selected
      </span>
      {count < total && (
        <button
          onClick={onSelectAll}
          className="text-[11px] font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          Select all {total}
        </button>
      )}
      <div
        className="w-px h-4 mx-0.5"
        style={{ background: "var(--bg-input)" }}
      />

      {/* Move to folder */}
      {allFolders.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-xl transition-all"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-secondary)",
              }}
            >
              <FolderInputIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Move to folder</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" className="w-44 mb-1">
            {allFolders.map((f) => (
              <DropdownMenuItem key={f} onClick={() => onMoveToFolder(f)}>
                <FolderIcon className="w-3.5 h-3.5 mr-2" /> {f}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Export ZIP */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-xl transition-all"
            style={{
              background: "rgba(52,211,153,0.08)",
              color: "var(--success, #34d399)",
              border: "1px solid rgba(52,211,153,0.2)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(52,211,153,0.14)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(52,211,153,0.08)")
            }
          >
            <PackageIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export ZIP</span>
            <ChevronDownIcon className="w-3 h-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top" className="w-44 mb-1">
          <DropdownMenuItem onClick={() => onExportZip("docx")}>
            <DownloadIcon className="w-3.5 h-3.5 mr-2" />
            ZIP of .docx files
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExportZip("pdf")}>
            <FileTextIcon className="w-3.5 h-3.5 mr-2" />
            ZIP of PDF files
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-xl transition-all"
        style={{
          background: "rgba(248,113,113,0.08)",
          color: "var(--danger)",
          border: "1px solid rgba(248,113,113,0.2)",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "rgba(248,113,113,0.14)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.background = "rgba(248,113,113,0.08)")
        }
      >
        <Trash2Icon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Delete</span>
      </button>

      <button
        onClick={onClear}
        className="w-6 h-6 rounded-lg flex items-center justify-center ml-0.5"
        style={{
          background: "var(--bg-input)",
          color: "var(--text-muted)",
        }}
      >
        <XIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Folder panel
// ────────────────────────────────────────────────────────────────────────────────

function FolderPanel({
  open,
  onClose,
  folders,
  folderCounts,
  activeFolder,
  onSelectFolder,
}: {
  open: boolean;
  onClose: () => void;
  folders: string[];
  folderCounts: Record<string, number>;
  activeFolder: string | null;
  onSelectFolder: (f: string | null) => void;
}) {
  const inner = (
    <>
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: `1px solid var(--border-subtle)` }}
      >
        <div className="flex items-center gap-2">
          <FolderIcon
            className="w-3.5 h-3.5"
            style={{ color: "var(--accent-light)" }}
          />
          <span
            className="text-[13px] font-semibold"
            style={{ color: "var(--text-secondary)" }}
          >
            Folders
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-md"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-dim)",
            }}
          >
            {folders.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{
            color: "var(--text-dim)",
            background: "var(--bg-muted)",
          }}
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-2 mb-1">
          <button
            onClick={() => onSelectFolder(null)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
            style={{
              background:
                activeFolder === null ? "var(--accent-bg)" : "transparent",
              border: `1px solid ${activeFolder === null ? "var(--accent-border)" : "transparent"}`,
              minHeight: 44,
            }}
          >
            <LayoutTemplateIcon
              className="w-3.5 h-3.5 shrink-0"
              style={{
                color:
                  activeFolder === null
                    ? "var(--accent-light)"
                    : "var(--text-dim)",
              }}
            />
            <span
              className="flex-1 text-[12px] font-medium"
              style={{
                color:
                  activeFolder === null
                    ? "var(--accent-light)"
                    : "var(--text-secondary)",
              }}
            >
              All templates
            </span>
          </button>
        </div>

        {folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <FolderIcon
              className="w-7 h-7 mb-2"
              style={{ color: "var(--text-dim)" }}
            />
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              No folders yet
            </p>
            <p
              className="text-[11px] mt-1 leading-relaxed"
              style={{ color: "var(--text-dim)" }}
            >
              Assign a folder to any template via ✏ or the ⋯ menu.
            </p>
          </div>
        ) : (
          <div className="space-y-0.5 px-2">
            {folders.map((folder) => {
              const isActive = activeFolder === folder;
              return (
                <button
                  key={folder}
                  onClick={() => onSelectFolder(isActive ? null : folder)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{
                    background: isActive
                      ? "rgba(99,102,241,0.12)"
                      : "transparent",
                    border: `1px solid ${isActive ? "rgba(99,102,241,0.28)" : "transparent"}`,
                    minHeight: 44,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      e.currentTarget.style.background = "var(--bg-muted)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  {isActive ? (
                    <FolderOpenIcon
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: "var(--accent-light)" }}
                    />
                  ) : (
                    <FolderIcon
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: "var(--text-dim)" }}
                    />
                  )}
                  <span
                    className="flex-1 text-[12px] font-medium truncate"
                    style={{
                      color: isActive
                        ? "var(--accent-light)"
                        : "var(--text-secondary)",
                    }}
                  >
                    {folder}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-md shrink-0"
                    style={{
                      background: "var(--bg-input)",
                      color: "var(--text-dim)",
                    }}
                  >
                    {folderCounts[folder] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div
        className="px-4 py-3 shrink-0"
        style={{ borderTop: `1px solid var(--border-subtle)` }}
      >
        <p
          className="text-[10px] leading-relaxed"
          style={{ color: "var(--text-dim)" }}
        >
          A template belongs to one folder (shown with 📁). Labels (shown in
          green) are for filtering only.
        </p>
      </div>
    </>
  );

  return (
    <>
      <div
        className="hidden md:flex shrink-0 flex-col transition-all duration-200 overflow-hidden"
        style={{
          width: open ? 252 : 0,
          borderLeft: open ? `1px solid var(--border-subtle)` : "none",
          background: "var(--bg-sidebar)",
        }}
      >
        {open && inner}
      </div>
      <div
        className="md:hidden fixed inset-0 z-[60] transition-opacity duration-300"
        style={{
          background: "var(--overlay-backdrop)",
          backdropFilter: "blur(4px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={onClose}
      />
      <div
        className="md:hidden fixed inset-x-0 bottom-0 z-[70] rounded-t-3xl flex flex-col"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-hover)",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.35s cubic-bezier(0.32,0.72,0,1)",
          maxHeight: "75vh",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div
            className="w-9 h-1 rounded-full"
            style={{ background: "var(--bg-input)" }}
          />
        </div>
        {inner}
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Pagination
// ────────────────────────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pages = useMemo(() => {
    const arr: (number | "")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) arr.push(i);
      return arr;
    }
    if (page <= 4) arr.push(1, 2, 3, 4, 5, "", totalPages);
    else if (page >= totalPages - 3)
      arr.push(
        1,
        "",
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages
      );
    else arr.push(1, "", page - 1, page, page + 1, "", totalPages);
    return arr;
  }, [page, totalPages]);
  if (totalPages <= 1) return null;
  return (
    <div
      className="flex items-center justify-between px-4 sm:px-6 py-3 shrink-0"
      style={{ borderTop: `1px solid var(--border-subtle)` }}
    >
      <span
        className="text-[11px] tabular-nums"
        style={{ color: "var(--text-dim)" }}
      >
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="h-7 px-2.5 rounded-lg text-[11px] font-medium"
          style={{
            background: "var(--bg-muted)",
            color: page === 1 ? "var(--text-dim)" : "var(--text-muted)",
            border: `1px solid var(--border-subtle)`,
            opacity: page === 1 ? 0.4 : 1,
          }}
        >
          ←
        </button>
        {pages.map((p, i) =>
          p === "" ? (
            <span
              key={`e${i}`}
              className="text-[11px] px-1"
              style={{ color: "var(--text-dim)" }}
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className="h-7 min-w-[28px] px-2 rounded-lg text-[11px] font-medium transition-all"
              style={{
                background:
                  p === page ? "rgba(99,102,241,0.2)" : "var(--bg-muted)",
                color: p === page ? "var(--accent-light)" : "var(--text-muted)",
                border: `1px solid ${p === page ? "rgba(99,102,241,0.3)" : "var(--border-subtle)"}`,
              }}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="h-7 px-2.5 rounded-lg text-[11px] font-medium"
          style={{
            background: "var(--bg-muted)",
            color:
              page === totalPages ? "var(--text-dim)" : "var(--text-muted)",
            border: `1px solid var(--border-subtle)`,
            opacity: page === totalPages ? 0.4 : 1,
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Skeletons
// ────────────────────────────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden animate-pulse"
      style={{
        background: "rgba(99,102,241,0.03)",
        border: "1px solid rgba(99,102,241,0.1)",
      }}
    >
      <div
        className="h-0.5 w-full"
        style={{ background: "rgba(99,102,241,0.25)" }}
      />
      <div className="p-3.5 space-y-3">
        <div className="flex items-start gap-2.5">
          <div
            className="w-9 h-9 rounded-xl shrink-0"
            style={{ background: "rgba(99,102,241,0.12)" }}
          />
          <div className="flex-1 space-y-1.5">
            <div
              className="h-3.5 rounded w-3/4"
              style={{ background: "var(--bg-input)" }}
            />
            <div
              className="h-2.5 rounded w-1/3"
              style={{ background: "var(--bg-muted)" }}
            />
          </div>
          <div
            className="w-7 h-7 rounded-lg shrink-0"
            style={{ background: "var(--bg-muted)" }}
          />
        </div>
        <div
          className="h-2.5 rounded w-full"
          style={{ background: "var(--bg-muted)" }}
        />
        <div className="flex gap-1">
          <div
            className="h-4 rounded-md w-20"
            style={{ background: "rgba(99,102,241,0.1)" }}
          />
          <div
            className="h-4 rounded-md w-14"
            style={{ background: "rgba(52,211,153,0.08)" }}
          />
        </div>
        <div className="flex gap-2">
          <div
            className="h-7 rounded-xl flex-1"
            style={{ background: "var(--bg-muted)" }}
          />
          <div
            className="h-7 rounded-xl flex-1"
            style={{ background: "rgba(99,102,241,0.08)" }}
          />
          <div
            className="h-7 rounded-xl w-10"
            style={{ background: "rgba(52,211,153,0.06)" }}
          />
        </div>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div
      className="flex items-start gap-3 px-4 sm:px-5 py-3 animate-pulse"
      style={{ borderBottom: `1px solid var(--border-subtle)` }}
    >
      <div
        className="w-8 h-8 rounded-lg shrink-0 mt-0.5"
        style={{ background: "rgba(99,102,241,0.12)" }}
      />
      <div className="flex-1 space-y-1.5">
        <div
          className="h-3.5 rounded w-1/2"
          style={{ background: "var(--bg-input)" }}
        />
        <div
          className="h-2.5 rounded w-3/4"
          style={{ background: "var(--bg-muted)" }}
        />
        <div className="flex gap-1">
          <div
            className="h-4 rounded-md w-20"
            style={{ background: "rgba(99,102,241,0.1)" }}
          />
          <div
            className="h-4 rounded-md w-14"
            style={{ background: "rgba(52,211,153,0.08)" }}
          />
        </div>
      </div>
      <div
        className="w-7 h-7 rounded-lg shrink-0"
        style={{ background: "var(--bg-muted)" }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────────

type SortKey = "newest" | "oldest" | "name_asc" | "name_desc" | "most_fields";
type ViewMode = "grid" | "list";

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest",
  oldest: "Oldest",
  name_asc: "A → Z",
  name_desc: "Z → A",
  most_fields: "Most fields",
};

export default function TemplatesPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const templates = useQuery(
    api.templates.getAll,
    isLoaded && isSignedIn ? {} : "skip"
  );
  const removeTemplate = useMutation(api.templates.remove);
  const updateTemplate = useMutation(api.templates.update);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useState<ViewMode>("grid");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [folderPanelOpen, setFolderPanelOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Doc<"templates"> | null>(
    null
  );
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [page, setPage] = useState(1);
  const contentRef = useRef<HTMLDivElement>(null);

  const { canEnter, getRemainingMs } = useEditorExitGuard(4000);

  // Selection
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const lastSelectedIdx = useRef<number>(-1);

  /** All unique folder values (first tags) */
  const allFolders = useMemo(() => {
    if (!templates) return [];
    const set = new Set<string>();
    templates.forEach((t) => {
      const f = extractFolder(t.tags);
      if (f) set.add(f);
    });
    return [...set].sort();
  }, [templates]);

  /** All unique label values (non-first tags) */
  const allLabels = useMemo(() => {
    if (!templates) return [];
    const set = new Set<string>();
    templates.forEach((t) => extractLabels(t.tags).forEach((l) => set.add(l)));
    return [...set].sort();
  }, [templates]);

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (templates ?? []).forEach((t) => {
      const f = extractFolder(t.tags);
      if (f) counts[f] = (counts[f] ?? 0) + 1;
    });
    return counts;
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    let result = [...templates] as Doc<"templates">[];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.tags?.some((tag) => tag.includes(q))
      );
    }
    if (activeFolder) {
      result = result.filter((t) => extractFolder(t.tags) === activeFolder);
    } else if (activeTag) {
      result = result.filter((t) => t.tags?.includes(activeTag));
    }
    result.sort((a, b) => {
      switch (sort) {
        case "newest":
          return b._creationTime - a._creationTime;
        case "oldest":
          return a._creationTime - b._creationTime;
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "most_fields":
          return b.fields.length - a.fields.length;
        default:
          return 0;
      }
    });
    return result;
  }, [templates, search, activeTag, activeFolder, sort]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTemplates.length / PAGE_SIZE)
  );
  const displayTemplates = filteredTemplates.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  useEffect(() => {
    setPage(1);
  }, [search, activeTag, activeFolder, sort]);
  useEffect(() => {
    setSelected(new Set());
  }, [page, search, activeTag, activeFolder, sort]);
  useEffect(() => {
    if (selected.size === 0 && selectMode) setSelectMode(false);
  }, [selected.size]);

  const handleSelect = useCallback(
    (id: string, shift: boolean) => {
      if (!selectMode) setSelectMode(true);
      const idx = displayTemplates.findIndex((t) => t._id === id);
      setSelected((prev) => {
        const next = new Set(prev);
        if (shift && lastSelectedIdx.current >= 0) {
          const lo = Math.min(idx, lastSelectedIdx.current);
          const hi = Math.max(idx, lastSelectedIdx.current);
          for (let i = lo; i <= hi; i++) next.add(displayTemplates[i]._id);
        } else {
          if (next.has(id)) next.delete(id);
          else next.add(id);
        }
        return next;
      });
      lastSelectedIdx.current = idx;
    },
    [displayTemplates, selectMode]
  );

  const handleSelectAll = useCallback(() => {
    setSelected(new Set(filteredTemplates.map((t) => t._id)));
  }, [filteredTemplates]);

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    const results = await Promise.allSettled(
      ids.map((id) => removeTemplate({ id: id as Doc<"templates">["_id"] }))
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    failed
      ? toast.error(`${failed} templates couldn't be deleted.`)
      : toast.success(`${ids.length} templates deleted`);
    setSelected(new Set());
    setSelectMode(false);
    setBulkDeleteOpen(false);
  };

  const handleMoveToFolder = async (folder: string) => {
    const ids = Array.from(selected);
    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const tmpl = templates?.find((t) => t._id === id);
        if (!tmpl) return;
        const rest = (tmpl.tags ?? []).slice(1);
        await updateTemplate({
          id: id as Doc<"templates">["_id"],
          tags: [folder, ...rest],
        });
      })
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    failed
      ? toast.error(`${failed} couldn't be moved.`)
      : toast.success(
          `Moved ${ids.length} template${ids.length !== 1 ? "s" : ""} to "${folder}"`
        );
    setSelected(new Set());
    setSelectMode(false);
  };

  // ── Bulk ZIP export ──────────────────────────────────────────────────────────
  const handleBulkExportZip = async (fmt: "docx" | "pdf") => {
    const ids = Array.from(selected);
    const selectedTemplates = filteredTemplates.filter((t) =>
      ids.includes(t._id)
    );
    const toastId = toast.loading(
      `Preparing ${fmt.toUpperCase()} ZIP for ${selectedTemplates.length} template${selectedTemplates.length !== 1 ? "s" : ""}…`
    );
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();

      const safeName = (name: string) =>
        name.replace(/[/\\?%*:|"<>]/g, "-").trim() || "template";

      const usedNames = new Map<string, number>();
      const getUniqueName = (base: string, ext: string) => {
        const key = `${base}.${ext}`;
        const count = usedNames.get(key) ?? 0;
        usedNames.set(key, count + 1);
        return count === 0 ? `${base}.${ext}` : `${base} (${count}).${ext}`;
      };

      const results = await Promise.allSettled(
        selectedTemplates.map(async (tmpl) => {
          if (!tmpl.fileUrl) throw new Error(`No file for "${tmpl.name}"`);

          if (fmt === "docx") {
            const res = await fetch(tmpl.fileUrl);
            if (!res.ok) throw new Error(`Failed to fetch "${tmpl.name}"`);
            zip.file(
              getUniqueName(safeName(tmpl.name), "docx"),
              await res.blob()
            );
          } else {
            const res = await fetch("/api/onlyoffice-convert", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fileUrl: tmpl.fileUrl,
                fileName: tmpl.name,
              }),
            });
            if (!res.ok)
              throw new Error(`PDF conversion failed for "${tmpl.name}"`);
            zip.file(
              getUniqueName(safeName(tmpl.name), "pdf"),
              await res.blob()
            );
          }
        })
      );

      const failed = results.filter((r) => r.status === "rejected").length;
      const succeeded = selectedTemplates.length - failed;

      if (succeeded === 0) {
        toast.dismiss(toastId);
        toast.error("All exports failed. Nothing to download.");
        return;
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = globalThis.document.createElement("a");
      a.href = url;
      a.download = `templates-export-${fmt}-${new Date().toISOString().slice(0, 10)}.zip`;
      globalThis.document.body.appendChild(a);
      a.click();
      globalThis.document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.dismiss(toastId);
      if (failed > 0) {
        toast.warning(
          `ZIP downloaded with ${succeeded} file${succeeded !== 1 ? "s" : ""} — ${failed} failed.`
        );
      } else {
        toast.success(
          `ZIP with ${succeeded} ${fmt.toUpperCase()} file${succeeded !== 1 ? "s" : ""} downloaded`
        );
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error("ZIP export failed.");
      console.error("[bulk-export-zip-templates]", err);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeTemplate({ id: deleteTarget._id });
      toast.success("Template deleted");
    } catch {
      toast.error("Couldn't delete. Try again.");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const isLoading = templates === undefined;
  const hasFilters = !!(search || activeTag || activeFolder);
  const someSelected = selected.size > 0;
  const allPageSelected =
    displayTemplates.length > 0 &&
    displayTemplates.every((t) => selected.has(t._id));
  const somePageSelected =
    displayTemplates.some((t) => selected.has(t._id)) && !allPageSelected;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between shrink-0 px-4 sm:px-6 pt-[calc(48px+1rem)] sm:pt-5 pb-4 sm:pb-5"
        style={{ borderBottom: `1px solid var(--border-subtle)` }}
      >
        <div>
          <h1
            className="text-[15px] sm:text-base font-semibold"
            style={{ color: "var(--text)" }}
          >
            Templates
          </h1>
          {!isLoading && (
            <p
              className="text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap"
              style={{ color: "var(--text-muted)" }}
            >
              <span>
                {templates?.length ?? 0} template
                {(templates?.length ?? 0) !== 1 ? "s" : ""}
              </span>
              {allFolders.length > 0 && (
                <>
                  <span style={{ color: "var(--text-dim)" }}>·</span>
                  <span>
                    {allFolders.length} folder
                    {allFolders.length !== 1 ? "s" : ""}
                  </span>
                </>
              )}
            </p>
          )}
        </div>
        <button
          onClick={() => router.push("/templates/new")}
          className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-xl transition-all duration-150 shrink-0"
          style={{
            background: "var(--accent-bg)",
            color: "var(--accent-pale)",
            border: `1px solid var(--accent-border)`,
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--accent-bg-hover)";
            e.currentTarget.style.boxShadow = "0 0 20px rgba(99,102,241,0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--accent-bg)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <PlusIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New template</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {/* Toolbar */}
      <div
        className="shrink-0"
        style={{
          borderBottom: `1px solid var(--border-subtle)`,
          background: "var(--bg-muted)",
        }}
      >
        {/* Row 1 */}
        <div className="flex items-center gap-2 px-4 sm:px-6 py-2.5">
          <div className="relative flex-1 max-w-sm">
            <SearchIcon
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: "var(--text-dim)" }}
            />
            <input
              placeholder="Search templates"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-8 text-[13px] rounded-xl outline-none"
              style={{
                background: "var(--bg-muted)",
                border: `1px solid var(--border-subtle)`,
                color: "var(--text)",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.border = `1px solid var(--accent-border)`)
              }
              onBlur={(e) =>
                (e.currentTarget.style.border = `1px solid var(--border-subtle)`)
              }
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-dim)" }}
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div
            className="flex items-center gap-0.5 p-0.5 rounded-xl shrink-0"
            style={{
              background: "var(--bg-muted)",
              border: `1px solid var(--border-subtle)`,
            }}
          >
            {[
              { v: "grid" as ViewMode, I: LayoutGridIcon },
              { v: "list" as ViewMode, I: ListIcon },
            ].map(({ v, I }) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="p-1.5 rounded-lg transition-all"
                style={{
                  background:
                    view === v ? "rgba(99,102,241,0.2)" : "transparent",
                  color: view === v ? "var(--accent-light)" : "var(--text-dim)",
                }}
              >
                <I className="w-4 h-4" />
              </button>
            ))}
          </div>

          {/* Select mode toggle */}
          <button
            onClick={() => {
              setSelectMode((v) => {
                if (v) setSelected(new Set());
                return !v;
              });
            }}
            className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-xl text-[11px] font-medium transition-all shrink-0"
            style={{
              background: selectMode ? "var(--accent-bg)" : "var(--bg-muted)",
              border: `1px solid ${selectMode ? "var(--accent-border)" : "var(--border-subtle)"}`,
              color: selectMode ? "var(--accent-light)" : "var(--text-muted)",
            }}
            title="Select mode"
          >
            <CheckSquareIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Select</span>
          </button>
        </div>

        {/* Row 2: sort + folder + label filters */}
        <div
          className="flex items-center gap-2 px-4 sm:px-6 pb-2.5 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[11px] font-medium shrink-0 whitespace-nowrap"
                style={{
                  background: "var(--bg-muted)",
                  border: `1px solid var(--border-subtle)`,
                  color: "var(--text-muted)",
                }}
              >
                {SORT_LABELS[sort]} <ChevronDownIcon className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <DropdownMenuItem key={key} onClick={() => setSort(key)}>
                  {sort === key && (
                    <CheckIcon
                      className="w-3 h-3 mr-2"
                      style={{ color: "var(--accent-light)" }}
                    />
                  )}
                  {SORT_LABELS[key]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Folder toggle */}
          <button
            onClick={() => setFolderPanelOpen((v) => !v)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[11px] font-medium shrink-0 whitespace-nowrap transition-all"
            style={{
              background: folderPanelOpen
                ? "var(--accent-bg)"
                : "var(--bg-muted)",
              border: `1px solid ${folderPanelOpen ? "var(--accent-border)" : "var(--border-subtle)"}`,
              color: folderPanelOpen
                ? "var(--accent-light)"
                : "var(--text-muted)",
            }}
          >
            <FolderIcon className="w-3.5 h-3.5" />
            {activeFolder ? (
              <span className="max-w-[80px] truncate">{activeFolder}</span>
            ) : (
              "Folders"
            )}
            {activeFolder && (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveFolder(null);
                }}
              >
                <XIcon className="w-3 h-3 ml-1" />
              </span>
            )}
          </button>

          {/* Label filter chips */}
          {allLabels.length > 0 && (
            <>
              <div
                className="w-px h-4 shrink-0"
                style={{ background: "var(--bg-input)" }}
              />
              <button
                onClick={() => setActiveTag(null)}
                className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-xl transition-all whitespace-nowrap"
                style={{
                  background:
                    activeTag === null && !activeFolder
                      ? "rgba(99,102,241,0.2)"
                      : "var(--bg-muted)",
                  color:
                    activeTag === null && !activeFolder
                      ? "var(--accent-light)"
                      : "var(--text-dim)",
                  border: `1px solid ${activeTag === null && !activeFolder ? "var(--accent-border)" : "transparent"}`,
                }}
              >
                All
              </button>
              {allLabels.map((label) => (
                <button
                  key={label}
                  onClick={() => {
                    setActiveTag(activeTag === label ? null : label);
                    setActiveFolder(null);
                  }}
                  className="shrink-0 flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-xl transition-all whitespace-nowrap"
                  style={{
                    background:
                      activeTag === label
                        ? "rgba(52,211,153,0.15)"
                        : "var(--bg-muted)",
                    color:
                      activeTag === label
                        ? "var(--success)"
                        : "var(--text-dim)",
                    border: `1px solid ${activeTag === label ? "rgba(52,211,153,0.3)" : "transparent"}`,
                  }}
                >
                  <TagIcon className="w-2.5 h-2.5" />
                  {label}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Select mode header */}
      {selectMode && !someSelected && (
        <div
          className="flex items-center gap-3 px-4 sm:px-5 py-2 shrink-0"
          style={{
            background: "var(--bg-sidebar)",
            borderBottom: `1px solid var(--border-subtle)`,
          }}
        >
          <SelectCheckbox
            checked={allPageSelected}
            indeterminate={somePageSelected}
            onChange={(v) => {
              if (v) setSelected(new Set(displayTemplates.map((t) => t._id)));
              else setSelected(new Set());
            }}
          />
          <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>
            Click templates to select
          </span>
          <button
            onClick={() => {
              setSelectMode(false);
              setSelected(new Set());
            }}
            className="ml-auto text-[11px]"
            style={{ color: "var(--text-dim)" }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Filter strip */}
      {hasFilters && !isLoading && (
        <div
          className="flex items-center gap-2 px-4 sm:px-6 py-2 shrink-0 flex-wrap"
          style={{
            borderBottom: `1px solid var(--border-subtle)`,
            background: "var(--bg-muted)",
          }}
        >
          <span className="text-[11px]" style={{ color: "var(--text-dim)" }}>
            {filteredTemplates.length} result
            {filteredTemplates.length !== 1 ? "s" : ""}
          </span>
          {search && (
            <span
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-muted)",
              }}
            >
              &ldquo;{search}&rdquo;
              <button onClick={() => setSearch("")}>
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          )}
          {activeFolder && (
            <span
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg"
              style={{
                background: "var(--accent-bg)",
                color: "var(--accent-light)",
              }}
            >
              <FolderIcon className="w-3 h-3" /> {activeFolder}
              <button onClick={() => setActiveFolder(null)}>
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          )}
          {activeTag && (
            <span
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg"
              style={{
                background: "rgba(52,211,153,0.1)",
                color: "var(--success)",
              }}
            >
              <TagIcon className="w-3 h-3" /> {activeTag}
              <button onClick={() => setActiveTag(null)}>
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            onClick={() => {
              setSearch("");
              setActiveTag(null);
              setActiveFolder(null);
            }}
            className="text-[11px] ml-auto"
            style={{ color: "var(--text-dim)" }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Content + folder panel */}
      <div className="flex flex-1 overflow-hidden">
        <div ref={contentRef} className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1">
            {isLoading ? (
              view === "grid" ? (
                <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <GridSkeleton key={i} />
                  ))}
                </div>
              ) : (
                <div>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <ListSkeleton key={i} />
                  ))}
                </div>
              )
            ) : displayTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{
                    background: "rgba(99,102,241,0.08)",
                    border: "1px solid rgba(99,102,241,0.15)",
                  }}
                >
                  <LayoutTemplateIcon
                    className="w-6 h-6"
                    style={{ color: "var(--accent-light)" }}
                  />
                </div>
                <p
                  className="text-[14px] font-semibold mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {search || activeTag || activeFolder
                    ? "No templates found"
                    : "No templates yet"}
                </p>
                <p
                  className="text-[12px] mb-6 max-w-[260px] leading-relaxed"
                  style={{ color: "var(--text-dim)" }}
                >
                  {search
                    ? `No results for "${search}".`
                    : activeTag
                      ? `No templates with label "${activeTag}".`
                      : activeFolder
                        ? `No templates in folder "${activeFolder}".`
                        : "Upload a .docx with {{placeholders}} to create a reusable template."}
                </p>
                {!search && !activeTag && !activeFolder && (
                  <button
                    onClick={() => router.push("/templates/new")}
                    className="flex items-center gap-1.5 text-[13px] font-medium px-4 py-2.5 rounded-xl"
                    style={{
                      background: "var(--accent-bg)",
                      color: "var(--accent-pale)",
                      border: `1px solid var(--accent-border)`,
                    }}
                  >
                    <PlusIcon className="w-3.5 h-3.5" /> New template
                  </button>
                )}
              </div>
            ) : view === "grid" ? (
              <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch pb-[calc(1rem+env(safe-area-inset-bottom)+52px)] md:pb-6">
                {displayTemplates.map((t) => (
                  <TemplateGridCard
                    key={t._id}
                    template={t}
                    onDelete={() => setDeleteTarget(t)}
                    selected={selected.has(t._id)}
                    selectMode={selectMode}
                    onSelect={(shift) => handleSelect(t._id, shift)}
                    allExistingFolders={allFolders}
                    canEnterEditor={canEnter}
                    getCooldownMs={getRemainingMs}
                  />
                ))}
              </div>
            ) : (
              <div className="pb-[calc(env(safe-area-inset-bottom)+52px)] md:pb-0">
                {displayTemplates.map((t) => (
                  <TemplateListRow
                    key={t._id}
                    template={t}
                    onDelete={() => setDeleteTarget(t)}
                    selected={selected.has(t._id)}
                    selectMode={selectMode}
                    onSelect={(shift) => handleSelect(t._id, shift)}
                    allExistingFolders={allFolders}
                    canEnterEditor={canEnter}
                    getCooldownMs={getRemainingMs}
                  />
                ))}
              </div>
            )}
          </div>

          {!isLoading && filteredTemplates.length > PAGE_SIZE && (
            <Pagination
              page={page}
              totalPages={totalPages}
              total={filteredTemplates.length}
              pageSize={PAGE_SIZE}
              onChange={handlePageChange}
            />
          )}
        </div>

        <FolderPanel
          open={folderPanelOpen}
          onClose={() => setFolderPanelOpen(false)}
          folders={allFolders}
          folderCounts={folderCounts}
          activeFolder={activeFolder}
          onSelectFolder={(f) => {
            setActiveFolder(f);
            setActiveTag(null);
          }}
        />
      </div>

      {/* Bulk bar */}
      {someSelected && (
        <BulkBar
          count={selected.size}
          total={filteredTemplates.length}
          onDelete={() => setBulkDeleteOpen(true)}
          onClear={() => {
            setSelected(new Set());
            setSelectMode(false);
          }}
          onSelectAll={handleSelectAll}
          onMoveToFolder={handleMoveToFolder}
          onExportZip={handleBulkExportZip}
          allFolders={allFolders}
        />
      )}

      {/* Single delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.name}&rdquo; will be permanently deleted.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirm */}
      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={(v) => !v && setBulkDeleteOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selected.size} template{selected.size !== 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selected.size} template
              {selected.size !== 1 ? "s" : ""}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
            >
              Delete {selected.size} template{selected.size !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
