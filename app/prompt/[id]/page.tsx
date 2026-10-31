"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

const PROMPT_STORAGE_KEY = "my-archive-prompts";
const IMAGE_DB_NAME = "my-archive-db";
const IMAGE_DB_VERSION = 1;
const IMAGE_STORE = "character-images";

type Prompt = {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  content: string;
  characterId?: string;
  pairId?: string;
  createdAt: string;
  updatedAt: string;
  adultOnly?: boolean;
  isPublic?: boolean;
  imageIds?: string[];
};

function openImageDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB_NAME, IMAGE_DB_VERSION);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getImageFromDB(id?: string): Promise<string> {
  if (!id) return "";

  try {
    const db = await openImageDB();

    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(IMAGE_STORE, "readonly");
      const store = transaction.objectStore(IMAGE_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        const value = request.result;

        const blob =
          value instanceof Blob
            ? value
            : value?.blob instanceof Blob
              ? value.blob
              : null;

        resolve(blob ? URL.createObjectURL(blob) : "");
      };

      request.onerror = () => reject(request.error);
    });
  } catch {
    return "";
  }
}

function formatDate(value: string) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function swapTokens(
  content: string,
  firstToken: string,
  secondToken: string,
) {
  const temporaryToken = "__MY_ARCHIVE_ROLE_SWAP_TEMP__";

  return content
    .split(firstToken)
    .join(temporaryToken)
    .split(secondToken)
    .join(firstToken)
    .split(temporaryToken)
    .join(secondToken);
}

