"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UserButton,
  useOrganization,
  useOrganizationList,
  useClerk,
} from "@clerk/nextjs";
import {
  HomeIcon,
  FileTextIcon,
  FolderIcon,
  LayoutTemplateIcon,
  ZapIcon,
  ChevronDownIcon,
  CheckIcon,
  PlusIcon,
  BuildingIcon,
  UserIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: HomeIcon },
  { href: "/documents", label: "Documents", icon: FileTextIcon },
  { href: "/collections", label: "Collections", icon: FolderIcon },
  { href: "/templates", label: "Templates", icon: LayoutTemplateIcon },
  { href: "/form-results", label: "Results", icon: ZapIcon },
];

// ── Org Dropdown — viewport-aware fixed positioning ───────────────────────────

function OrgDropdown({
  anchorRef,
  open,
  onClose,
  orgs,
  organization,
  onPersonal,
  onOrg,
  onCreateOrg,
  onOrgSettings,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  open: boolean;
  onClose: () => void;
  orgs: any[];
  organization: any;
  onPersonal: () => void;
  onOrg: (id: string) => void;
  onCreateOrg: () => void;
  onOrgSettings: () => void;
}) {
  const [pos, setPos] = useState({
    top: 0,
    left: 0,
    width: 220,
    alignBottom: false,
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Smart viewport-aware positioning
  useEffect(() => {
    if (!open || !anchorRef.current) return;

    const recalc = () => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const viewportW = window.innerWidth;

      // Estimate dropdown height: base + org rows
      const estimatedHeight = 130 + orgs.length * 60;
      const spaceBelow = viewportH - rect.top;
      const spaceAbove = rect.bottom;

      // Prefer aligning top with anchor top; if that clips at bottom, flip to bottom-align
      const alignBottom =
        spaceBelow < estimatedHeight && spaceAbove >= estimatedHeight;

      // Horizontal: right of anchor, but clamp to viewport
      const preferredLeft = rect.right + 10;
      const dropdownWidth = Math.max(240, rect.width + 40);
      const left = Math.min(preferredLeft, viewportW - dropdownWidth - 12);

      setPos({
        top: alignBottom ? rect.bottom : rect.top,
        left,
        width: dropdownWidth,
        alignBottom,
      });
    };

    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [open, orgs.length]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const isPersonal = !organization;

  return (
    <div
      ref={dropdownRef}
      className="fixed z-[9999] rounded-2xl py-1.5 overflow-hidden"
      style={{
        top: pos.top,
        left: pos.left,
        minWidth: pos.width,
        maxHeight: "calc(100vh - 32px)",
        overflowY: "auto",
        // Align from top or from bottom depending on available space
        transform: pos.alignBottom ? "translateY(-100%)" : "none",
        background: "#15151e",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow:
          "0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.08)",
      }}
    >
      {/* Personal option */}
      <div className="px-1.5">
        <button
          onClick={async () => {
            await onPersonal();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
          style={{
            background: isPersonal ? "rgba(99,102,241,0.12)" : "transparent",
          }}
          onMouseEnter={(e) => {
            if (!isPersonal)
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          }}
          onMouseLeave={(e) => {
            if (!isPersonal) e.currentTarget.style.background = "transparent";
          }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: isPersonal
                ? "rgba(99,102,241,0.2)"
                : "rgba(255,255,255,0.08)",
            }}
          >
            <UserIcon
              className="w-3.5 h-3.5"
              style={{
                color: isPersonal ? "#818cf8" : "rgba(255,255,255,0.45)",
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-[13px] font-semibold leading-tight"
              style={{
                color: isPersonal ? "#a5b4fc" : "rgba(255,255,255,0.85)",
              }}
            >
              Personal
            </p>
            <p
              className="text-[11px] leading-tight"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              Private workspace
            </p>
          </div>
          {isPersonal && (
            <CheckIcon
              className="w-4 h-4 shrink-0"
              style={{ color: "#34d399" }}
            />
          )}
        </button>
      </div>

      {/* Organizations */}
      {orgs.length > 0 && (
        <>
          <div className="px-4 pt-2 pb-1">
            <p
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,0.25)" }}
            >
              Organizations
            </p>
          </div>
          <div className="px-1.5 space-y-0.5 pb-1">
            {orgs.map((membership) => {
              const org = membership.organization;
              const isActive = organization?.id === org.id;
              return (
                <button
                  key={org.id}
                  onClick={async () => {
                    await onOrg(org.id);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{
                    background: isActive
                      ? "rgba(99,102,241,0.12)"
                      : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
                    style={{
                      background: isActive
                        ? "rgba(99,102,241,0.2)"
                        : "rgba(255,255,255,0.08)",
                    }}
                  >
                    {org.imageUrl ? (
                      <img
                        src={org.imageUrl}
                        alt={org.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span
                        className="text-sm font-bold"
                        style={{
                          color: isActive ? "#818cf8" : "rgba(255,255,255,0.6)",
                        }}
                      >
                        {org.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[13px] font-semibold truncate leading-tight"
                      style={{
                        color: isActive ? "#a5b4fc" : "rgba(255,255,255,0.85)",
                      }}
                    >
                      {org.name}
                    </p>
                    <p
                      className="text-[11px] leading-tight"
                      style={{ color: "rgba(255,255,255,0.35)" }}
                    >
                      {membership.role === "org:admin" ? "Admin" : "Member"}
                    </p>
                  </div>
                  {isActive && (
                    <CheckIcon
                      className="w-4 h-4 shrink-0"
                      style={{ color: "#34d399" }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Footer actions */}
      <div
        className="px-1.5 pt-1 space-y-0.5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        {organization && (
          <button
            onClick={() => {
              onClose();
              setTimeout(onOrgSettings, 100);
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all"
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <SettingsIcon
              className="w-3.5 h-3.5 shrink-0"
              style={{ color: "rgba(255,255,255,0.4)" }}
            />
            <div className="flex-1 min-w-0">
              <p
                className="text-[12px] font-medium"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                Manage organization
              </p>
              <p
                className="text-[10px]"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                Members, roles, invites & settings
              </p>
            </div>
          </button>
        )}
        <button
          onClick={() => {
            onClose();
            setTimeout(onCreateOrg, 100);
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all"
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          <div
            className="w-3.5 h-3.5 shrink-0 rounded flex items-center justify-center"
            style={{ border: "1.5px dashed rgba(99,102,241,0.5)" }}
          >
            <PlusIcon className="w-2 h-2" style={{ color: "#818cf8" }} />
          </div>
          <p
            className="text-[12px] font-medium"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Create organization
          </p>
        </button>
      </div>
    </div>
  );
}

// ── Workspace Switcher Button ─────────────────────────────────────────────────

function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const { organization } = useOrganization();
  const { userMemberships, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const { openCreateOrganization, openOrganizationProfile } = useClerk();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const orgs = userMemberships?.data ?? [];
  const isPersonal = !organization;
  const currentName = organization?.name ?? "Personal";
  const currentImage = organization?.imageUrl ?? null;

  const handlePersonal = async () => setActive?.({ organization: null });
  const handleOrg = async (id: string) => setActive?.({ organization: id });

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center rounded-xl transition-all"
        style={{
          gap: collapsed ? 0 : 10,
          padding: collapsed ? "8px 0" : "8px 10px",
          justifyContent: collapsed ? "center" : "flex-start",
          background: open ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${open ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.07)"}`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.07)";
          e.currentTarget.style.border = "1px solid rgba(255,255,255,0.12)";
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
            e.currentTarget.style.border = "1px solid rgba(255,255,255,0.07)";
          }
        }}
        title={collapsed ? `${currentName} — click to switch` : undefined}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden relative"
          style={{
            background: isPersonal
              ? "rgba(255,255,255,0.1)"
              : "rgba(99,102,241,0.2)",
          }}
        >
          {currentImage ? (
            <img
              src={currentImage}
              alt={currentName}
              className="w-full h-full object-cover"
            />
          ) : isPersonal ? (
            <UserIcon
              className="w-3.5 h-3.5"
              style={{ color: "rgba(255,255,255,0.5)" }}
            />
          ) : (
            <span className="text-sm font-bold" style={{ color: "#818cf8" }}>
              {currentName.charAt(0).toUpperCase()}
            </span>
          )}
          {!isPersonal && (
            <span
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
              style={{ background: "#818cf8", border: "1.5px solid #0e0e12" }}
            />
          )}
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0 text-left">
              <p
                className="text-[12px] font-semibold truncate leading-tight"
                style={{ color: "rgba(255,255,255,0.88)" }}
              >
                {currentName}
              </p>
              <p
                className="text-[10px] leading-tight"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                {isPersonal ? "Personal" : "Organization"}
              </p>
            </div>
            <ChevronDownIcon
              className="w-3.5 h-3.5 shrink-0 transition-transform duration-200"
              style={{
                color: "rgba(255,255,255,0.3)",
                transform: open ? "rotate(180deg)" : "none",
              }}
            />
          </>
        )}
      </button>

      <OrgDropdown
        anchorRef={btnRef}
        open={open}
        onClose={() => setOpen(false)}
        orgs={orgs}
        organization={organization}
        onPersonal={handlePersonal}
        onOrg={handleOrg}
        onCreateOrg={() => openCreateOrganization({})}
        onOrgSettings={() => openOrganizationProfile({})}
      />
    </div>
  );
}

// ── Mobile Account Sheet ──────────────────────────────────────────────────────

function MobileAccountSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { organization } = useOrganization();
  const { userMemberships, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const { openCreateOrganization, openOrganizationProfile } = useClerk();

  const orgs = userMemberships?.data ?? [];
  const isPersonal = !organization;
  const currentName = organization?.name ?? "Personal";
  const currentImage = organization?.imageUrl ?? null;

  const handlePersonal = async () => {
    await setActive?.({ organization: null });
  };
  const handleOrg = async (id: string) => {
    await setActive?.({ organization: id });
  };

  // Prevent body scroll when sheet open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="md:hidden fixed inset-0 z-[60] transition-opacity duration-300"
        style={{
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="md:hidden fixed inset-x-0 bottom-0 z-[70] rounded-t-3xl overflow-hidden"
        style={{
          background: "#15151e",
          border: "1px solid rgba(255,255,255,0.08)",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
          maxHeight: "85vh",
          overflowY: "auto",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="w-9 h-1 rounded-full"
            style={{ background: "rgba(255,255,255,0.15)" }}
          />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p
            className="text-[15px] font-semibold"
            style={{ color: "rgba(255,255,255,0.9)" }}
          >
            Account & Workspace
          </p>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <XIcon
              className="w-3.5 h-3.5"
              style={{ color: "rgba(255,255,255,0.5)" }}
            />
          </button>
        </div>

        {/* Current workspace indicator */}
        <div className="px-5 pt-4 pb-2">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-2"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            Current Workspace
          </p>
          <div
            className="flex items-center gap-3 px-3 py-3 rounded-2xl"
            style={{
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.15)",
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
              style={{
                background: isPersonal
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(99,102,241,0.2)",
              }}
            >
              {currentImage ? (
                <img
                  src={currentImage}
                  alt={currentName}
                  className="w-full h-full object-cover"
                />
              ) : isPersonal ? (
                <UserIcon
                  className="w-4 h-4"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                />
              ) : (
                <span
                  className="text-base font-bold"
                  style={{ color: "#818cf8" }}
                >
                  {currentName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-[14px] font-semibold truncate"
                style={{ color: "rgba(255,255,255,0.9)" }}
              >
                {currentName}
              </p>
              <p
                className="text-[11px]"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                {isPersonal ? "Personal workspace" : "Organization"}
              </p>
            </div>
          </div>
        </div>

        {/* Switch to personal */}
        <div className="px-5 py-2">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-2"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            Switch To
          </p>
          <button
            onClick={async () => {
              await handlePersonal();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left mb-1"
            style={{
              background: isPersonal
                ? "rgba(99,102,241,0.12)"
                : "rgba(255,255,255,0.04)",
              border: `1px solid ${isPersonal ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.07)"}`,
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <UserIcon
                className="w-3.5 h-3.5"
                style={{
                  color: isPersonal ? "#818cf8" : "rgba(255,255,255,0.4)",
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-[13px] font-semibold"
                style={{
                  color: isPersonal ? "#a5b4fc" : "rgba(255,255,255,0.8)",
                }}
              >
                Personal
              </p>
              <p
                className="text-[11px]"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                Private workspace
              </p>
            </div>
            {isPersonal && (
              <CheckIcon
                className="w-4 h-4 shrink-0"
                style={{ color: "#34d399" }}
              />
            )}
          </button>

          {orgs.map((membership) => {
            const org = membership.organization;
            const isActive = organization?.id === org.id;
            return (
              <button
                key={org.id}
                onClick={async () => {
                  await handleOrg(org.id);
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left mb-1"
                style={{
                  background: isActive
                    ? "rgba(99,102,241,0.12)"
                    : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isActive ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.07)"}`,
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
                  style={{ background: "rgba(99,102,241,0.2)" }}
                >
                  {org.imageUrl ? (
                    <img
                      src={org.imageUrl}
                      alt={org.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span
                      className="text-sm font-bold"
                      style={{ color: "#818cf8" }}
                    >
                      {org.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[13px] font-semibold truncate"
                    style={{
                      color: isActive ? "#a5b4fc" : "rgba(255,255,255,0.8)",
                    }}
                  >
                    {org.name}
                  </p>
                  <p
                    className="text-[11px]"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    {membership.role === "org:admin" ? "Admin" : "Member"}
                  </p>
                </div>
                {isActive && (
                  <CheckIcon
                    className="w-4 h-4 shrink-0"
                    style={{ color: "#34d399" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div
          className="px-5 py-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-2 pt-2"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            Actions
          </p>

          <button
            onClick={() => {
              onClose();
              setTimeout(() => openCreateOrganization({}), 100);
            }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left mb-2"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: "rgba(99,102,241,0.12)",
                border: "1.5px dashed rgba(99,102,241,0.4)",
              }}
            >
              <PlusIcon className="w-3.5 h-3.5" style={{ color: "#818cf8" }} />
            </div>
            <p
              className="text-[13px] font-medium"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              Create organization
            </p>
          </button>

          {organization && (
            <button
              onClick={() => {
                onClose();
                setTimeout(() => openOrganizationProfile({}), 100);
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left mb-2"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                <SettingsIcon
                  className="w-3.5 h-3.5"
                  style={{ color: "rgba(255,255,255,0.45)" }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-[13px] font-medium"
                  style={{ color: "rgba(255,255,255,0.7)" }}
                >
                  Manage organization
                </p>
                <p
                  className="text-[11px]"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  Members, roles & settings
                </p>
              </div>
            </button>
          )}
        </div>

        {/* User account row */}
        <div
          className="px-5 py-4 flex items-center gap-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <UserButton
            appearance={{ elements: { avatarBox: "w-9 h-9 rounded-xl" } }}
          />
          <div className="flex-1 min-w-0">
            <p
              className="text-[13px] font-medium"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              My account
            </p>
            <p
              className="text-[11px]"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Profile, security & billing
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Mobile Top Header ─────────────────────────────────────────────────────────

function MobileHeader({ onOpenAccount }: { onOpenAccount: () => void }) {
  const { organization } = useOrganization();
  const currentName = organization?.name ?? "Personal";
  const currentImage = organization?.imageUrl ?? null;
  const isPersonal = !organization;

  return (
    <header
      className="md:hidden fixed top-0 inset-x-0 z-50 flex items-center px-4 h-12"
      style={{
        background: "rgba(10,10,14,0.92)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 flex-1">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
        >
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
            <path
              d="M2 2h6l3 3v7H2V2z"
              stroke="white"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M8 2v3h3"
              stroke="white"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M4 7h5M4 9.5h3"
              stroke="white"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span
          className="text-[13px] font-semibold tracking-tight"
          style={{ color: "rgba(255,255,255,0.9)" }}
        >
          Paperspace
        </span>
      </div>

      {/* Workspace + account buttons */}
      <div className="flex items-center gap-2">
        {/* Workspace chip */}
        <button
          onClick={onOpenAccount}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center overflow-hidden shrink-0"
            style={{
              background: isPersonal
                ? "rgba(255,255,255,0.1)"
                : "rgba(99,102,241,0.25)",
            }}
          >
            {currentImage ? (
              <img
                src={currentImage}
                alt={currentName}
                className="w-full h-full object-cover"
              />
            ) : isPersonal ? (
              <UserIcon
                className="w-3 h-3"
                style={{ color: "rgba(255,255,255,0.5)" }}
              />
            ) : (
              <span
                className="text-[10px] font-bold"
                style={{ color: "#818cf8" }}
              >
                {currentName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <span
            className="text-[11px] font-medium max-w-[80px] truncate"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            {currentName}
          </span>
          <ChevronDownIcon
            className="w-3 h-3 shrink-0"
            style={{ color: "rgba(255,255,255,0.3)" }}
          />
        </button>

        {/* Avatar */}
        <UserButton
          appearance={{ elements: { avatarBox: "w-7 h-7 rounded-xl" } }}
        />
      </div>
    </header>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────

export function Navbar() {
  const pathname = usePathname();
  const { organization } = useOrganization();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggle = () =>
    setCollapsed((v) => {
      localStorage.setItem("sidebar-collapsed", String(!v));
      return !v;
    });

  const isActive = (href: string) => {
    if (href === "/home") return pathname === "/home";
    return pathname.startsWith(href);
  };

  if (!mounted) return null;

  return (
    <>
      {/* ── Mobile top header ── */}
      <MobileHeader onOpenAccount={() => setMobileAccountOpen(true)} />
      {/* ── Mobile account sheet ── */}
      <MobileAccountSheet
        open={mobileAccountOpen}
        onClose={() => setMobileAccountOpen(false)}
      />
      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden md:flex flex-col h-screen sticky top-0 shrink-0 transition-all duration-200 overflow-visible"
        style={{
          width: collapsed ? 60 : 216,
          background: "#0e0e12",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          zIndex: 40,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center h-14 shrink-0"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            padding: collapsed ? "0" : "0 12px",
            justifyContent: collapsed ? "center" : "space-between",
          }}
        >
          {!collapsed && (
            <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  boxShadow: "0 0 14px rgba(99,102,241,0.4)",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M2 2h6l3 3v7H2V2z"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8 2v3h3"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M4 7h5M4 9.5h3"
                    stroke="white"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <span
                className="text-sm font-semibold tracking-tight whitespace-nowrap"
                style={{ color: "rgba(255,255,255,0.9)" }}
              >
                Paperspace
              </span>
            </div>
          )}
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all"
            style={{ color: "rgba(255,255,255,0.3)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.8)";
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.3)";
              e.currentTarget.style.background = "transparent";
            }}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpenIcon className="w-3.5 h-3.5" />
            ) : (
              <PanelLeftCloseIcon className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Org context strip */}
        {organization && (
          <div
            className="flex items-center shrink-0 transition-all duration-200"
            style={{
              background: "rgba(99,102,241,0.07)",
              borderBottom: "1px solid rgba(99,102,241,0.12)",
              padding: collapsed ? "4px 0" : "5px 12px",
              justifyContent: collapsed ? "center" : "flex-start",
              minHeight: collapsed ? 14 : "auto",
            }}
          >
            {collapsed ? (
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "#818cf8" }}
              />
            ) : (
              <>
                <BuildingIcon
                  className="w-3 h-3 shrink-0 mr-1.5"
                  style={{ color: "#818cf8" }}
                />
                <span
                  className="text-[10px] font-medium truncate flex-1"
                  style={{ color: "rgba(129,140,248,0.8)" }}
                >
                  {organization.name}
                </span>
                <span
                  className="text-[9px] px-1.5 py-px rounded ml-2 font-semibold shrink-0"
                  style={{
                    background: "rgba(99,102,241,0.2)",
                    color: "#818cf8",
                  }}
                >
                  ORG
                </span>
              </>
            )}
          </div>
        )}

        {/* Nav items */}
        <nav
          className={`flex-1 py-2 px-2 space-y-0.5 ${collapsed ? "overflow-hidden" : "overflow-y-auto"}`}
        >
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center rounded-xl transition-all duration-150 relative group/nav"
                style={{
                  gap: collapsed ? 0 : 10,
                  padding: collapsed ? "9px 0" : "8px 12px",
                  justifyContent: collapsed ? "center" : "flex-start",
                  color: active
                    ? "rgba(255,255,255,0.95)"
                    : "rgba(255,255,255,0.4)",
                  background: active ? "rgba(99,102,241,0.13)" : "transparent",
                  fontWeight: active ? 500 : 400,
                  fontSize: 13,
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = "rgba(255,255,255,0.75)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = "rgba(255,255,255,0.4)";
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {active && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                    style={{ background: "#6366f1" }}
                  />
                )}
                <Icon
                  className="w-4 h-4 shrink-0"
                  style={{ color: active ? "#818cf8" : "inherit" }}
                />
                {!collapsed && <span className="truncate">{label}</span>}
                {collapsed && (
                  <div
                    className="absolute left-full ml-3 px-3 py-1.5 rounded-xl text-xs font-medium
                      pointer-events-none z-50 whitespace-nowrap
                      opacity-0 group-hover/nav:opacity-100 transition-opacity duration-100"
                    style={{
                      background: "#1e1e28",
                      color: "rgba(255,255,255,0.85)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                    }}
                  >
                    {label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div
          className="shrink-0 flex flex-col gap-2 px-2 py-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <WorkspaceSwitcher collapsed={collapsed} />
          <div
            className="flex items-center gap-2.5 px-1 py-0.5"
            style={{ justifyContent: collapsed ? "center" : "flex-start" }}
          >
            <UserButton
              appearance={{ elements: { avatarBox: "w-7 h-7 rounded-lg" } }}
            />
            {!collapsed && (
              <span
                className="text-[12px]"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                Account
              </span>
            )}
          </div>
        </div>
      </aside>
      {/* ── Mobile bottom tab bar ── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50"
        style={{
          background: "rgba(10,10,14,0.96)",
          backdropFilter: "blur(24px)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div
          className="flex items-stretch"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 relative transition-colors min-w-0"
                style={{
                  color: active ? "#818cf8" : "rgba(255,255,255,0.3)",
                  // Ensure touch target is at least 44px tall
                  minHeight: 52,
                }}
              >
                {active && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                    style={{ background: "#6366f1" }}
                  />
                )}
                <Icon
                  className="w-[18px] h-[18px] shrink-0"
                  strokeWidth={active ? 2.2 : 1.8}
                />
                <span
                  className="font-medium leading-none truncate w-full text-center px-0.5"
                  style={{ fontSize: 9 }}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
      {/* ── Mobile spacers (prevents content being hidden behind fixed bars) ── */}
      <div className="md:hidden h-12 shrink-0" aria-hidden />{" "}
      {/* top header space */}
    </>
  );
}
