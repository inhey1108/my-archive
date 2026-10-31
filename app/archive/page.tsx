"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ArchiveItem = {
  id: string;
  name: string;
  type: "CHARACTER" | "PAIR" | "PROMPT" | "NOTE";
  updatedAt: string;
  href: string;
};


const typeStyles: Record<ArchiveItem["type"], { bg: string; text: string }> = {
  CHARACTER: { bg: "bg-[#eeebf8]", text: "text-[#71689b]" },
  PAIR: { bg: "bg-[#f5e9eb]", text: "text-[#9a707a]" },
  PROMPT: { bg: "bg-[#e9eef7]", text: "text-[#667a9d]" },
  NOTE: { bg: "bg-[#eaf0e8]", text: "text-[#6c806b]" },
};

function ArchiveRecentIcon({ type }: { type: ArchiveItem["type"] }) {
  const common = "h-5 w-5 fill-none stroke-current stroke-[1.5]";
  switch (type) {
    case "CHARACTER":
      return <svg viewBox="0 0 24 24" className={common}><circle cx="12" cy="7.5" r="3" /><path d="M5.5 19c.8-3.3 3-5 6.5-5s5.7 1.7 6.5 5" /></svg>;
    case "PAIR":
      return <svg viewBox="0 0 24 24" className={common}><circle cx="8" cy="8" r="2.7" /><circle cx="16" cy="8" r="2.7" /><path d="M3.8 18c.6-3 2.1-4.5 4.2-4.5s3.6 1.5 4.2 4.5M11.8 18c.6-3 2.1-4.5 4.2-4.5s3.6 1.5 4.2 4.5" /></svg>;
    case "PROMPT":
      return <svg viewBox="0 0 24 24" className={common}><path d="M6 3.5h8l4 4V20H6z" /><path d="M14 3.5V8h4M9 12h6M9 15h6" /></svg>;
    case "NOTE":
      return <svg viewBox="0 0 24 24" className={common}><path d="M5 4.5h14v15H5z" /><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" /></svg>;
  }
}

function getArchiveDescription(type: ArchiveItem["type"]) {
  switch (type) {
    case "CHARACTER": return "캐릭터 설정과 기록을 확인해보세요.";
    case "PAIR": return "두 사람의 관계와 이야기를 확인해보세요.";
    case "PROMPT": return "저장해둔 프롬프트를 확인해보세요.";
    case "NOTE": return "작성해둔 생각과 기록을 확인해보세요.";
  }
}

