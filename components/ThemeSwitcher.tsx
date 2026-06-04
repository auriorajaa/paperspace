// components/ThemeSwitcher.tsx
"use client";

import { CheckIcon, ChevronDownIcon, MoonIcon, SunIcon } from "lucide-react";
import type { ComponentType, CSSProperties } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";
import type { FontSizePreference, Theme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

type ThemeSwitcherProps = {
  collapsed?: boolean;
  mobile?: boolean;
  className?: string;
  size?: "default" | "sm";
  contentSide?: "top" | "right" | "bottom" | "left";
  contentAlign?: "start" | "center" | "end";
};

type IconComponent = ComponentType<{
  className?: string;
  style?: CSSProperties;
}>;

const THEME_OPTIONS: {
  value: Theme;
  label: string;
  subtitle: string;
  icon: IconComponent;
}[] = [
  {
    value: "dark",
    label: "Dark",
    subtitle: "Default cinematic look",
    icon: MoonIcon,
  },
  {
    value: "light",
    label: "Light",
    subtitle: "Bright workspace mode",
    icon: SunIcon,
  },
];

const FONT_SIZE_OPTIONS: {
  value: FontSizePreference;
  label: string;
  subtitle: string;
  sampleClassName: string;
}[] = [
  {
    value: "compact",
    label: "Compact",
    subtitle: "Minimum 12px",
    sampleClassName: "text-[12px]",
  },
  {
    value: "default",
    label: "Default",
    subtitle: "Minimum 13px",
    sampleClassName: "text-[13px]",
  },
  {
    value: "large",
    label: "Large",
    subtitle: "Minimum 14px",
    sampleClassName: "text-[14px]",
  },
];

function Swatch({ theme }: { theme: Theme }) {
  const isLight = theme === "light";
  return (
    <div
      className="w-7 h-5 rounded-md border shrink-0"
      style={{
        borderColor: isLight ? "rgba(15,23,42,0.2)" : "rgba(255,255,255,0.18)",
        background: isLight
          ? "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)"
          : "linear-gradient(135deg, #0a0a0c 0%, #1f2030 100%)",
      }}
    />
  );
}

function FontPreview({ className }: { className: string }) {
  return (
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
      style={{
        background: "var(--bg-muted)",
        border: "1px solid var(--border-subtle)",
        color: "var(--text-secondary)",
      }}
    >
      <span className={cn("font-bold leading-none", className)}>Aa</span>
    </div>
  );
}

export function ThemeSwitcher({
  collapsed = false,
  mobile = false,
  className,
  size = "default",
  contentSide,
  contentAlign,
}: ThemeSwitcherProps) {
  const { theme, setTheme, resolvedTheme, fontSize, setFontSize } = useTheme();
  const activeTheme = resolvedTheme || theme;
  const active = THEME_OPTIONS.find((option) => option.value === activeTheme);
  const activeFontSize = FONT_SIZE_OPTIONS.find(
    (option) => option.value === fontSize
  );
  const ActiveIcon = active?.icon ?? MoonIcon;
  const collapsedButtonSize = size === "sm" ? 36 : 44;
  const menuSide = contentSide ?? (collapsed ? "right" : "top");
  const menuAlign = contentAlign ?? (collapsed ? "center" : "start");

  if (mobile) {
    return (
      <div className={cn("w-full", className)}>
        <p
          className="text-[10px] font-semibold uppercase tracking-widest mb-2"
          style={{ color: "var(--text-dim)" }}
        >
          Theme
        </p>
        <div className="space-y-1.5">
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = option.value === activeTheme;
            return (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                style={{
                  background: selected
                    ? "var(--accent-soft)"
                    : "var(--bg-muted)",
                  border: `1px solid ${selected ? "var(--accent-border)" : "var(--border-subtle)"}`,
                }}
              >
                <Swatch theme={option.value} />
                <Icon
                  className="w-3.5 h-3.5 shrink-0"
                  style={{
                    color: selected
                      ? "var(--accent-light)"
                      : "var(--text-muted)",
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[13px] font-medium leading-tight"
                    style={{
                      color: selected
                        ? "var(--accent-pale)"
                        : "var(--text-secondary)",
                    }}
                  >
                    {option.label}
                  </p>
                  <p
                    className="text-[11px] leading-tight"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {option.subtitle}
                  </p>
                </div>
                {selected && (
                  <CheckIcon
                    className="w-4 h-4 shrink-0"
                    style={{ color: "var(--success)" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <p
          className="text-[10px] font-semibold uppercase tracking-widest mt-4 mb-2"
          style={{ color: "var(--text-dim)" }}
        >
          Font size
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {FONT_SIZE_OPTIONS.map((option) => {
            const selected = option.value === fontSize;
            return (
              <button
                key={option.value}
                onClick={() => setFontSize(option.value)}
                className="min-w-0 flex flex-col items-center gap-1.5 px-2 py-2 rounded-xl transition-all"
                style={{
                  background: selected
                    ? "var(--accent-soft)"
                    : "var(--bg-muted)",
                  border: `1px solid ${selected ? "var(--accent-border)" : "var(--border-subtle)"}`,
                }}
              >
                <FontPreview className={option.sampleClassName} />
                <span
                  className="text-[11px] font-medium truncate max-w-full"
                  style={{
                    color: selected
                      ? "var(--accent-pale)"
                      : "var(--text-secondary)",
                  }}
                >
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "rounded-xl transition-all flex items-center",
            collapsed
              ? size === "sm"
                ? "w-9 h-9 justify-center"
                : "w-[44px] h-[44px] justify-center"
              : "w-full justify-start gap-2.5 px-3 py-2.5 text-left",
            className
          )}
          style={{
            background: "var(--bg-muted)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-secondary)",
            minHeight: collapsed ? collapsedButtonSize : "auto",
          }}
          title={collapsed ? "Appearance" : undefined}
        >
          <ActiveIcon
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: "var(--text-muted)" }}
          />

          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p
                  className="text-[12px] font-medium"
                  style={{ color: "var(--text)" }}
                >
                  Appearance
                </p>
                <p
                  className="text-[10px] truncate"
                  style={{ color: "var(--text-dim)" }}
                >
                  {active?.label ?? "Dark"} /{" "}
                  {activeFontSize?.label ?? "Default"}
                </p>
              </div>
              <ChevronDownIcon
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: "var(--text-dim)" }}
              />
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side={menuSide}
        align={menuAlign}
        sideOffset={collapsed ? 8 : 0}
        className="w-56 z-[100]"
      >
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = option.value === activeTheme;

          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setTheme(option.value)}
              className="flex items-center gap-2.5 py-2 cursor-pointer"
            >
              <Swatch theme={option.value} />
              <Icon
                className="w-3.5 h-3.5"
                style={{
                  color: selected ? "var(--accent-light)" : "var(--text-muted)",
                }}
              />
              <div className="flex-1 min-w-0">
                <p
                  className="text-[12px] font-medium leading-tight"
                  style={{
                    color: selected ? "var(--text)" : "var(--text-secondary)",
                  }}
                >
                  {option.label}
                </p>
                <p
                  className="text-[10px] leading-tight"
                  style={{ color: "var(--text-muted)" }}
                >
                  {option.subtitle}
                </p>
              </div>
              {selected && (
                <CheckIcon
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: "var(--success)" }}
                />
              )}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Font size</DropdownMenuLabel>
        {FONT_SIZE_OPTIONS.map((option) => {
          const selected = option.value === fontSize;

          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setFontSize(option.value)}
              className="flex items-center gap-2.5 py-2 cursor-pointer"
            >
              <FontPreview className={option.sampleClassName} />
              <div className="flex-1 min-w-0">
                <p
                  className="text-[12px] font-medium leading-tight"
                  style={{
                    color: selected ? "var(--text)" : "var(--text-secondary)",
                  }}
                >
                  {option.label}
                </p>
                <p
                  className="text-[10px] leading-tight"
                  style={{ color: "var(--text-muted)" }}
                >
                  {option.subtitle}
                </p>
              </div>
              {selected && (
                <CheckIcon
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: "var(--success)" }}
                />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
