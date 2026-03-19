"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";
import {
  PlusIcon,
  LayoutTemplateIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
  PlayIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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
import { Button } from "@/components/ui/button";
import Link from "next/link";

function TemplateCardSkeleton() {
  return (
    <div className="rounded-xl border border-border p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </div>
      </div>
      <div className="h-3 bg-muted rounded w-full" />
      <div className="flex gap-2">
        <div className="h-6 bg-muted rounded-md w-20" />
        <div className="h-6 bg-muted rounded-md w-20" />
      </div>
    </div>
  );
}

function TemplateCard({ template }: { template: Doc<"templates"> }) {
  const router = useRouter();
  const remove = useMutation(api.templates.remove);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    try {
      await remove({ id: template._id });
      toast.success("Template deleted");
    } catch {
      toast.error("Couldn't delete. Try again.");
    }
  };

  const fieldTypeCount = template.fields.reduce<Record<string, number>>(
    (acc, f) => {
      acc[f.type] = (acc[f.type] ?? 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <>
      <div className="group rounded-xl border border-border bg-background p-4 flex flex-col gap-3 hover:shadow-sm hover:border-border/60 transition-all">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
            <LayoutTemplateIcon className="w-4.5 h-4.5 text-indigo-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{template.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {template.fields.length} field
              {template.fields.length !== 1 ? "s" : ""} ·{" "}
              {formatDistanceToNow(new Date(template._creationTime), {
                addSuffix: true,
              })}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-md flex items-center justify-center hover:bg-muted">
                <MoreHorizontalIcon className="w-4 h-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() => router.push(`/templates/${template._id}/edit`)}
              >
                <PencilIcon className="w-3.5 h-3.5 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2Icon className="w-3.5 h-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description */}
        {template.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {template.description}
          </p>
        )}

        {/* Field type badges */}
        {template.fields.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(fieldTypeCount).map(([type, count]) => (
              <span
                key={type}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-[10px] font-medium text-muted-foreground"
              >
                {count} {type}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 h-8 text-xs"
            onClick={() => router.push(`/templates/${template._id}/edit`)}
          >
            <PencilIcon className="w-3 h-3" />
            Edit
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5 h-8 text-xs"
            onClick={() => router.push(`/templates/${template._id}/fill`)}
          >
            <PlayIcon className="w-3 h-3" />
            Use
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{template.name}&rdquo; will be permanently deleted. This
              cannot be undone.
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
    </>
  );
}

export default function TemplatesPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const templates = useQuery(
    api.templates.getAll,
    isLoaded && isSignedIn ? {} : "skip"
  );

  const isLoading = templates === undefined;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-5 border-b border-border">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Templates</h1>
          {!isLoading && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {templates?.length ?? 0} template
              {(templates?.length ?? 0) !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => router.push("/templates/new")}
        >
          <PlusIcon className="w-3.5 h-3.5" />
          New template
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <TemplateCardSkeleton key={i} />
            ))}
          </div>
        ) : templates?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center border-2 border-dashed border-border rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <LayoutTemplateIcon className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold mb-1">No templates yet</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-xs">
              Upload a .docx file with placeholders like{" "}
              <code className="font-mono bg-muted px-1 rounded">
                {"{{field_name}}"}
              </code>{" "}
              to create your first template.
            </p>
            <Button
              size="sm"
              onClick={() => router.push("/templates/new")}
              className="gap-1.5"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              New template
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates?.map((t) => (
              <TemplateCard key={t._id} template={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