export default function ArchivePage() {
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] =
    useState<"ALL" | ArchiveItem["type"]>(
      "ALL",
    );

  useEffect(() => {
    async function loadArchive() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const [
        characters,
        pairs,
        prompts,
        notes,
      ] = await Promise.all([
        supabase
          .from("characters")
          .select("id, name, updated_at")
          .order("updated_at", {
            ascending: false,
          }),

        supabase
          .from("pairs")
          .select("id, name, updated_at")
          .order("updated_at", {
            ascending: false,
          }),

        supabase
          .from("prompts")
          .select(
            "id, name, updated_at, is_public",
          )
          .order("updated_at", {
            ascending: false,
          }),

        supabase
          .from("notes")
          .select(
            "id, title, updated_at",
          )
          .order("updated_at", {
            ascending: false,
          }),
      ]);

      const archiveItems: ArchiveItem[] = [
        ...(characters.data ?? []).map(
          (item) => ({
            id: item.id,
            name: item.name,
            type: "CHARACTER" as const,
            updatedAt: item.updated_at,
            href: `/character/${item.id}`,
          }),
        ),

        ...(pairs.data ?? []).map(
          (item) => ({
            id: item.id,
            name: item.name,
            type: "PAIR" as const,
            updatedAt: item.updated_at,
            href: `/pair/${item.id}`,
          }),
        ),

        ...(prompts.data ?? [])
          .filter(
            (item) =>
              Boolean(user) ||
              Boolean(item.is_public),
          )
          .map((item) => ({
            id: item.id,
            name: item.name,
            type: "PROMPT" as const,
            updatedAt: item.updated_at,
            href: `/prompt/${item.id}`,
          })),

        ...(notes.data ?? [])
          .filter(() => Boolean(user))
          .map((item) => ({
            id: item.id,
            name: item.title,
            type: "NOTE" as const,
            updatedAt: item.updated_at,
            href: `/note/${encodeURIComponent(
              item.id,
            )}`,
          })),
      ];

      archiveItems.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() -
          new Date(a.updatedAt).getTime(),
      );

      setItems(archiveItems);
      setLoading(false);
    }

    loadArchive();
  }, []);

  const filteredItems = items.filter(
    (item) => {
      const matchesType =
        activeType === "ALL" ||
        item.type === activeType;

      const normalizedQuery =
        query.trim().toLowerCase();

      const matchesQuery =
        !normalizedQuery ||
        item.name
          .toLowerCase()
          .includes(normalizedQuery);

      return (
        matchesType &&
        matchesQuery
      );
    },
  );

  return (
    <main className="archive-page">
      <div className="archive-container">
        <header className="archive-header">
          <div>
            <span className="eyebrow">
              ALL RECORDS
            </span>

            <h1>ARCHIVE</h1>

            <p>
              MY.ARCHIVE에 저장된 모든 기록을
              한곳에서 확인합니다.
            </p>
          </div>

          <Link
            href="/"
            className="back-button"
          >
            ← HOME
          </Link>
        </header>

        <section className="toolbar">
          <div className="filters">
            {(
              [
                "ALL",
                "CHARACTER",
                "PAIR",
                "PROMPT",
                "NOTE",
              ] as const
            ).map((type) => (
              <button
                key={type}
                type="button"
                className={
                  activeType === type
                    ? "filter active"
                    : "filter"
                }
                onClick={() =>
                  setActiveType(type)
                }
              >
                {type}
              </button>
            ))}
          </div>

          <input
            type="search"
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="SEARCH..."
            className="search-input"
          />
        </section>

        {loading ? (
          <div className="empty-state">
            LOADING...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">
            <span>NO RECORDS</span>
            <p>
              조건에 맞는 기록이 없습니다.
            </p>
          </div>
        ) : (
          <div className="archive-list px-5 sm:px-6">
            {filteredItems.map((item) => {
              const tone = typeStyles[item.type];

              return (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={item.href}
                  className="group flex w-full min-w-0 items-center gap-3 border-b border-[var(--archive-border)] py-3.5 transition hover:px-2 last:border-b-0"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[9px] bg-[var(--archive-hover)] text-[var(--archive-text)]/45">
                    <ArchiveRecentIcon type={item.type} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="min-w-0 truncate text-[13px] font-medium">
                        {item.name}
                      </p>

                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] ${tone.bg} ${tone.text}`}
                      >
                        {item.type}
                      </span>
                    </div>

                    <p className="mt-1 min-w-0 truncate text-[10px] text-[var(--archive-text)]/38">
                      {getArchiveDescription(item.type)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-[10px] text-[var(--archive-text)]/32">
                      {formatDate(item.updatedAt)}
                    </span>

                    <span className="text-[17px] text-[var(--archive-text)]/30 transition group-hover:translate-x-0.5 group-hover:text-[var(--archive-text)]/65">
                      →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        .archive-page {
          min-height: 100vh;
          padding: 28px 24px 80px;
          background: var(--archive-bg);
          color: var(--archive-text);
          transition: background 0.2s ease, color 0.2s ease;
        }

        .archive-container {
          width: min(100%, 1180px);
          margin: 0 auto;
        }

        .archive-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          padding: 10px 2px 24px;
          margin-bottom: 20px;
          border-bottom: 1px solid var(--archive-border);
        }

        .eyebrow {
          display: block;
          margin-bottom: 8px;
          color: var(--archive-muted);
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.18em;
        }

        .archive-header h1 {
          margin: 0;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(38px, 5vw, 58px);
          font-weight: 400;
          line-height: 0.95;
          letter-spacing: -0.045em;
        }

        .archive-header p {
          max-width: 500px;
          margin: 11px 0 0;
          color: var(--archive-muted);
          font-size: 11px;
          line-height: 1.6;
        }

        .back-button {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 34px;
          padding: 0 13px;
          border: 1px solid var(--archive-border);
          border-radius: 999px;
          background: var(--archive-card);
          color: var(--archive-muted);
          text-decoration: none;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.08em;
          transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
        }

        .back-button:hover {
          border-color: var(--archive-accent);
          background: var(--archive-accent);
          color: var(--archive-bg);
        }

        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 12px;
          padding: 2px 0;
        }

        .filters {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }

        .filter {
          height: 29px;
          padding: 0 11px;
          border: 1px solid var(--archive-border);
          border-radius: 999px;
          background: transparent;
          color: var(--archive-muted);
          font-family: inherit;
          font-size: 8px;
          font-weight: 500;
          letter-spacing: 0.07em;
          cursor: pointer;
          transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
        }

        .filter:hover,
        .filter.active {
          border-color: var(--archive-accent);
          background: var(--archive-accent);
          color: var(--archive-bg);
        }

        .search-input {
          width: 200px;
          height: 34px;
          padding: 0 13px;
          border: 1px solid var(--archive-border);
          border-radius: 999px;
          outline: 0;
          background: var(--archive-card);
          color: var(--archive-text);
          font-family: inherit;
          font-size: 9px;
          letter-spacing: 0.07em;
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }

        .search-input:focus {
          border-color: var(--archive-accent);
          box-shadow: 0 0 0 3px var(--archive-hover);
        }

        .search-input::placeholder {
          color: var(--archive-muted);
        }

        .archive-list {
          overflow: hidden;
          border: 1px solid var(--archive-border);
          border-radius: 15px;
          background: color-mix(in srgb, var(--archive-card) 65%, transparent);
        }

        .empty-state {
          display: flex;
          min-height: 320px;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          border: 1px dashed var(--archive-border);
          border-radius: 15px;
          color: var(--archive-muted);
          text-align: center;
          background: color-mix(in srgb, var(--archive-card) 45%, transparent);
        }

        .empty-state span {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.15em;
        }

        .empty-state p {
          margin-top: 8px;
          font-size: 10px;
        }

        @media (max-width: 900px) {
          .archive-page {
            padding: 26px 20px 70px;
          }

          .archive-item {
            min-height: 70px;
          }

          .archive-meta {
            gap: 8px;
            margin-left: 6px;
          }

          .archive-date {
            font-size: 9px;
          }
        }

        @media (max-width: 700px) {
          .archive-page {
            padding: 22px 16px 60px;
          }

          .archive-header {
            align-items: flex-start;
            flex-direction: column;
            gap: 16px;
            padding-bottom: 20px;
          }

          .archive-header h1 {
            font-size: 40px;
          }

          .archive-header p {
            font-size: 10px;
          }

          .toolbar {
            align-items: stretch;
            flex-direction: column;
            gap: 10px;
          }

          .filters {
            gap: 4px;
          }

          .search-input {
            width: 100%;
          }

          .archive-item {
            min-height: 66px;
            gap: 10px;
            padding: 0 13px;
          }

          .archive-item:hover {
            padding-left: 15px;
            padding-right: 11px;
          }

          .archive-icon {
            width: 38px;
            height: 38px;
            flex-basis: 38px;
          }

          .archive-name {
            font-size: 12px;
          }

          .archive-description {
            font-size: 9px;
          }

          .archive-meta {
            gap: 0;
            margin-left: 4px;
          }

          .archive-date {
            display: none;
          }

          .archive-arrow {
            font-size: 16px;
          }
        }
      `}</style>
    </main>
  );
}

function formatDate(dateString: string) {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "ko-KR",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).format(date);
}