"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RecentItem = {
  id: string;
  name: string;
  type: "CHARACTER" | "PAIR" | "PROMPT" | "NOTE";
  updatedAt: string;
  href: string;
};


const typeStyles: Record<RecentItem["type"], { bg: string; text: string }> = {
  CHARACTER: { bg: "bg-[#eeebf8]", text: "text-[#71689b]" },
  PAIR: { bg: "bg-[#f5e9eb]", text: "text-[#9a707a]" },
  PROMPT: { bg: "bg-[#e9eef7]", text: "text-[#667a9d]" },
  NOTE: { bg: "bg-[#eaf0e8]", text: "text-[#6c806b]" },
};

export default function Home() {
  const [counts, setCounts] = useState({
    characters: 0,
    pairs: 0,
    prompts: 0,
    notes: 0,
  });

  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<import("@supabase/supabase-js").User | null>(null);
  const [decorImage, setDecorImage] = useState("");
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const savedImage = window.localStorage.getItem("my-archive-home-decor-image");

    if (savedImage) {
      setDecorImage(savedImage);
    }
  }, []);

  useEffect(() => {
    if (decorImage) {
      window.localStorage.setItem("my-archive-home-decor-image", decorImage);
    } else {
      window.localStorage.removeItem("my-archive-home-decor-image");
    }
  }, [decorImage]);

  useEffect(() => {
    async function loadDashboard() {
      const supabase = createClient();

      const [
        characterCount,
        pairCount,
        promptCount,
        noteCount,
        characters,
        pairs,
        prompts,
        notes,
      ] = await Promise.all([
        supabase.from("characters").select("id", { count: "exact", head: true }),
        supabase.from("pairs").select("id", { count: "exact", head: true }),
        supabase.from("prompts").select("id", { count: "exact", head: true }),
        supabase.from("notes").select("id", { count: "exact", head: true }),
        supabase
          .from("characters")
          .select("id, name, updated_at")
          .order("updated_at", { ascending: false })
          .limit(5),
        supabase
          .from("pairs")
          .select("id, name, updated_at")
          .order("updated_at", { ascending: false })
          .limit(5),
        supabase
          .from("prompts")
          .select("id, name, updated_at")
          .order("updated_at", { ascending: false })
          .limit(5),
        supabase
          .from("notes")
          .select("id, title, updated_at")
          .order("updated_at", { ascending: false })
          .limit(5),
      ]);

      setCounts({
        characters: characterCount.count ?? 0,
        pairs: pairCount.count ?? 0,
        prompts: promptCount.count ?? 0,
        notes: noteCount.count ?? 0,
      });

      const recent: RecentItem[] = [
        ...(characters.data ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          type: "CHARACTER" as const,
          updatedAt: item.updated_at,
          href: `/character/${item.id}`,
        })),
        ...(pairs.data ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          type: "PAIR" as const,
          updatedAt: item.updated_at,
          href: `/pair/${item.id}`,
        })),
        ...(prompts.data ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          type: "PROMPT" as const,
          updatedAt: item.updated_at,
          href: `/prompt/${item.id}`,
        })),
        ...(notes.data ?? []).map((item) => ({
          id: item.id,
          name: item.title,
          type: "NOTE" as const,
          updatedAt: item.updated_at,
          href: `/note/${encodeURIComponent(item.id)}`,
        })),
      ];

      recent.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );

      setRecentItems(recent.slice(0, 8));
      setLoading(false);
    }

    loadDashboard();
  }, []);

  function handleDecorImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const maxSize = 1400;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.round(image.width * scale);
        const height = Math.round(image.height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) return;

        context.drawImage(image, 0, 0, width, height);
        setDecorImage(canvas.toDataURL("image/jpeg", 0.82));
      };

      image.src = String(reader.result);
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function clearDecorImage() {
    setDecorImage("");
  }

  return (
    <main className="min-h-screen bg-[var(--archive-bg)] text-[var(--archive-text)] transition-colors">
      <div className="min-h-screen w-full">
        <header className="w-full border-b border-[var(--archive-border)] bg-[var(--archive-bg)]/90 backdrop-blur">
          <div className="flex h-[68px] items-center justify-between px-5 sm:px-8 lg:h-[76px] lg:px-8 xl:px-10">
            <div className="lg:hidden" />
            <div className="hidden lg:block" />
            <div className="flex items-center gap-3">
            <div className="flex h-9 w-[190px] items-center gap-2 rounded-full border border-[var(--archive-border)] bg-[color-mix(in_srgb,var(--archive-card)_55%,transparent)] px-3 text-[11px] text-[var(--archive-text)]/40">
              <SearchIcon />
              <span>검색하기...</span>
            </div>
            <Link
              href="/settings"
              aria-label="Settings"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--archive-border)] bg-[color-mix(in_srgb,var(--archive-card)_70%,transparent)] text-[var(--archive-text)]/55 hover:text-[var(--archive-text)]"
            >
              <UserIcon />
            </Link>
          </div>
          </div>


        </header>

        <section className="w-full px-4 py-6 sm:px-5 lg:px-5 lg:py-7 xl:px-6 2xl:px-7">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:gap-4">
              <DashboardCard
                title="CHARACTER"
                count={loading ? "—" : String(counts.characters)}
                href="/character"
                tone="purple"
                icon={<CharacterIcon />}
              />
              <DashboardCard
                title="PAIR"
                count={loading ? "—" : String(counts.pairs)}
                href="/pair"
                tone="rose"
                icon={<PairIcon />}
              />
              <DashboardCard
                title="PROMPT"
                count={loading ? "—" : String(counts.prompts)}
                href="/prompt"
                tone="blue"
                icon={<PromptIcon />}
              />
              <DashboardCard
                title="NOTE"
                count={loading ? "—" : String(counts.notes)}
                href="/note"
                tone="green"
                icon={<NoteIcon />}
              />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
              <section className="min-w-0 rounded-[15px] border border-[var(--archive-border)] bg-[color-mix(in_srgb,var(--archive-card)_65%,transparent)] p-5 sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <ClockIcon />
                      <h2 className="font-serif text-[20px]">RECENT</h2>
                    </div>
                    <p className="mt-1 text-[10px] text-[var(--archive-text)]/35">
                      최근에 수정한 항목을 확인해보세요.
                    </p>
                  </div>
                  <span className="text-[10px] tracking-[0.08em] text-[var(--archive-text)]/35">
                    LATEST UPDATED
                  </span>
                </div>

                {loading ? (
                  <div className="flex h-64 items-center justify-center text-[12px] text-[var(--archive-text)]/30">
                    Loading...
                  </div>
                ) : recentItems.length === 0 ? (
                  <div className="flex h-64 items-center justify-center text-[12px] text-[var(--archive-text)]/30">
                    No recent items
                  </div>
                ) : (
                  <div className="divide-y divide-[#252525]/10">
                    {recentItems.map((item) => {
                      const tone = typeStyles[item.type];
                      return (
                        <Link
                          key={`${item.type}-${item.id}`}
                          href={item.href}
                          className="group flex items-center gap-3 py-3.5 transition hover:px-2"
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[9px] bg-[var(--archive-hover)] text-[var(--archive-text)]/45">
                            <RecentIcon type={item.type} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate text-[13px] font-medium">{item.name}</p>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] ${tone.bg} ${tone.text}`}>
                                {item.type}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-[10px] text-[var(--archive-text)]/38">
                              {getRecentDescription(item.type)}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <span className="text-[10px] text-[var(--archive-text)]/32">
                              {formatRelativeDate(item.updatedAt)}
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

                <Link
                  href="/archive"
                  className="mt-4 flex h-9 items-center justify-center rounded-[8px] border border-[var(--archive-border)] text-[10px] tracking-[0.08em] text-[var(--archive-text)]/50 transition hover:bg-[var(--archive-accent)] hover:text-white"
                >
                  VIEW ARCHIVE →
                </Link>
              </section>

              <section className="min-w-0 rounded-[15px] border border-[var(--archive-border)] bg-[color-mix(in_srgb,var(--archive-card)_65%,transparent)] p-5 sm:p-6">
                <div className="mb-5 flex items-center gap-2">
                  <PlusIcon />
                  <div>
                    <h2 className="font-serif text-[20px]">QUICK CREATE</h2>
                    <p className="mt-1 text-[10px] text-[var(--archive-text)]/35">
                      바로 새로운 기록을 만들어보세요.
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
  <QuickButton
    label="CHARACTER"
    description="새로운 캐릭터를 만들어보세요."
    href={
      user
        ? "/character?add=1"
        : `/login?redirect=${encodeURIComponent("/character?add=1")}`
    }
    tone="purple"
    icon={<CharacterIcon />}
  />

  <QuickButton
    label="PAIR"
    description="새로운 페어를 만들어보세요."
    href={
      user
        ? "/pair?add=1"
        : `/login?redirect=${encodeURIComponent("/pair?add=1")}`
    }
    tone="rose"
    icon={<PairIcon />}
  />

  <QuickButton
    label="PROMPT"
    description="새로운 프롬프트를 만들어보세요."
    href={
      user
        ? "/prompt?add=1"
        : `/login?redirect=${encodeURIComponent("/prompt?add=1")}`
    }
    tone="blue"
    icon={<PromptIcon />}
  />

  <QuickButton
    label="NOTE"
    description="새로운 노트를 작성해보세요."
    href={
      user
        ? "/note?add=1"
        : `/login?redirect=${encodeURIComponent("/note?add=1")}`
    }
    tone="green"
    icon={<NoteIcon />}
  />
</div>

                <div className="mt-7 border-t border-[var(--archive-border)] pt-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[9px] tracking-[0.16em] text-[color-mix(in_srgb,var(--archive-text)_35%,transparent)]">
                      HOME DECOR
                    </span>
                  </div>

                  <div className="group relative overflow-hidden rounded-[12px] border border-dashed border-[var(--archive-border)] bg-[var(--archive-soft)]">
                    {decorImage ? (
                      <>
                        <img
                          src={decorImage}
                          alt="Home decoration"
                          className="h-[210px] w-full object-cover"
                        />
                        <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 transition group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            className="rounded-full bg-[var(--archive-card)] px-2 py-0.5 text-[8px] text-[color-mix(in_srgb,var(--archive-text)_65%,transparent)] shadow-sm"
                          >
                            CHANGE
                          </button>
                          <button
                            type="button"
                            onClick={clearDecorImage}
                            className="rounded-full bg-[var(--archive-card)] px-2 py-0.5 text-[8px] text-[color-mix(in_srgb,var(--archive-text)_65%,transparent)] shadow-sm"
                          >
                            REMOVE
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="flex h-[210px] w-full flex-col items-center justify-center text-[color-mix(in_srgb,var(--archive-text)_35%,transparent)] transition hover:bg-[var(--archive-card)]"
                      >
                        <span className="text-[24px] font-light">+</span>
                        <span className="mt-2 text-[9px] tracking-[0.12em]">
                          ADD IMAGE
                        </span>
                        <span className="mt-1 text-[8px] text-[color-mix(in_srgb,var(--archive-text)_25%,transparent)]">
                          HOME에 원하는 이미지를 넣어보세요.
                        </span>
                      </button>
                    )}
                  </div>

                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleDecorImageChange}
                  />
                </div>
              </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function DashboardCard({
  title,
  count,
  href,
  tone,
  icon,
}: {
  title: string;
  count: string;
  href: string;
  tone: "purple" | "rose" | "blue" | "green";
  icon: React.ReactNode;
}) {
  const styles = {
    purple: "bg-[var(--archive-soft)] text-[var(--archive-text)]",
    rose: "bg-[var(--archive-soft)] text-[var(--archive-text)]",
    blue: "bg-[var(--archive-soft)] text-[var(--archive-text)]",
    green: "bg-[var(--archive-soft)] text-[var(--archive-text)]",
  };

  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-[13px] border border-[var(--archive-border)] bg-[color-mix(in_srgb,var(--archive-card)_65%,transparent)] px-5 py-4 transition hover:-translate-y-0.5 hover:bg-[var(--archive-card)]"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${styles[tone]}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] tracking-[0.12em] text-[var(--archive-text)]/45">{title}</span>
        <span className="mt-1 block font-serif text-[29px] leading-none">{count}</span>
      </span>
      <span className="text-[17px] text-[var(--archive-text)]/35 transition group-hover:translate-x-0.5 group-hover:text-[var(--archive-text)]/70">→</span>
    </Link>
  );
}

function QuickButton({
  label,
  description,
  href,
  tone,
  icon,
}: {
  label: string;
  description: string;
  href: string;
  tone: "purple" | "rose" | "blue" | "green";
  icon: React.ReactNode;
}) {
  const styles = {
    purple: "bg-[var(--archive-soft)] text-[var(--archive-text)]",
    rose: "bg-[var(--archive-soft)] text-[var(--archive-text)]",
    blue: "bg-[var(--archive-soft)] text-[var(--archive-text)]",
    green: "bg-[var(--archive-soft)] text-[var(--archive-text)]",
  };

  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-[11px] border border-[var(--archive-border)] bg-[color-mix(in_srgb,var(--archive-card)_45%,transparent)] px-3.5 py-3 transition hover:bg-[var(--archive-card)]"
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${styles[tone]}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium tracking-[0.05em]">+ {label}</span>
        <span className="mt-1 block truncate text-[9px] text-[var(--archive-text)]/38">{description}</span>
      </span>
      <span className="text-[16px] text-[var(--archive-text)]/30 transition group-hover:translate-x-0.5">→</span>
    </Link>
  );
}

function getRecentDescription(type: RecentItem["type"]) {
  switch (type) {
    case "CHARACTER":
      return "캐릭터 설정과 기록을 확인해보세요.";
    case "PAIR":
      return "두 사람의 관계와 이야기를 확인해보세요.";
    case "PROMPT":
      return "저장해둔 프롬프트를 확인해보세요.";
    case "NOTE":
      return "작성해둔 생각과 기록을 확인해보세요.";
  }
}

function formatRelativeDate(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.6]"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;
}

function UserIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.5]"><circle cx="12" cy="8" r="3.2" /><path d="M5.5 19c.9-3.3 3-5 6.5-5s5.6 1.7 6.5 5" /></svg>;
}

function HomeIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.5]"><path d="m4 10 8-6 8 6v9H4z" /><path d="M9.5 19v-5h5v5" /></svg>;
}

function ProfileIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.5]"><circle cx="12" cy="8" r="3" /><path d="M5.5 19c.8-3.2 2.9-5 6.5-5s5.7 1.8 6.5 5" /></svg>;
}

function CharacterIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.5]"><circle cx="12" cy="7.5" r="3" /><path d="M5.5 19c.8-3.3 3-5 6.5-5s5.7 1.7 6.5 5" /></svg>;
}

function PairIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.5]"><circle cx="8" cy="8" r="2.7" /><circle cx="16" cy="8" r="2.7" /><path d="M3.8 18c.6-3 2.1-4.5 4.2-4.5s3.6 1.5 4.2 4.5M11.8 18c.6-3 2.1-4.5 4.2-4.5s3.6 1.5 4.2 4.5" /></svg>;
}

function PromptIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.5]"><path d="M6 3.5h8l4 4V20H6z" /><path d="M14 3.5V8h4M9 12h6M9 15h6" /></svg>;
}

function NoteIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.5]"><path d="M5 4h14v16H5z" /><path d="M8.5 9h7M8.5 12h7M8.5 15h4" /></svg>;
}

function ClockIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.5] text-[var(--archive-text)]/60"><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></svg>;
}

function PlusIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.4] text-[var(--archive-text)]/60"><path d="M12 5v14M5 12h14" /></svg>;
}

function RecentIcon({ type }: { type: RecentItem["type"] }) {
  if (type === "CHARACTER") return <CharacterIcon />;
  if (type === "PAIR") return <PairIcon />;
  if (type === "PROMPT") return <PromptIcon />;
  return <NoteIcon />;
}