function PromptDetailContent() {
  const params = useParams();
  const router = useRouter();

  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [displayContent, setDisplayContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    let active = true;

    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      if (!active) return;

      setUser(currentUser);
      setAuthChecked(true);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;

        setUser(session?.user ?? null);
        setAuthChecked(true);
      },
    );

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authChecked || !id) return;

    let cancelled = false;

    async function loadPrompt() {
      setLoading(true);

      try {
        const supabase = createClient();

        const { data: row, error } = await supabase
          .from("prompts")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (!error && row) {
          const foundPrompt: Prompt = {
            id: row.id,
            name: row.name,
            category: row.category,
            description: row.description ?? "",
            tags: row.tags ?? [],
            content: row.content ?? "",
            characterId: row.character_id ?? undefined,
            pairId: row.pair_id ?? undefined,
            adultOnly: Boolean(row.adult_only),
            isPublic: Boolean(row.is_public),
            imageIds: Array.isArray(row.image_ids) ? row.image_ids : [],
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };

          if (!cancelled) {
            setPrompt(foundPrompt);
            setDisplayContent(foundPrompt.content);
          }

          const urls = await Promise.all(
            (foundPrompt.imageIds ?? []).map((imageId) =>
              getImageFromDB(imageId),
            ),
          );

          if (!cancelled) {
            setImageUrls(urls.filter(Boolean));
          } else {
            urls.forEach((url) => {
              if (url) URL.revokeObjectURL(url);
            });
          }

          return;
        }

        /*
         * 로그인한 사용자의 이전 localStorage 데이터만
         * 보조적으로 사용한다.
         *
         * 로그아웃 상태에서는 private PROMPT가
         * localStorage를 통해 노출되지 않도록 한다.
         */
        if (user) {
          const stored = localStorage.getItem(PROMPT_STORAGE_KEY);
          const prompts: Prompt[] = stored ? JSON.parse(stored) : [];

          const foundPrompt =
            prompts.find((item) => item.id === id) ?? null;

          if (!cancelled) {
            setPrompt(foundPrompt);
            setDisplayContent(foundPrompt?.content ?? "");
          }
        } else if (!cancelled) {
          setPrompt(null);
          setDisplayContent("");
        }
      } catch (error) {
        console.error("Failed to load prompt:", error);

        /*
         * 네트워크 오류 등으로 Supabase 조회가 실패한 경우에도
         * 로그인한 사용자에게만 localStorage를 보조적으로 사용한다.
         */
        if (user) {
          try {
            const stored = localStorage.getItem(PROMPT_STORAGE_KEY);
            const prompts: Prompt[] = stored ? JSON.parse(stored) : [];

            const foundPrompt =
              prompts.find((item) => item.id === id) ?? null;

            if (!cancelled) {
              setPrompt(foundPrompt);
              setDisplayContent(foundPrompt?.content ?? "");
            }
          } catch {
            if (!cancelled) {
              setPrompt(null);
              setDisplayContent("");
            }
          }
        } else if (!cancelled) {
          setPrompt(null);
          setDisplayContent("");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPrompt();

    return () => {
      cancelled = true;
    };
  }, [id, authChecked]);

  useEffect(() => {
    return () => {
      imageUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [imageUrls]);

  useEffect(() => {
    if (!prompt) {
      setImageUrls([]);
      return;
    }

    let cancelled = false;

    async function loadImages() {
      const urls = await Promise.all(
        (prompt.imageIds ?? []).map((imageId) =>
          getImageFromDB(imageId),
        ),
      );

      if (cancelled) {
        urls.forEach((url) => {
          if (url) URL.revokeObjectURL(url);
        });

        return;
      }

      setImageUrls(urls.filter(Boolean));
    }

    loadImages();

    return () => {
      cancelled = true;
    };
  }, [prompt?.id]);

  function swapCharacterUser() {
    setDisplayContent((currentContent) =>
      swapTokens(currentContent, "{{char}}", "{{user}}"),
    );
  }

  function swapNpcPc() {
    setDisplayContent((currentContent) =>
      swapTokens(currentContent, "NPC", "PC"),
    );
  }

  async function copyPrompt() {
    if (!prompt) return;

    try {
      await navigator.clipboard.writeText(displayContent);

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1400);
    } catch {
      alert("복사하지 못했습니다.");
    }
  }

  function handleEdit() {
    if (!prompt) return;

    if (!user) {
      router.push(
        `/login?redirect=${encodeURIComponent(
          `/prompt?edit=${prompt.id}`,
        )}`,
      );

      return;
    }

    router.push(
      `/prompt?edit=${encodeURIComponent(prompt.id)}`,
    );
  }

  async function deletePrompt() {
    if (!prompt) return;

    if (!user) {
      router.push(
        `/login?redirect=${encodeURIComponent(
          `/prompt/${prompt.id}`,
        )}`,
      );

      return;
    }

    const confirmed = window.confirm(
      `"${prompt.name}" 프롬프트를 삭제할까요?\n삭제하면 되돌릴 수 없습니다.`,
    );

    if (!confirmed) return;

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("prompts")
        .delete()
        .eq("id", prompt.id)
        .eq("user_id", user.id);

      if (error) throw error;

      localStorage.removeItem(PROMPT_STORAGE_KEY);

      router.push("/prompt");
      router.refresh();
    } catch (error) {
      console.error("Failed to delete prompt:", error);
      alert("프롬프트를 삭제하지 못했습니다.");
    }
  }

  if (loading) {
    return (
      <main className="prompt-detail-page">
        <div className="loading">LOADING...</div>
      </main>
    );
  }

  if (!prompt) {
    return (
      <main className="prompt-detail-page">
        <div className="not-found">
          <span>404</span>

          <h1>PROMPT NOT FOUND</h1>

          <p>존재하지 않거나 삭제된 PROMPT입니다.</p>

          <Link href="/prompt" className="back-button">
            ← BACK TO PROMPT
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="prompt-detail-page">
      <div className="detail-container">
        {/* HEADER */}
        <header className="detail-header">
          <Link href="/prompt" className="back-link">
            ← BACK TO PROMPTS
          </Link>

          <div className="actions">
            <button
              type="button"
              className="action-button"
              onClick={handleEdit}
            >
              EDIT
            </button>

            {user && (
              <button
                type="button"
                className="action-button delete-button"
                onClick={deletePrompt}
              >
                DELETE
              </button>
            )}
          </div>
        </header>

        {/* TITLE */}
        <section className="title-section">
          <div className="title-top">
            <div className="category-row">
              <span className="category-pill">
                {prompt.category}
              </span>

              {prompt.adultOnly && (
                <span className="adult-pill">
                  18+ · 성인용
                </span>
              )}

              {prompt.isPublic && (
                <span className="public-pill">
                  PUBLIC
                </span>
              )}
            </div>
          </div>

          <h1>{prompt.name}</h1>

          {prompt.description && (
            <p className="description">
              {prompt.description}
            </p>
          )}

          <div className="meta-row">
            <span>
              UPDATED · {formatDate(prompt.updatedAt)}
            </span>

            {prompt.characterId && (
              <span>CHARACTER LINKED</span>
            )}

            {prompt.pairId && (
              <span>PAIR LINKED</span>
            )}
          </div>

          {prompt.tags.length > 0 && (
            <div className="tags">
              {prompt.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
          )}
        </section>

                        {/* CONTENT */}
        <section className="content-section">
          <div className="section-heading">
            <div className="section-title">
              <span className="section-number">01</span>

              <h2>PROMPT CONTENT</h2>
            </div>

            <button
              type="button"
              className="copy-button"
              onClick={copyPrompt}
            >
              {copied ? "COPIED" : "COPY PROMPT"}
            </button>
          </div>

          {/* ROLE SWAP */}
          <div className="role-swap">
            <div className="role-swap-info">
              <span className="role-swap-title">
                ROLE SWAP
              </span>

              <span className="role-swap-description">
                화면에만 임시로 적용됩니다.
              </span>
            </div>

            <div className="role-swap-buttons">
              <button
                type="button"
                onClick={swapCharacterUser}
              >
                {"{{char}}"} ↔ {"{{user}}"}
              </button>

              <button
                type="button"
                onClick={swapNpcPc}
              >
                NPC ↔ PC
              </button>
            </div>
          </div>

          {/* PROMPT TEXT */}
          <div className="prompt-box">
            <pre>
              {displayContent || "EMPTY PROMPT"}
            </pre>
          </div>
        </section>

        {/* IMAGE ATTACHMENTS */}
        {imageUrls.length > 0 && (
          <section className="image-section">
            <div className="section-heading">
              <div className="section-title">
                <span className="section-number">02</span>

                <h2>IMAGE ATTACHMENTS</h2>
              </div>

              <span className="image-count">
                {imageUrls.length} IMAGES
              </span>
            </div>

            <div className="image-gallery">
              {imageUrls.map((url, index) => (
                <button
                  key={`${url}-${index}`}
                  type="button"
                  className="image-gallery-item"
                  onClick={() => setSelectedImage(url)}
                >
                  <img
                    src={url}
                    alt={`${prompt.name} attachment ${index + 1}`}
                  />

                  <span>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* IMAGE LIGHTBOX */}
      {selectedImage && (
        <div
          className="image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          onClick={() => setSelectedImage(null)}
        >
          <button
            type="button"
            className="lightbox-close"
            onClick={() => setSelectedImage(null)}
            aria-label="Close image"
          >
            ×
          </button>

          <img
            src={selectedImage}
            alt={prompt.name}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}

      <style jsx>{`
        .prompt-detail-page {
          min-height: 100vh;
          background: var(--archive-bg);
          color: var(--archive-text);
          padding: 42px 48px 100px;
        }

        .detail-container {
          width: 100%;
          max-width: 1180px;
          margin: 0 auto;
        }

        /* HEADER */

        .detail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 48px;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          min-height: 34px;
          padding: 0 13px;
          border: 1px solid var(--archive-border);
          border-radius: 999px;
          background: var(--archive-card);
          color: var(--archive-muted);
          text-decoration: none;
          font-size: 8px;
          font-weight: 600;
          letter-spacing: 0.08em;
          transition:
            background 0.18s ease,
            color 0.18s ease,
            border-color 0.18s ease;
        }

        .back-link:hover {
          border-color: var(--archive-border);
          background: var(--archive-hover);
          color: var(--archive-text);
        }

        .actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .action-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;

          min-width: 58px;
          height: 30px;
          padding: 0 13px;

          border: 1px solid var(--archive-border);
          border-radius: 999px;

          background: var(--archive-card);
          color: var(--archive-muted);

          font-family: inherit;
          font-size: 7px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: 0.08em;

          cursor: pointer;

          transition:
            background 0.18s ease,
            color 0.18s ease,
            border-color 0.18s ease,
            transform 0.18s ease;

          appearance: none;
          -webkit-appearance: none;
        }

        .action-button:hover {
          border-color: var(--archive-text);
          background: var(--archive-text);
          color: var(--archive-card);
          transform: translateY(-1px);
        }

        .action-button:active {
          transform: translateY(0);
        }

        .delete-button {
          border-color: var(--archive-border);
          color: var(--archive-muted);
        }

        .delete-button:hover {
          border-color: var(--archive-accent);
          background: var(--archive-accent);
          color: var(--archive-card);
        }

        /* TITLE */

        .title-section {
          margin-bottom: 64px;
          padding: 30px 32px 32px;
          border: 1px solid var(--archive-border);
          border-radius: 18px;
          background: var(--archive-card);
          box-shadow: 0 8px 28px rgba(30, 30, 30, 0.025);
        }

        .title-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 22px;
        }

        .category-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
        }

        .category-pill,
        .adult-pill {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 0 9px;
          border-radius: 999px;
          font-size: 7px;
          font-weight: 600;
          letter-spacing: 0.04em;
        }

        .category-pill {
          background: var(--archive-soft);
          color: var(--archive-muted);
        }

        .adult-pill {
          background: var(--archive-soft);
          color: var(--archive-accent);
        }

        .public-pill {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 0 9px;
          border-radius: 999px;
          background: var(--archive-soft);
          color: var(--archive-muted);
          font-size: 7px;
          font-weight: 600;
          letter-spacing: 0.06em;
        }

        .title-section h1 {
          max-width: 900px;
          margin: 0;
          font-size: clamp(38px, 6vw, 76px);
          line-height: 0.98;
          font-weight: 500;
          letter-spacing: -0.055em;
          overflow-wrap: anywhere;
        }

        .description {
          max-width: 720px;
          margin: 22px 0 0;
          color: var(--archive-muted);
          font-size: 12px;
          line-height: 1.8;
        }

        .meta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 24px;
        }

        .meta-row span {
          display: inline-flex;
          align-items: center;
          min-height: 23px;
          padding: 0 9px;
          border: 1px solid var(--archive-border);
          border-radius: 999px;
          color: var(--archive-muted);
          background: var(--archive-soft);
          font-size: 7px;
          letter-spacing: 0.08em;
        }

        .tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 16px;
        }

        .tags span {
          color: var(--archive-muted);
          font-size: 8px;
        }

        /* IMAGE ATTACHMENTS */

        .image-section {
          margin-bottom: 64px;
        }

        .image-count {
          color: var(--archive-muted);
          font-size: 7px;
          letter-spacing: 0.08em;
        }

        .image-gallery {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 10px;
        }

        .image-gallery-item {
          position: relative;
          display: block;
          overflow: hidden;
          width: 100%;
          aspect-ratio: 1 / 1;
          padding: 0;
          border: 1px solid var(--archive-border);
          border-radius: 14px;
          background: var(--archive-soft);
          cursor: zoom-in;
        }

        .image-gallery-item img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.25s ease;
        }

        .image-gallery-item:hover img {
          transform: scale(1.025);
        }

        .image-gallery-item > span {
          position: absolute;
          left: 9px;
          bottom: 8px;
          color: var(--archive-card);
          font-size: 7px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-shadow: 0 1px 6px rgba(0, 0, 0, 0.45);
        }

        /* CONTENT */

        .content-section {
          margin-bottom: 40px;
        }

        .section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 14px;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .section-number {
          color: var(--archive-muted);
          font-size: 8px;
          font-weight: 600;
          letter-spacing: 0.08em;
        }

        .section-title h2 {
          margin: 0;
          color: var(--archive-text);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.1em;
        }

        .copy-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 29px;
          padding: 0 12px;
          border: 1px solid var(--archive-border);
          border-radius: 999px;
          background: var(--archive-card);
          color: var(--archive-muted);
          font-family: inherit;
          font-size: 7px;
          font-weight: 600;
          letter-spacing: 0.07em;
          cursor: pointer;
          transition:
            background 0.18s ease,
            color 0.18s ease;
          appearance: none;
          -webkit-appearance: none;
        }

        .copy-button:hover {
          background: var(--archive-text);
          color: var(--archive-card);
          border-color: var(--archive-text);
        }

        /* ROLE SWAP */

        .role-swap {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 10px;
          padding: 14px 17px;
          border: 1px solid var(--archive-border);
          border-radius: 14px;
          background: var(--archive-card);
        }

        .role-swap-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .role-swap-title {
          color: var(--archive-muted);
          font-size: 8px;
          font-weight: 600;
          letter-spacing: 0.09em;
        }

        .role-swap-description {
          color: var(--archive-muted);
          font-size: 8px;
        }

        .role-swap-buttons {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 6px;
        }

        .role-swap-buttons button {
          min-height: 28px;
          padding: 0 11px;
          border: 1px solid var(--archive-border);
          border-radius: 999px;
          background: var(--archive-soft);
          color: var(--archive-muted);
          font-family: inherit;
          font-size: 7px;
          font-weight: 600;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition:
            background 0.18s ease,
            color 0.18s ease;
          appearance: none;
          -webkit-appearance: none;
        }

        .role-swap-buttons button:hover {
          background: var(--archive-text);
          color: var(--archive-card);
          border-color: var(--archive-text);
        }

        /* PROMPT BOX */

        .prompt-box {
          overflow: hidden;
          border: 1px solid var(--archive-border);
          border-radius: 16px;
          background: var(--archive-card);
          box-shadow: 0 8px 28px rgba(30, 30, 30, 0.025);
        }

        .prompt-box pre {
          margin: 0;
          padding: 26px;
          color: var(--archive-text);
          font-family: var(--font-geist-mono), monospace;
          font-size: 11px;
          line-height: 1.9;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        /* LIGHTBOX */

        .image-lightbox {
          position: fixed;
          inset: 0;
          z-index: 300;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
          background: rgba(0, 0, 0, 0.88);
          cursor: zoom-out;
        }

        .image-lightbox > img {
          max-width: 92vw;
          max-height: 90vh;
          object-fit: contain;
          cursor: default;
        }

        .lightbox-close {
          position: fixed;
          top: 18px;
          right: 24px;
          border: 0;
          background: transparent;
          color: var(--archive-card);
          font-size: 30px;
          font-weight: 200;
          cursor: pointer;
        }

        /* LOADING */

        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 70vh;
          color: var(--archive-muted);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.14em;
        }

        /* 404 */

        .not-found {
          max-width: 1180px;
          margin: 0 auto;
          padding-top: 80px;
        }

        .not-found > span {
          color: var(--archive-muted);
          font-size: 9px;
          letter-spacing: 0.12em;
        }

        .not-found h1 {
          margin: 14px 0 8px;
          font-size: 42px;
          font-weight: 500;
          letter-spacing: -0.05em;
        }

        .not-found p {
          margin: 0 0 22px;
          color: var(--archive-muted);
          font-size: 11px;
        }

        .back-button {
          display: inline-flex;
          align-items: center;
          min-height: 34px;
          padding: 0 13px;
          border: 1px solid var(--archive-border);
          border-radius: 999px;
          background: var(--archive-card);
          color: var(--archive-muted);
          text-decoration: none;
          font-size: 8px;
          font-weight: 600;
          letter-spacing: 0.07em;
          transition:
            background 0.18s ease,
            color 0.18s ease,
            border-color 0.18s ease;
        }

        .back-button:hover {
          background: var(--archive-text);
          border-color: var(--archive-text);
          color: var(--archive-card);
        }

        /* TABLET */

        @media (max-width: 900px) {
          .prompt-detail-page {
            padding: 34px 30px 80px;
          }

          .title-section {
            padding: 26px;
          }

          .title-section h1 {
            font-size: clamp(36px, 8vw, 62px);
          }
        }

        /* MOBILE */

        @media (max-width: 600px) {
          .prompt-detail-page {
            padding: 24px 18px 60px;
          }

          .detail-header {
            align-items: flex-start;
            margin-bottom: 32px;
          }

          .back-link {
            min-height: 32px;
            padding: 0 11px;
            font-size: 7px;
          }

          .actions {
            gap: 4px;
          }

          .action-button {
            min-width: 54px;
            height: 29px;
            padding: 0 11px;
            font-size: 7px;
          }

          .title-section {
            margin-bottom: 42px;
            padding: 22px 19px 24px;
            border-radius: 15px;
          }

          .title-top {
            margin-bottom: 18px;
          }

          .title-section h1 {
            font-size: clamp(32px, 10vw, 48px);
          }

          .description {
            margin-top: 16px;
            font-size: 11px;
          }

          .meta-row {
            margin-top: 18px;
          }

          .section-heading {
            align-items: flex-start;
          }

          .copy-button {
            flex-shrink: 0;
          }

          .image-gallery {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .image-lightbox {
            padding: 18px;
          }

          .role-swap {
            align-items: flex-start;
            flex-direction: column;
            padding: 13px 14px;
          }

          .role-swap-buttons {
            width: 100%;
            justify-content: flex-start;
          }

          .prompt-box {
            border-radius: 13px;
          }

          .prompt-box pre {
            padding: 20px;
            font-size: 10px;
            line-height: 1.8;
          }

          .not-found {
            padding-top: 50px;
          }

          .not-found h1 {
            font-size: 32px;
          }
        }
      `}</style>
    </main>
  );
}

function PromptDetailFallback() {
  return (
    <main className="prompt-detail-page">
      <div className="loading">LOADING...</div>
    </main>
  );
}

export default function PromptDetailPage() {
  return (
    <Suspense fallback={<PromptDetailFallback />}>
      <PromptDetailContent />
    </Suspense>
  );
}