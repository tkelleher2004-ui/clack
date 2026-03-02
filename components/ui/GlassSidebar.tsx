"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export interface GlassSidebarNavItem {
  href: string;
  label: string;
  icon: ReactNode;
  showDot?: boolean;
}

export interface GlassSidebarPinnedItem {
  color: string;
  title: string;
  href?: string;
}

export interface GlassSidebarProps {
  items: GlassSidebarNavItem[];
  collapsed: boolean;
  onToggle?: () => void;
  pinnedItems?: GlassSidebarPinnedItem[];
  footer?: ReactNode | ((expanded: boolean) => ReactNode);
  className?: string;
  onLinkClick?: () => void;
  /** When true, sidebar expands on hover instead of using toggle button */
  expandOnHover?: boolean;
  /** Called when expanded state changes (e.g. on hover) */
  onExpandedChange?: (expanded: boolean) => void;
}

export function GlassSidebar({
  items,
  collapsed,
  onToggle,
  pinnedItems = [],
  footer,
  className = "",
  onLinkClick,
  expandOnHover = false,
  onExpandedChange,
}: GlassSidebarProps) {
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);
  const expanded = expandOnHover ? isHovered : !collapsed;

  // Notify parent when expanded state changes
  useEffect(() => {
    onExpandedChange?.(expanded);
  }, [expanded, onExpandedChange]);

  const width = expanded ? 240 : 48;

  return (
    <aside
      className={`h-full flex flex-col overflow-visible group ${className}`}
      style={{
        width,
        background: "#0A0A0B",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        transition: "width 150ms ease-out",
      }}
      onMouseEnter={() => expandOnHover && setIsHovered(true)}
      onMouseLeave={() => expandOnHover && setIsHovered(false)}
    >
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        {!expandOnHover && onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center justify-center h-12 shrink-0 transition-colors duration-150 text-zinc-500 hover:text-zinc-400"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg
              className={`w-[18px] h-[18px] transition-transform ${collapsed ? "" : "rotate-180"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto flex flex-col items-center">
          {items.map((item) => {
            const isActive =
              item.href === "/dashboard/overview"
                ? pathname === "/dashboard/overview" || pathname.startsWith("/dashboard/overview/")
                : item.href === "/dashboard/chat"
                  ? pathname === "/dashboard" || pathname === "/dashboard/chat"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onLinkClick}
                className="flex items-center gap-3 w-full px-2 py-2 rounded-lg transition-all duration-150 min-w-0"
                style={{
                  padding: "8px",
                  borderRadius: "8px",
                  background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                  color: isActive ? "#F4F4F5" : "#71717A",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    e.currentTarget.style.color = "#A1A1AA";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#71717A";
                  }
                }}
              >
                <span className="shrink-0 w-[18px] h-[18px] flex items-center justify-center relative">
                  <span style={{ color: isActive ? "#F4F4F5" : "inherit" }}>{item.icon}</span>
                  {item.showDot && (
                    <span className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-purple-500" />
                  )}
                </span>
                {expanded && (
                  <span className="whitespace-nowrap overflow-hidden text-sm truncate">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Pinned Artifacts */}
        <div
          className="shrink-0 py-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: "12px", marginBottom: "12px" }}
        >
          {expanded && (
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest px-2 mb-2">PINNED</p>
          )}
          {pinnedItems.length > 0 ? (
            <div className="space-y-0.5">
              {pinnedItems.map((item, i) => (
                <Link
                  key={i}
                  href={item.href ?? "#"}
                  onClick={onLinkClick}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-150 text-[12px] text-zinc-500 hover:text-zinc-300"
                  style={{ padding: expanded ? "6px 8px" : "4px" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.color }} />
                  {expanded && <span className="truncate">{item.title}</span>}
                </Link>
              ))}
            </div>
          ) : (
            expanded && (
              <p className="text-[11px] text-zinc-700 italic px-2">AI reports will appear here</p>
            )
          )}
        </div>

        {footer && (
          <div className="shrink-0 p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {typeof footer === "function" ? footer(expanded) : footer}
          </div>
        )}
      </div>
    </aside>
  );
}
