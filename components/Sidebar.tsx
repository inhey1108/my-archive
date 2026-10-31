"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type IconProps = {
  size?: number;
};

function HomeIcon({ size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M4.5 10.5L12 4L19.5 10.5V19.5H4.5V10.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 19.5V14H14.5V19.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AboutIcon({ size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="7.5"
        r="3.2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M5.5 19C5.9 14.9 8.2 12.8 12 12.8C15.8 12.8 18.1 14.9 18.5 19"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CharacterIcon({ size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 3.5L13.2 9.8L19.5 11L13.2 12.2L12 18.5L10.8 12.2L4.5 11L10.8 9.8L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 15.5L19 18L21.5 18.5L19 19L18.5 21.5L18 19L15.5 18.5L18 18L18.5 15.5Z"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PairIcon({ size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="9"
        cy="12"
        r="5.2"
        stroke="currentColor"
        strokeWidth="1.35"
      />
      <circle
        cx="15"
        cy="12"
        r="5.2"
        stroke="currentColor"
        strokeWidth="1.35"
      />
    </svg>
  );
}

function PromptIcon({ size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 3.8H14.5L18.5 7.8V20.2H6V3.8Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M14 3.8V8.2H18.5"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M9 11H15.5M9 14H15.5M9 17H13.5"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NoteIcon({ size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M5.5 4.5H18.5V19.5H5.5V4.5Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M9 8.5H15M9 11.5H15M9 14.5H13"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      <path
        d="M15.5 19.5V17.5"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SettingsIcon({ size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M9.9 3.9L10.6 2.8H13.4L14.1 3.9L15.8 4.6L17.1 4.1L19.1 6.1L18.6 7.4L19.3 9.1L20.4 9.8V12.6L19.3 13.3L18.6 15L19.1 16.3L17.1 18.3L15.8 17.8L14.1 18.5L13.4 19.6H10.6L9.9 18.5L8.2 17.8L6.9 18.3L4.9 16.3L5.4 15L4.7 13.3L3.6 12.6V9.8L4.7 9.1L5.4 7.4L4.9 6.1L6.9 4.1L8.2 4.6L9.9 3.9Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="11.2"
        r="2.8"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

const mainMenus: {
  label: string;
  href: string;
  icon: ReactNode;
}[] = [
  {
    label: "HOME",
    href: "/",
    icon: <HomeIcon />,
  },
  {
    label: "ABOUT ME",
    href: "/about",
    icon: <AboutIcon />,
  },
  {
    label: "CHARACTER",
    href: "/character",
    icon: <CharacterIcon />,
  },
  {
    label: "PAIR",
    href: "/pair",
    icon: <PairIcon />,
  },
  {
    label: "PROMPT",
    href: "/prompt",
    icon: <PromptIcon />,
  },
  {
    label: "NOTE",
    href: "/note",
    icon: <NoteIcon />,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="archive-sidebar">
      <div className="sidebar-inner">
        <Link href="/" className="archive-logo">
          <span className="logo-full">MY.ARCHIVE</span>
          <span className="logo-short">M.A</span>
        </Link>

        <nav className="archive-nav">
          <div className="nav-group">
            {mainMenus.map((menu) => {
              const isActive =
                menu.href === "/"
                  ? pathname === "/"
                  : pathname === menu.href ||
                    pathname.startsWith(`${menu.href}/`);

              return (
                <Link
                  key={menu.href}
                  href={menu.href}
                  className={`archive-nav-link ${
                    isActive ? "active" : ""
                  }`}
                  aria-label={menu.label}
                  title={menu.label}
                >
                  <span className="nav-icon">{menu.icon}</span>
                  <span className="nav-label">{menu.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="nav-divider" />

          <Link
            href="/settings"
            className={`archive-nav-link settings-link ${
              pathname === "/settings" ||
              pathname.startsWith("/settings/")
                ? "active"
                : ""
            }`}
            aria-label="SETTINGS"
            title="SETTINGS"
          >
            <span className="nav-icon">
              <SettingsIcon />
            </span>
            <span className="nav-label">SETTINGS</span>
          </Link>
        </nav>

        <div className="sidebar-footer">
          <span>PERSONAL ARCHIVE</span>
          <span>© 2026</span>
        </div>
      </div>
    </aside>
  );
}