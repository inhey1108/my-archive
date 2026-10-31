"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type Note = {
  id: string;
  userId: string;
  title: string;
  content: string;
  tags: string[];
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function NoteDetailContent() {
  const params = useParams();
  const router = useRouter();

  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [note, setNote] = useState<Note | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function loadNote() {
      setLoading(true);

      try {
        const supabase = createClient();

        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (cancelled) return;

        setUser(currentUser);

        /*
         * NOTE 상세 페이지는 로그인한 사용자만 접근 가능
         *
         * 로그아웃 상태
         * → 로그인 페이지로 이동
         *
         * 로그인 상태
         * → 본인이 작성한 NOTE만 조회
         */
        if (!currentUser) {
          const redirect = `/note/${id}`;

          router.replace(
            `/login?redirect=${encodeURIComponent(redirect)}`,
          );

          return;
        }

        const { data, error } = await supabase
          .from("notes")
          .select("*")
          .eq("id", id)
          .eq("user_id", currentUser.id)
          .single();

        if (error) {
          throw error;
        }

        if (!cancelled && data) {
          setNote({
            id: data.id,
            userId: data.user_id,
            title: data.title,
            content: data.content ?? "",
            tags: data.tags ?? [],
            isPrivate: Boolean(data.is_private),
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          });
        }
      } catch (error) {
        console.error(
          "NOTE 상세 데이터를 불러오지 못했습니다.",
          error,
        );

        if (!cancelled) {
          setNote(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadNote();

    return () => {
      cancelled = true;
    };
  }, [id, router]);

  function handleEdit() {
    if (!note) return;

    if (!user) {
      const redirect = `/note?edit=${encodeURIComponent(note.id)}`;

      router.push(
        `/login?redirect=${encodeURIComponent(redirect)}`,
      );

      return;
    }

    router.push(`/note?edit=${encodeURIComponent(note.id)}`);
  }

  async function handleDelete() {
    if (!note) return;

    if (!user) {
      const redirect = `/note/${note.id}`;

      router.push(
        `/login?redirect=${encodeURIComponent(redirect)}`,
      );

      return;
    }

    const confirmed = window.confirm(
      `"${note.title}" NOTE를 삭제할까요?\n삭제하면 되돌릴 수 없습니다.`,
    );

    if (!confirmed) return;

    const supabase = createClient();

    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", note.id)
      .eq("user_id", user.id);

    if (error) {
      console.error("NOTE 삭제에 실패했습니다.", error);
      alert("NOTE 삭제에 실패했습니다.");
      return;
    }

    router.push("/note");
  }

  if (loading) {
    return (
      <main className="note-detail-page">
        <div className="loading">LOADING...</div>
      </main>
    );
  }

  if (!note) {
    return (
      <main className="note-detail-page">
        <div className="not-found">
          <span>404</span>

          <h1>NOTE NOT FOUND</h1>

          <p>
            존재하지 않거나 접근할 수 없는 NOTE입니다.
          </p>

          <Link href="/note" className="back-button">
            BACK TO NOTE
          </Link>
        </div>

        <style jsx>{`
          .note-detail-page {
            min-height: 100vh;
            padding: 60px 48px;
            background: var(--archive-bg);
            color: var(--archive-text);
          }

          .not-found {
            min-height: 70vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
          }

          .not-found span {
            font-size: 12px;
            letter-spacing: 0.2em;
            color: var(--archive-muted);
          }

          .not-found h1 {
            margin: 12px 0;
            font-size: 32px;
            font-weight: 400;
          }

          .not-found p {
            color: var(--archive-muted);
            font-size: 12px;
          }

          .back-button {
            margin-top: 28px;
            border: 1px solid var(--archive-text);
            padding: 12px 18px;
            color: var(--archive-text);
            text-decoration: none;
            font-size: 10px;
            letter-spacing: 0.12em;
          }

          .back-button:hover {
            background: var(--archive-text);
            color: var(--archive-card);
          }
        `}</style>
      </main>
    );
  }

  const isOwner = Boolean(user && user.id === note.userId);

  return (
    <main className="note-detail-page">
      <div className="detail-container">
        <header className="detail-header">
          <Link href="/note" className="back-link">
            ← NOTE
          </Link>

          <div className="actions">
            <button
              type="button"
              className="action-button"
              onClick={handleEdit}
            >
              EDIT
            </button>

            {isOwner && (
              <button
                type="button"
                className="action-button"
                onClick={handleDelete}
              >
                DELETE
              </button>
            )}
          </div>
        </header>

        <section className="title-section">
          <div className="top-meta">
            <p className="eyebrow">PERSONAL NOTE</p>

            <span
              className={
                note.isPrivate
                  ? "visibility private"
                  : "visibility public"
              }
            >
              {note.isPrivate
                ? "PRIVATE · ONLY YOU"
                : "PUBLIC · OPEN NOTE"}
            </span>
          </div>

          <h1>{note.title}</h1>

          <div className="meta">
            <span>
              UPDATED · {formatDate(note.updatedAt)}
            </span>

            <span>
              CREATED · {formatDate(note.createdAt)}
            </span>
          </div>

          {note.tags.length > 0 && (
            <div className="tags">
              {note.tags.map((tag, index) => (
                <span key={`${tag}-${index}`}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="content-section">
          <div className="section-heading">
            <span>01</span>
            <h2>NOTE CONTENT</h2>
          </div>

          <article>
            {note.content || "내용 없음"}
          </article>
        </section>
      </div>

      <style jsx>{`
        .note-detail-page {
          min-height: 100vh;
          background: var(--archive-bg);
          color: var(--archive-text);
          padding: 42px 48px 100px;
        }

        .detail-container {
          max-width: 1100px;
          margin: 0 auto;
        }

        .detail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 24px;
          border-bottom: 1px solid var(--archive-text);
        }

        .back-link {
          color: var(--archive-muted);
          text-decoration: none;
          font-size: 10px;
          letter-spacing: 0.12em;
        }

        .back-link:hover {
          color: var(--archive-text);
        }

        .actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .action-button {
          appearance: none;
          -webkit-appearance: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 84px;
          height: 42px;
          box-sizing: border-box;
          border: 1px solid var(--archive-text);
          outline: none;
          border-radius: 0;
          background: var(--archive-card);
          color: var(--archive-text);
          padding: 0 18px;
          margin: 0;
          font-family: inherit;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.14em;
          line-height: 1;
          text-align: center;
          cursor: pointer;
        }

        .action-button:hover {
          background: var(--archive-text);
          color: var(--archive-card);
        }

        .title-section {
          padding: 58px 0 50px;
        }

        .top-meta {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }

        .eyebrow {
          margin: 0;
          color: var(--archive-muted);
          font-size: 9px;
          letter-spacing: 0.2em;
        }

        .visibility {
          display: inline-flex;
          align-items: center;
          min-height: 22px;
          padding: 0 8px;
          border: 1px solid var(--archive-border);
          font-size: 8px;
          letter-spacing: 0.1em;
        }

        .visibility.public {
          color: var(--archive-muted);
          background: var(--archive-card);
        }

        .visibility.private {
          color: var(--archive-text);
          background: var(--archive-soft);
          border-color: var(--archive-muted);
        }

        h1 {
          margin: 0;
          max-width: 900px;
          font-size: clamp(42px, 7vw, 78px);
          line-height: 0.98;
          font-weight: 400;
          letter-spacing: -0.05em;
          word-break: break-word;
        }

        .meta {
          display: flex;
          gap: 18px;
          margin-top: 22px;
          color: var(--archive-muted);
          font-size: 9px;
          letter-spacing: 0.1em;
          flex-wrap: wrap;
        }

        .tags {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 18px;
        }

        .tags span {
          color: var(--archive-muted);
          font-size: 10px;
        }

        .content-section {
          border-top: 1px solid var(--archive-text);
          padding-top: 22px;
        }

        .section-heading {
          display: grid;
          grid-template-columns: 36px 1fr;
          align-items: baseline;
          gap: 12px;
          margin-bottom: 20px;
        }

        .section-heading span {
          color: var(--archive-muted);
          font-size: 9px;
        }

        .section-heading h2 {
          margin: 0;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.15em;
        }

        article {
          min-height: 420px;
          border: 1px solid var(--archive-border);
          background: var(--archive-card);
          padding: 28px;
          white-space: pre-wrap;
          word-break: break-word;
          color: var(--archive-text);
          font-size: 12px;
          line-height: 2;
        }

        .loading {
          min-height: 70vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--archive-muted);
          font-size: 10px;
          letter-spacing: 0.15em;
        }

        @media (max-width: 650px) {
          .note-detail-page {
            padding: 28px 18px 60px;
          }

          .detail-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .actions {
            width: 100%;
          }

          .action-button {
            flex: 1;
          }

          .title-section {
            padding-top: 42px;
          }

          article {
            padding: 20px;
          }
        }
      `}</style>
    </main>
  );
}

export default function NoteDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="note-detail-page-fallback">
          <div>LOADING...</div>

          <style jsx>{`
            .note-detail-page-fallback {
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              background: var(--archive-bg);
              color: var(--archive-muted);
              font-size: 10px;
              letter-spacing: 0.15em;
            }
          `}</style>
        </main>
      }
    >
      <NoteDetailContent />
    </Suspense>
  );
}