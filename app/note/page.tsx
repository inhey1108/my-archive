"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Note = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  isPrivate: boolean;
};

const STORAGE_KEY = "my-archive-notes";

export default function NotePage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [user, setUser] = useState<
    import("@supabase/supabase-js").User | null
  >(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("ALL");

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function loadNotes() {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (cancelled) return;

        setUser(currentUser);
        setAuthChecked(true);

        // NOTE 목록은 로그인 사용자만 접근 가능
        if (!currentUser) {
          window.location.href = `/login?redirect=${encodeURIComponent(
            "/note",
          )}`;
          return;
        }

        const { data: rows, error } = await supabase
          .from("notes")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("updated_at", { ascending: false });

        if (error) throw error;

        const mapped: Note[] = (rows ?? []).map((row) => ({
          id: row.id,
          title: row.title,
          content: row.content ?? "",
          tags: row.tags ?? [],
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          isPrivate: Boolean(row.is_private),
        }));

        if (!cancelled) {
          setNotes(mapped);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
        }
      } catch (error) {
        console.error("NOTE 데이터를 불러오지 못했습니다.", error);

        if (!cancelled) {
          setNotes([]);
          setAuthChecked(true);
        }
      }
    }

    loadNotes();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;

      const nextUser = session?.user ?? null;

      setUser(nextUser);
      setAuthChecked(true);

      if (!nextUser) {
        window.location.href = `/login?redirect=${encodeURIComponent(
          "/note",
        )}`;
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const persist = (next: Note[]) => {
    setNotes(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const resetEditor = () => {
    setTitle("");
    setContent("");
    setTags("");
    setIsPrivate(false);
    setEditingId(null);
    setIsEditing(false);
  };

  const openNew = () => {
    if (!user) {
      window.location.href = `/login?redirect=${encodeURIComponent(
        "/note?add=1",
      )}`;
      return;
    }

    setTitle("");
    setContent("");
    setTags("");
    setIsPrivate(false);
    setEditingId(null);
    setIsEditing(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const openEdit = (note: Note) => {
    if (!user) {
      window.location.href = `/login?redirect=${encodeURIComponent(
        `/note?edit=${note.id}`,
      )}`;
      return;
    }

    setTitle(note.title);
    setContent(note.content);
    setTags(note.tags.join(", "));
    setIsPrivate(note.isPrivate);
    setEditingId(note.id);
    setIsEditing(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    if (!authChecked || !user) return;

    const params = new URLSearchParams(window.location.search);
    const addMode = params.get("add");
    const editId = params.get("edit");

    if (addMode === "1") {
      openNew();
      window.history.replaceState({}, "", "/note");
      return;
    }

    if (editId && notes.length > 0) {
      const targetNote = notes.find((note) => note.id === editId);

      if (targetNote) {
        openEdit(targetNote);
        window.history.replaceState({}, "", "/note");
      }
    }
  }, [authChecked, user, notes]);

  const saveNote = async () => {
    if (!title.trim()) {
      alert("메모 제목을 입력해주세요.");
      return;
    }

    const now = new Date().toISOString();

    const parsedTags = Array.from(
      new Set(
        tags
          .split(",")
          .map((tag) => tag.trim().replace(/^#/, ""))
          .filter(Boolean),
      ),
    );

    const supabase = createClient();

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      alert("로그인이 필요합니다.");
      return;
    }

    if (editingId) {
      const existing = notes.find((note) => note.id === editingId);

      const updatedNote: Note = {
        ...(existing ?? {
          id: editingId,
          createdAt: now,
          updatedAt: now,
          title: "",
          content: "",
          tags: [],
          isPrivate: false,
        }),
        title: title.trim(),
        content,
        tags: parsedTags,
        updatedAt: now,
        isPrivate,
      };

      const { error } = await supabase
        .from("notes")
        .update({
          title: updatedNote.title,
          content: updatedNote.content,
          tags: updatedNote.tags,
          is_private: updatedNote.isPrivate,
          updated_at: now,
        })
        .eq("id", editingId)
        .eq("user_id", currentUser.id);

      if (error) {
        console.error("NOTE 저장에 실패했습니다.", error);
        alert("NOTE 저장에 실패했습니다.");
        return;
      }

      persist(
        notes.map((note) =>
          note.id === editingId ? updatedNote : note,
        ),
      );
    } else {
      const newNote: Note = {
        id: crypto.randomUUID(),
        title: title.trim(),
        content,
        tags: parsedTags,
        createdAt: now,
        updatedAt: now,
        isPrivate,
      };

      const { error } = await supabase.from("notes").insert({
        id: newNote.id,
        user_id: currentUser.id,
        title: newNote.title,
        content: newNote.content,
        tags: newNote.tags,
        is_private: newNote.isPrivate,
        created_at: newNote.createdAt,
        updated_at: newNote.updatedAt,
      });

      if (error) {
        console.error("NOTE 생성에 실패했습니다.", error);
        alert("NOTE 저장에 실패했습니다.");
        return;
      }

      persist([newNote, ...notes]);
    }

    resetEditor();
  };

  const deleteNote = async (id: string) => {
    if (!user) {
      window.location.href = `/login?redirect=${encodeURIComponent(
        `/note?edit=${id}`,
      )}`;
      return;
    }

    if (!confirm("이 메모를 삭제할까요?")) return;

    const supabase = createClient();

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      alert("로그인이 필요합니다.");
      return;
    }

    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", id)
      .eq("user_id", currentUser.id);

    if (error) {
      console.error("NOTE 삭제에 실패했습니다.", error);
      alert("NOTE 삭제에 실패했습니다.");
      return;
    }

    persist(notes.filter((note) => note.id !== id));

    if (editingId === id) {
      resetEditor();
    }
  };

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();

    notes.forEach((note) => {
      note.tags.forEach((tag) => tagSet.add(tag));
    });

    return Array.from(tagSet).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [notes]);

  useEffect(() => {
    if (activeTag !== "ALL" && !allTags.includes(activeTag)) {
      setActiveTag("ALL");
    }
  }, [activeTag, allTags]);

  const filteredNotes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return notes.filter((note) => {
      const matchesTag =
        activeTag === "ALL" || note.tags.includes(activeTag);

      if (!matchesTag) return false;

      if (!normalizedQuery) return true;

      return (
        note.title.toLowerCase().includes(normalizedQuery) ||
        note.content.toLowerCase().includes(normalizedQuery) ||
        note.tags.some((tag) =>
          tag.toLowerCase().includes(normalizedQuery),
        )
      );
    });
  }, [notes, query, activeTag]);

  const formatDate = (value: string) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  // 인증 확인 중
  if (!authChecked) {
    return (
      <main className="note-page">
        <div className="loading">LOADING...</div>

        <style jsx>{`
          .note-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--archive-bg);
            color: var(--archive-muted);
          }

          .loading {
            font-size: 10px;
            letter-spacing: 0.18em;
          }
        `}</style>
      </main>
    );
  }

  // 로그아웃 상태에서 redirect가 처리되기 전 화면 방지
  if (!user) {
    return (
      <main className="note-page">
        <div className="loading">REDIRECTING...</div>

        <style jsx>{`
          .note-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--archive-bg);
            color: var(--archive-muted);
          }

          .loading {
            font-size: 10px;
            letter-spacing: 0.18em;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="note-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">06 / NOTE</p>

          <h1>NOTE</h1>

          <p className="subtitle">
            아이디어, 작업 메모, 캐릭터 설정 등 자유롭게 기록하는 개인 노트.
          </p>
        </div>

        {!isEditing && (
          <button
            className="primary-button"
            onClick={openNew}
          >
            + NEW NOTE
          </button>
        )}
      </header>

      {isEditing ? (
        <section className="editor">
          <div className="editor-header">
            <div>
              <p className="eyebrow">NOTE EDITOR</p>

              <h2>
                {editingId ? "EDIT NOTE" : "NEW NOTE"}
              </h2>
            </div>

            <button
              className="text-button"
              onClick={resetEditor}
            >
              CANCEL
            </button>
          </div>

          <label>
            <span>TITLE</span>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="메모 제목"
              autoFocus
            />
          </label>

          <label>
            <span>TAGS</span>

            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="아이디어, 개발, 캐릭터"
            />

            <small>쉼표로 구분해서 입력</small>
          </label>

          <div className="privacy-row">
            <div>
              <span className="privacy-label">
                VISIBILITY
              </span>

              <p>
                {isPrivate
                  ? "비공개 · 나만 볼 수 있는 NOTE"
                  : "공개 · 누구나 볼 수 있는 NOTE"}
              </p>
            </div>

            <button
              type="button"
              className={`privacy-toggle ${
                isPrivate ? "private" : ""
              }`}
              onClick={() =>
                setIsPrivate((current) => !current)
              }
            >
              <span className="privacy-dot" />

              {isPrivate ? "PRIVATE" : "PUBLIC"}
            </button>
          </div>

          <label>
            <span>CONTENT</span>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="자유롭게 기록하세요."
              spellCheck={false}
            />
          </label>

          <div className="editor-actions">
  {editingId && (
    <button
      className="delete-button"
      style={{ borderRadius: "999px" }}
      onClick={() => deleteNote(editingId)}
    >
      DELETE
    </button>
  )}

  <div className="editor-actions-right">
    <button
      className="cancel-button"
      style={{ borderRadius: "999px" }}
      onClick={resetEditor}
    >
      CANCEL
    </button>

              <button
                className="save-button"
                onClick={saveNote}
              >
                SAVE NOTE
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="tools">
            <div className="search-box">
              <span>SEARCH</span>

              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="메모 검색..."
              />
            </div>

            {allTags.length > 0 && (
              <div className="tag-filter">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    className={
                      activeTag === tag ? "active" : ""
                    }
                    onClick={() =>
                      setActiveTag((current) =>
                        current === tag ? "ALL" : tag,
                      )
                    }
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="notes-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">PERSONAL NOTES</p>

                <h2>MY NOTES</h2>
              </div>

              <span>
                {String(filteredNotes.length).padStart(2, "0")}
              </span>
            </div>

            {filteredNotes.length === 0 ? (
              <div className="empty-state">
                {notes.length === 0 ? (
                  <>
                    <p>아직 작성한 메모가 없습니다.</p>

                    <span>
                      생각나는 내용을 자유롭게 기록해보세요.
                    </span>
                  </>
                ) : (
                  <>
                    <p>검색 결과가 없습니다.</p>

                    <span>
                      검색어나 태그를 다시 확인해보세요.
                    </span>
                  </>
                )}
              </div>
            ) : (
              <div className="note-grid">
                {filteredNotes.map((note) => (
                  <article
                    key={note.id}
                    className="note-card"
                    onClick={() => {
                      window.location.href = `/note/${encodeURIComponent(
                        note.id,
                      )}`;
                    }}
                  >
                    <div className="note-card-top">
                      <div>
                        <h3>{note.title}</h3>

                        <p>
                          {formatDate(note.updatedAt)}
                        </p>
                      </div>

                      <div className="card-actions">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(note);
                          }}
                        >
                          EDIT
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNote(note.id);
                          }}
                        >
                          DELETE
                        </button>
                      </div>
                    </div>

                    <div className="visibility-badge">
                      <span>
                        {note.isPrivate
                          ? "PRIVATE"
                          : "PUBLIC"}
                      </span>
                    </div>

                    {note.tags.length > 0 && (
                      <div className="tag-row">
                        {note.tags.map((tag) => (
                          <span key={tag}>#{tag}</span>
                        ))}
                      </div>
                    )}

                    <div className="note-content">
                      {note.content || "내용 없음"}
                    </div>

                    <div className="card-footer">
                      <span>VIEW NOTE</span>

                      {note.createdAt !== note.updatedAt && (
                        <span>UPDATED</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <style jsx>{`
        .note-page {
          min-height: 100vh;
          padding: 48px 44px 80px;
          color: var(--archive-text);
          background: var(--archive-bg);
        }

        .page-header,
        .editor-header,
        .section-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
        }

        .eyebrow {
          margin: 0 0 10px;
          color: var(--archive-muted);
          font-size: 9px;
          letter-spacing: 0.2em;
        }

        h1,
        h2,
        h3,
        p {
          margin: 0;
        }

        h1 {
          font-size: clamp(48px, 7vw, 88px);
          font-weight: 400;
          line-height: 0.95;
          letter-spacing: -0.04em;
        }

        h2 {
          font-size: 30px;
          font-weight: 400;
          letter-spacing: -0.04em;
        }

        .subtitle {
          max-width: 620px;
          margin-top: 18px;
          color: var(--archive-muted);
          font-size: 12px;
          line-height: 1.8;
        }

        .primary-button,
        .save-button {
          border: 1px solid var(--archive-text);
          border-radius: 999px;
          background: var(--archive-text);
          color: var(--archive-card);
          padding: 13px 18px;
          font-size: 10px;
          letter-spacing: 0.14em;
          cursor: pointer;
        }

        .primary-button:hover,
        .save-button:hover {
          background: var(--archive-card);
          color: var(--archive-text);
        }

        .tools {
          display: grid;
          grid-template-columns: minmax(260px, 360px) 1fr;
          gap: 24px;
          align-items: end;
          margin-top: 52px;
          border-top: 1px solid var(--archive-text);
          padding-top: 20px;
        }

        .search-box span {
          display: block;
          margin-bottom: 8px;
          color: var(--archive-muted);
          font-size: 9px;
          letter-spacing: 0.15em;
        }

        .search-box input {
          width: 100%;
          border: 0;
          border-bottom: 1px solid var(--archive-border);
          background: transparent;
          padding: 10px 0;
          outline: none;
          font: inherit;
          font-size: 12px;
        }

        .search-box input:focus {
          border-color: var(--archive-text);
        }

        .tag-filter {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 6px;
        }

        .tag-filter button {
          border: 1px solid var(--archive-border);
          background: transparent;
          padding: 7px 10px;
          color: var(--archive-muted);
          cursor: pointer;
          font-size: 9px;
        }

        .tag-filter button:hover,
        .tag-filter button.active {
          border-color: var(--archive-text);
          background: var(--archive-text);
          color: var(--archive-card);
        }

        .notes-section {
          margin-top: 62px;
          border-top: 1px solid var(--archive-text);
          padding-top: 24px;
        }

        .section-heading > span {
          color: var(--archive-muted);
          font-size: 11px;
          letter-spacing: 0.12em;
        }

        .note-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-top: 20px;
        }

        .note-card {
          min-width: 0;
          min-height: 300px;
          border: 1px solid var(--archive-border);
          background: var(--archive-card);
          padding: 22px;
          cursor: pointer;
          transition:
            border-color 0.15s,
            transform 0.15s;
        }

        .note-card:hover {
          border-color: var(--archive-text);
          transform: translateY(-2px);
        }

        .note-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
        }

        .note-card h3 {
          font-size: 20px;
          font-weight: 400;
          letter-spacing: -0.03em;
        }

        .note-card-top p {
          margin-top: 7px;
          color: var(--archive-muted);
          font-size: 9px;
          letter-spacing: 0.08em;
        }

        .card-actions {
          display: flex;
          flex-shrink: 0;
          gap: 12px;
        }

        .card-actions button,
        .text-button {
          border: 0;
          background: transparent;
          color: var(--archive-muted);
          cursor: pointer;
          font-size: 9px;
          letter-spacing: 0.1em;
        }

        .card-actions button:hover,
        .text-button:hover {
          color: var(--archive-text);
        }

        .tag-row {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 16px;
        }

        .tag-row span {
          color: var(--archive-muted);
          font-size: 9px;
        }

        .note-content {
          height: 180px;
          margin-top: 16px;
          overflow-y: auto;
          border-top: 1px solid var(--archive-border);
          border-bottom: 1px solid var(--archive-border);
          padding: 15px 4px 15px 0;
          white-space: pre-wrap;
          color: var(--archive-muted);
          font-size: 11px;
          line-height: 1.8;
        }

        .card-footer {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-top: 14px;
          color: var(--archive-muted);
          font-size: 8px;
          letter-spacing: 0.12em;
        }

        .empty-state {
          margin-top: 20px;
          padding: 70px 20px;
          border: 1px dashed var(--archive-border);
          text-align: center;
        }

        .empty-state p {
          margin-bottom: 8px;
          font-size: 13px;
        }

        .empty-state span {
          color: var(--archive-muted);
          font-size: 10px;
        }

        .editor {
          max-width: 1000px;
          margin-top: 44px;
          border: 1px solid var(--archive-border);
          background: var(--archive-card);
          padding: 28px;
        }

        .editor > label {
          display: block;
          margin-top: 24px;
        }

        .editor label > span {
          display: block;
          margin-bottom: 8px;
          color: var(--archive-muted);
          font-size: 9px;
          letter-spacing: 0.15em;
        }

        .editor label small {
          display: block;
          margin-top: 7px;
          color: var(--archive-muted);
          font-size: 9px;
        }

        .editor input,
        .editor textarea {
          width: 100%;
          border: 1px solid var(--archive-border);
          background: var(--archive-card);
          padding: 12px;
          color: var(--archive-text);
          outline: none;
          font: inherit;
        }

        .editor input:focus,
        .editor textarea:focus {
          border-color: var(--archive-text);
        }

        .editor textarea {
          min-height: 500px;
          resize: vertical;
          line-height: 1.8;
        }

        .privacy-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-top: 24px;
          padding: 16px 0;
          border-top: 1px solid var(--archive-border);
          border-bottom: 1px solid var(--archive-border);
        }

        .privacy-label {
          display: block;
          color: var(--archive-muted);
          font-size: 9px;
          letter-spacing: 0.15em;
        }

        .privacy-row p {
          margin-top: 6px;
          color: var(--archive-muted);
          font-size: 10px;
        }

        .privacy-toggle {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--archive-border);
          background: var(--archive-card);
          padding: 9px 12px;
          color: var(--archive-muted);
          cursor: pointer;
          font-size: 9px;
          letter-spacing: 0.12em;
        }

        .privacy-toggle.private {
          border-color: var(--archive-text);
          color: var(--archive-text);
        }

        .privacy-dot {
          width: 6px;
          height: 6px;
          border: 1px solid currentColor;
          border-radius: 50%;
        }

        .privacy-toggle.private .privacy-dot {
          background: var(--archive-text);
        }

        .visibility-badge {
          margin-top: 14px;
          display: flex;
          justify-content: flex-end;
        }

        .visibility-badge span {
          border: 1px solid var(--archive-border);
          padding: 5px 7px;
          color: var(--archive-muted);
          font-size: 7px;
          letter-spacing: 0.12em;
        }

        .visibility-badge span:first-child {
          color: var(--archive-muted);
        }

        .editor-actions {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          margin-top: 20px;
        }

        .editor-actions-right {
          display: flex;
          gap: 8px;
        }

        .delete-button,
        .cancel-button {
          border: 1px solid var(--archive-border);
          background: var(--archive-card);
          padding: 12px 16px;
          color: var(--archive-muted);
          cursor: pointer;
          font-size: 9px;
          letter-spacing: 0.1em;
        }

        .delete-button:hover {
          border-color: var(--archive-text);
          color: var(--archive-text);
        }

        .cancel-button:hover {
          border-color: var(--archive-text);
          color: var(--archive-text);
        }

        @media (max-width: 900px) {
          .tools,
          .note-grid {
            grid-template-columns: 1fr;
          }

          .tag-filter {
            justify-content: flex-start;
          }
        }

        @media (max-width: 650px) {
          .note-page {
            padding: 32px 18px 60px;
          }

          .page-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .note-card-top {
            flex-direction: column;
          }

          .privacy-row {
            align-items: flex-start;
            flex-direction: column;
          }

          .editor-actions {
            flex-direction: column;
          }

          .editor-actions-right {
            justify-content: flex-end;
          }
        }
      `}</style>
    </main>
  );
}