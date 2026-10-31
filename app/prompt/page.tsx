"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

const PROMPT_STORAGE_KEY = "my-archive-prompts";
const CHARACTER_STORAGE_KEY = "my-archive-characters";
const PAIR_STORAGE_KEY = "my-archive-pairs";
const IMAGE_DB_NAME = "my-archive-db";
const IMAGE_DB_VERSION = 1;
const IMAGE_STORE = "character-images";

const CATEGORIES = [
  "캐릭터 행동 지침",
  "말투/문체 프롬프트",
  "세계관 프롬프트",
  "관계성 프롬프트",
  "상황/에피소드 프롬프트",
  "명령어",
  "이미지 생성 프롬프트",
  "유저용 설정문",
  "캐릭터용 설정문",
  "범용 프롬프트",
];

type Character = {
  id: string;
  name: string;
  image?: string;
};

type Pair = {
  id: string;
  name: string;
  characterAName?: string;
  characterBName?: string;
};

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

function makeId() {
  return crypto.randomUUID();
}

function savePrompts(prompts: Prompt[]) {
  localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify(prompts));
}

function openImageDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB_NAME, IMAGE_DB_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveImageToDB(blob: Blob): Promise<string> {
  const id = crypto.randomUUID();
  const db = await openImageDB();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(IMAGE_STORE, "readwrite");
    const store = transaction.objectStore(IMAGE_STORE);
    const value = store.keyPath ? { id, blob } : { blob };
    const request = store.keyPath ? store.put(value) : store.put(value, id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  return id;
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

async function deleteImageFromDB(id?: string) {
  if (!id) return;

  try {
    const db = await openImageDB();

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(IMAGE_STORE, "readwrite");
      const store = transaction.objectStore(IMAGE_STORE);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // 이미지가 이미 삭제되었거나 IndexedDB를 사용할 수 없는 경우 무시
  }
}

const QUICK_INSERTS = [
  { label: "{{char}}", text: "{{char}}" },
  { label: "{{user}}", text: "{{user}}" },
  { label: "NPC", text: "NPC" },
  { label: "PC", text: "PC" },
  { label: "OOC:", text: "OOC:" },
  {
    label: "현재 에피소드 종료",
    text: "현재 에피소드를 종료. 완전히 별개의 새로운 에피소드 시작.",
  },
  {
    label: "au 에피소드",
    text: "현재 에피소드 종료. 완전히 별개의 어나더 유니버스 에피소드 시작.",
  },
  {
    label: "이전 채팅 미영향",
    text: "이전 채팅에 영향받지 않음.",
  },
] as const;

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

export default function PromptPage() {
  const router = useRouter();

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [content, setContent] = useState("");
  const [characterId, setCharacterId] = useState("");
  const [pairId, setPairId] = useState("");
  const [adultOnly, setAdultOnly] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  const [imageIds, setImageIds] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);

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
    if (!authChecked) return;

    let cancelled = false;

    async function loadArchive() {
      try {
        const supabase = createClient();
        const storedCharacters = localStorage.getItem(CHARACTER_STORAGE_KEY);
        const storedPairs = localStorage.getItem(PAIR_STORAGE_KEY);
        const storedPrompts = localStorage.getItem(PROMPT_STORAGE_KEY);

        if (!cancelled) {
          setCharacters(storedCharacters ? JSON.parse(storedCharacters) : []);
          setPairs(storedPairs ? JSON.parse(storedPairs) : []);
        }

        // PROMPT 목록은 로그인한 본인만 볼 수 있다.
        if (!user) {
          if (!cancelled) setPrompts([]);
          router.replace(`/login?redirect=${encodeURIComponent("/prompt")}`);
          return;
        }

        const { data: rows, error } = await supabase
          .from("prompts")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        if (error) throw error;

        if ((!rows || rows.length === 0) && user && storedPrompts) {
          const localPrompts: Prompt[] = JSON.parse(storedPrompts);

          if (localPrompts.length > 0) {
            const payload = localPrompts.map((prompt) => ({
              id: prompt.id,
              user_id: user.id,
              name: prompt.name,
              category: prompt.category,
              description: prompt.description ?? "",
              tags: prompt.tags ?? [],
              content: prompt.content ?? "",
              character_id: prompt.characterId || null,
              pair_id: prompt.pairId || null,
              adult_only: Boolean(prompt.adultOnly),
              is_public: Boolean(prompt.isPublic),
              image_ids: prompt.imageIds ?? [],
              created_at: prompt.createdAt || new Date().toISOString(),
              updated_at: prompt.updatedAt || new Date().toISOString(),
            }));

            const { error: migrationError } = await supabase
              .from("prompts")
              .upsert(payload, { onConflict: "id" });

            if (migrationError) throw migrationError;
          }
        }

        if (!cancelled) {
          const mapped: Prompt[] = (rows ?? []).map((row) => ({
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
          }));

          // RLS 적용 전/네트워크 오류 등으로 공개 조회가 불가능한 경우에만
          // 기존 localStorage 데이터를 보조적으로 사용한다.
          if (mapped.length > 0) {
            setPrompts(mapped);
            savePrompts(mapped);
          } else if (storedPrompts) {
            setPrompts(JSON.parse(storedPrompts));
          } else {
            setPrompts([]);
          }
        }
      } catch (error) {
        console.error("Failed to load prompt archive:", error);

        if (!cancelled) {
          if (user) {
            try {
              const storedPrompts = localStorage.getItem(PROMPT_STORAGE_KEY);
              setPrompts(storedPrompts ? JSON.parse(storedPrompts) : []);
            } catch {
              setPrompts([]);
            }
          } else {
            setPrompts([]);
          }
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    loadArchive();

    return () => {
      cancelled = true;
    };
  }, [authChecked, user]);

  const filteredPrompts = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return prompts.filter((prompt) => {
      const categoryMatch =
        filterCategory === "ALL" || prompt.category === filterCategory;

      if (!categoryMatch) return false;
      if (!normalized) return true;

      const characterName =
        characters.find((character) => character.id === prompt.characterId)
          ?.name ?? "";

      const pairName =
        pairs.find((pair) => pair.id === prompt.pairId)?.name ?? "";

      const haystack = [
        prompt.name,
        prompt.category,
        prompt.description,
        prompt.content,
        prompt.tags.join(" "),
        characterName,
        pairName,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [prompts, characters, pairs, query, filterCategory]);

  function resetForm() {
    setName("");
    setCategory(CATEGORIES[0]);
    setDescription("");
    setTagsInput("");
    setContent("");
    setCharacterId("");
    setPairId("");
    setAdultOnly(false);
    setIsPublic(false);
    setImageIds([]);
    setImageUrls((current) => {
      current.forEach((url) => URL.revokeObjectURL(url));
      return [];
    });
    setNewImageFiles([]);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setEditingId(null);
    setIsAdding(false);
  }

  function openAddForm(authUser: User | null = user) {
    if (!authUser) {
      router.push(`/login?redirect=${encodeURIComponent("/prompt?add=1")}`);
      return;
    }

    resetForm();
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    if (!authChecked) return;

    const params = new URLSearchParams(window.location.search);
    const add = params.get("add");
    const edit = params.get("edit");

    if (add === "1") {
      if (!user) {
        router.replace(`/login?redirect=${encodeURIComponent("/prompt?add=1")}`);
        return;
      }

      openAddForm(user);
      window.history.replaceState({}, "", "/prompt");
      return;
    }

    if (edit) {
      if (!user) {
        router.replace(
          `/login?redirect=${encodeURIComponent(`/prompt?edit=${edit}`)}`,
        );
        return;
      }

      const target = prompts.find((prompt) => prompt.id === edit);
      if (target) {
        openEditForm(target, user);
        window.history.replaceState({}, "", "/prompt");
      }
    }
  }, [authChecked, user, prompts]);

  function insertQuickText(textToInsert: string) {
    const textarea = promptTextareaRef.current;

    if (!textarea) {
      setContent((current) => current + textToInsert);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextContent =
      content.slice(0, start) + textToInsert + content.slice(end);

    setContent(nextContent);

    requestAnimationFrame(() => {
      textarea.focus();
      const nextCursor = start + textToInsert.length;
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }
    function openEditForm(prompt: Prompt, authUser: User | null = user) {
    if (!authUser) {
      router.push(
        `/login?redirect=${encodeURIComponent(`/prompt?edit=${prompt.id}`)}`,
      );
      return;
    }

    setName(prompt.name);
    setCategory(prompt.category || CATEGORIES[0]);
    setDescription(prompt.description || "");
    setTagsInput(prompt.tags.join(", "));
    setContent(prompt.content || "");
    setCharacterId(prompt.characterId || "");
    setPairId(prompt.pairId || "");
    setAdultOnly(Boolean(prompt.adultOnly));
    setIsPublic(Boolean(prompt.isPublic));

    const existingImageIds = prompt.imageIds ?? [];
    setImageIds(existingImageIds);
    setNewImageFiles([]);

    if (imageInputRef.current) imageInputRef.current.value = "";

    Promise.all(existingImageIds.map((imageId) => getImageFromDB(imageId))).then(
      (urls) => {
        setImageUrls((current) => {
          current.forEach((url) => URL.revokeObjectURL(url));
          return urls.filter(Boolean);
        });
      },
    );

    setEditingId(prompt.id);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleImageFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (files.length === 0) return;

    setNewImageFiles((current) => [...current, ...files]);

    const previews = files.map((file) => URL.createObjectURL(file));
    setImageUrls((current) => [...current, ...previews]);

    event.target.value = "";
  }

  function removeImageAt(index: number) {
    setImageUrls((current) => {
      const url = current[index];
      if (url) URL.revokeObjectURL(url);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });

    if (index < imageIds.length) {
      const imageId = imageIds[index];
      setImageIds((current) => current.filter((_, itemIndex) => itemIndex !== index));
      void deleteImageFromDB(imageId);
    } else {
      const newFileIndex = index - imageIds.length;
      setNewImageFiles((current) =>
        current.filter((_, itemIndex) => itemIndex !== newFileIndex),
      );
    }
  }

  async function persistPromptImages(existingIds: string[]) {
    const savedNewIds = await Promise.all(
      newImageFiles.map((file) => saveImageToDB(file)),
    );
    return [...existingIds, ...savedNewIds];
  }

  async function savePrompt() {
    if (!name.trim() && !content.trim()) {
      alert("PROMPT 이름 또는 내용을 입력해주세요.");
      return;
    }

    const now = new Date().toISOString();
    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim().replace(/^#/, ""))
      .filter(Boolean)
      .filter((tag, index, array) => array.indexOf(tag) === index);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("로그인이 필요합니다.");
      return;
    }

    if (editingId) {
      const existing = prompts.find((prompt) => prompt.id === editingId);

      const updatedPrompt: Prompt = {
        ...(existing ?? {
          id: editingId,
          createdAt: now,
          updatedAt: now,
          tags: [],
          description: "",
          content: "",
          category: CATEGORIES[0],
          name: "",
        }),
        name: name.trim() || "UNTITLED PROMPT",
        category,
        description: description.trim(),
        tags,
        content,
        characterId: characterId || undefined,
        pairId: pairId || undefined,
        adultOnly,
        isPublic,
        imageIds,
        updatedAt: now,
      };

      const finalImageIds = await persistPromptImages(imageIds);

      const { error } = await supabase
        .from("prompts")
        .update({
          name: updatedPrompt.name,
          category: updatedPrompt.category,
          description: updatedPrompt.description,
          tags: updatedPrompt.tags,
          content: updatedPrompt.content,
          character_id: updatedPrompt.characterId || null,
          pair_id: updatedPrompt.pairId || null,
          adult_only: updatedPrompt.adultOnly ?? false,
          is_public: updatedPrompt.isPublic ?? false,
          image_ids: finalImageIds,
          updated_at: now,
        })
        .eq("id", editingId)
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to update prompt:", error);
        alert("PROMPT 저장에 실패했습니다.");
        return;
      }

      updatedPrompt.imageIds = finalImageIds;

      const updated = prompts.map((prompt) =>
        prompt.id === editingId ? updatedPrompt : prompt,
      );

      setPrompts(updated);
      savePrompts(updated);
    } else {
      const newPrompt: Prompt = {
        id: makeId(),
        name: name.trim() || "UNTITLED PROMPT",
        category,
        description: description.trim(),
        tags,
        content,
        characterId: characterId || undefined,
        pairId: pairId || undefined,
        adultOnly,
        isPublic,
        imageIds: [],
        createdAt: now,
        updatedAt: now,
      };

      const finalImageIds = await persistPromptImages([]);
      newPrompt.imageIds = finalImageIds;

      const { error } = await supabase.from("prompts").insert({
        id: newPrompt.id,
        user_id: user.id,
        name: newPrompt.name,
        category: newPrompt.category,
        description: newPrompt.description,
        tags: newPrompt.tags,
        content: newPrompt.content,
        character_id: newPrompt.characterId || null,
        pair_id: newPrompt.pairId || null,
        adult_only: newPrompt.adultOnly ?? false,
        is_public: newPrompt.isPublic ?? false,
        image_ids: newPrompt.imageIds ?? [],
        created_at: newPrompt.createdAt,
        updated_at: newPrompt.updatedAt,
      });

      if (error) {
        console.error("Failed to create prompt:", error);
        alert("PROMPT 저장에 실패했습니다.");
        return;
      }

      const updated = [newPrompt, ...prompts];
      setPrompts(updated);
      savePrompts(updated);
    }

    resetForm();
  }

  async function deletePrompt(prompt: Prompt) {
    const confirmed = window.confirm(
      `"${prompt.name}" 프롬프트를 삭제할까요?\n삭제하면 되돌릴 수 없습니다.`,
    );

    if (!confirmed) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("로그인이 필요합니다.");
      return;
    }

    const { error } = await supabase
      .from("prompts")
      .delete()
      .eq("id", prompt.id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to delete prompt:", error);
      alert("PROMPT 삭제에 실패했습니다.");
      return;
    }

    await Promise.all((prompt.imageIds ?? []).map((imageId) => deleteImageFromDB(imageId)));

    const updated = prompts.filter((item) => item.id !== prompt.id);
    setPrompts(updated);
    savePrompts(updated);
  }

  async function copyPrompt(prompt: Prompt) {
    try {
      await navigator.clipboard.writeText(prompt.content);
      setCopiedId(prompt.id);
      window.setTimeout(() => setCopiedId(null), 1400);
    } catch {
      alert("복사하지 못했습니다.");
    }
  }

  function getCharacterName(id?: string) {
    if (!id) return "";
    return characters.find((character) => character.id === id)?.name ?? "";
  }

  function getPairName(id?: string) {
    if (!id) return "";
    return pairs.find((pair) => pair.id === id)?.name ?? "";
  }

  if (!loaded) {
    return (
      <main className="prompt-page">
        <div className="loading">LOADING...</div>
      </main>
    );
  }

  return (
    <main className="prompt-page">
      <div className="prompt-container">
        <header className="prompt-header">
          <div>
            <span className="eyebrow">PERSONAL ARCHIVE</span>
            <h1>PROMPT</h1>
            <p>AI CHAT에 실제로 사용하는 프롬프트를 보관하고 관리하세요.</p>
          </div>

          {!isAdding && (
            <button type="button" className="add-button" onClick={() => openAddForm()}>
              + ADD PROMPT
            </button>
          )}
        </header>

        {isAdding && (
          <section className="editor">
            <div className="editor-header">
              <div>
                <span className="editor-eyebrow">
                  {editingId ? "EDIT PROMPT" : "NEW PROMPT"}
                </span>
                <h2>{editingId ? "PROMPT EDITOR" : "CREATE PROMPT"}</h2>
              </div>

              <button type="button" className="cancel-button" onClick={resetForm}>
                CANCEL
              </button>
            </div>

            <div className="editor-grid">
              <div className="editor-side">
                <label>
                  <span>PROMPT NAME</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="예. 캐릭터 몰입 강화 프롬프트"
                  />
                </label>

                <label>
                  <span>CATEGORY</span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    {CATEGORIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="adult-option">
                  <span>CONTENT RATING</span>
                  <button
                    type="button"
                    className={`adult-toggle ${adultOnly ? "active" : ""}`}
                    onClick={() => setAdultOnly((value) => !value)}
                    aria-pressed={adultOnly}
                  >
                    <span className="adult-toggle-box">
                      {adultOnly ? "✓" : ""}
                    </span>
                    <span className="adult-toggle-text">
                      성인용으로 표시
                    </span>
                  </button>
                  <small>목록과 상세 페이지에 18+ 표시가 붙습니다.</small>
                </label>

                <label className="adult-option">
                  <span>SHARING</span>
                  <button
                    type="button"
                    className={`adult-toggle ${isPublic ? "active" : ""}`}
                    onClick={() => setIsPublic((value) => !value)}
                    aria-pressed={isPublic}
                  >
                    <span className="adult-toggle-box">
                      {isPublic ? "✓" : ""}
                    </span>
                    <span className="adult-toggle-text">
                      공유 링크로 공개
                    </span>
                  </button>
                  <small>
                    공개하면 로그인하지 않은 사람도 공유 링크로 이 PROMPT를 볼 수 있습니다.
                  </small>
                </label>

                <label>
                  <span>DESCRIPTION</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="이 프롬프트가 어떤 용도인지 짧게 적어주세요."
                    rows={4}
                  />
                </label>

                <label>
                  <span>TAGS</span>
                  <input
                    value={tagsInput}
                    onChange={(event) => setTagsInput(event.target.value)}
                    placeholder="몰입, 서술, 캐릭터"
                  />
                  <small>쉼표로 구분해서 입력</small>
                </label>

                <div className="link-grid">
                  <label>
                    <span>CHARACTER</span>
                    <select
                      value={characterId}
                      onChange={(event) => setCharacterId(event.target.value)}
                    >
                      <option value="">연결하지 않음</option>
                      {characters.map((character) => (
                        <option key={character.id} value={character.id}>
                          {character.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>PAIR</span>
                    <select
                      value={pairId}
                      onChange={(event) => setPairId(event.target.value)}
                    >
                      <option value="">연결하지 않음</option>
                      {pairs.map((pair) => (
                        <option key={pair.id} value={pair.id}>
                          {pair.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
                            <div className="content-editor">
                <label>
                  <span>PROMPT CONTENT</span>

                  <div className="quick-insert-row">
                    <div className="quick-insert-group">
                      <span className="quick-insert-label">TOKENS</span>
                      <div className="quick-insert-buttons">
                        {QUICK_INSERTS.slice(0, 4).map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            className="quick-insert-button"
                            onClick={() => insertQuickText(item.text)}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="quick-insert-group">
                      <span className="quick-insert-label">COMMANDS</span>
                      <div className="quick-insert-buttons">
                        {QUICK_INSERTS.slice(4).map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            className="quick-insert-button"
                            onClick={() => insertQuickText(item.text)}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <textarea
                    ref={promptTextareaRef}
                    className="prompt-textarea"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder={`실제로 사용할 프롬프트를 입력하세요.

예:
{{char}}는 {{user}}와의 관계에서 감정을 직접적으로 설명하기보다 행동과 대사로 드러낸다.`}
                    spellCheck={false}
                  />

                  <div className="prompt-images-editor">
                    <div className="prompt-images-header">
                      <div>
                        <span className="prompt-images-title">IMAGE ATTACHMENTS</span>
                        <small>프롬프트와 함께 보관할 이미지를 여러 장 첨부할 수 있습니다.</small>
                      </div>

                      <button
                        type="button"
                        className="image-add-button"
                        onClick={() => imageInputRef.current?.click()}
                      >
                        + ADD IMAGES
                      </button>

                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageFiles}
                        hidden
                      />
                    </div>

                    {imageUrls.length > 0 && (
                      <div className="prompt-image-grid">
                        {imageUrls.map((url, index) => (
                          <div className="prompt-image-item" key={`${url}-${index}`}>
                            <img src={url} alt={`Attachment ${index + 1}`} />
                            <button
                              type="button"
                              className="prompt-image-remove"
                              onClick={() => removeImageAt(index)}
                              aria-label={`Remove image ${index + 1}`}
                            >
                              ×
                            </button>
                            <span>{String(index + 1).padStart(2, "0")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div className="editor-footer">
              <span>
                {content.length.toLocaleString()} CHARACTERS
              </span>
              <button type="button" onClick={savePrompt}>
                {editingId ? "SAVE CHANGES" : "SAVE PROMPT"}
              </button>
            </div>
          </section>
        )}

        {!isAdding && (
          <>
            <section className="toolbar">
              <div className="search">
                <span>⌕</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="SEARCH PROMPTS"
                />
              </div>

              <select
                value={filterCategory}
                onChange={(event) => setFilterCategory(event.target.value)}
              >
                <option value="ALL">ALL CATEGORIES</option>
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </section>

            {prompts.length === 0 ? (
              <section className="empty-state">
                <span>01</span>
                <h2>NO PROMPTS YET</h2>
                <p>자주 사용하는 프롬프트를 이곳에 모아두세요.</p>
                <button type="button" onClick={() => openAddForm()}>
                  + CREATE FIRST PROMPT
                </button>
              </section>
            ) : filteredPrompts.length === 0 ? (
              <section className="empty-state compact">
                <span>—</span>
                <h2>NO RESULTS</h2>
                <p>검색어나 카테고리를 다시 확인해주세요.</p>
              </section>
            ) : (
              <section className="prompt-list">
                {filteredPrompts.map((prompt, index) => {
                  const characterName = getCharacterName(prompt.characterId);
                  const pairName = getPairName(prompt.pairId);

                  return (
                    <article
                      className="prompt-card"
                      key={prompt.id}
                      role="link"
                      tabIndex={0}
                      onClick={() =>
                        router.push(
                          `/prompt/${encodeURIComponent(prompt.id)}`,
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(
                            `/prompt/${encodeURIComponent(prompt.id)}`,
                          );
                        }
                      }}
                    >
                      <div className="prompt-card-top">
                        <span className="prompt-index">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="prompt-category">
                          {prompt.category}
                        </span>
                        {prompt.isPublic && (
                          <span className="public-badge">PUBLIC</span>
                        )}
                        {prompt.adultOnly && (
                          <span className="adult-badge">18+ · 성인용</span>
                        )}

                        <div className="card-actions">
                          <button
                            type="button"
                            className="text-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditForm(prompt);
                            }}
                          >
                            EDIT
                          </button>
                          {user && (
                            <button
                              type="button"
                              className="text-button danger"
                              onClick={(event) => {
                                event.stopPropagation();
                                deletePrompt(prompt);
                              }}
                            >
                              DELETE
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="prompt-card-main">
                        <div>
                          <h2>{prompt.name}</h2>

                          {prompt.description && (
                            <p className="description">{prompt.description}</p>
                          )}

                          <div className="meta">
                            {characterName && (
                              <span>CHARACTER · {characterName}</span>
                            )}
                            {pairName && <span>PAIR · {pairName}</span>}
                            <span>
                              UPDATED · {formatDate(prompt.updatedAt)}
                            </span>
                            {prompt.imageIds && prompt.imageIds.length > 0 && (
                              <span>IMAGES · {prompt.imageIds.length}</span>
                            )}
                          </div>

                          {prompt.tags.length > 0 && (
                            <div className="tags">
                              {prompt.tags.map((tag) => (
                                <span key={tag}>#{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          className={`copy-button ${
                            copiedId === prompt.id ? "copied" : ""
                          }`}
                          onClick={(event) => {
                            event.stopPropagation();
                            copyPrompt(prompt);
                          }}
                        >
                          {copiedId === prompt.id ? "COPIED" : "COPY"}
                        </button>
                      </div>

                      <div className="content-preview">
                        {prompt.content || "EMPTY PROMPT"}
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        .prompt-page {
          min-height: 100vh;
          background: var(--archive-bg);
          color: var(--archive-text);
          padding: 42px 48px 100px;
        }

        .prompt-container {
          max-width: 1280px;
          margin: 0 auto;
        }

        .prompt-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 30px;
          border-bottom: 0;
          padding-bottom: 0;
          margin-bottom: 30px;
        }

        .eyebrow,
        .editor-eyebrow {
          display: block;
          margin-bottom: 12px;
          color: var(--archive-muted);
          font-size: 9px;
          letter-spacing: 0.2em;
        }

        .prompt-header h1 {
          margin: 0;
          font-size: clamp(46px, 7vw, 86px);
          line-height: 0.9;
          font-weight: 400;
          letter-spacing: -0.06em;
        }

        .prompt-header p {
          margin: 18px 0 0;
          color: var(--archive-muted);
          font-size: 12px;
        }

        .add-button,
        .editor-footer button,
        .empty-state button {
          border: 1px solid var(--archive-text);
          border-radius: 999px;
          background: var(--archive-text);
          color: var(--archive-card);
          padding: 11px 17px;
          font-size: 9px;
          letter-spacing: 0.14em;
          cursor: pointer;
        }

        .add-button:hover,
        .editor-footer button:hover,
        .empty-state button:hover {
          background: var(--archive-card);
          color: var(--archive-text);
        }

        .editor {
          border: 1px solid var(--archive-border);
          border-radius: 18px;
          background: var(--archive-card);
          margin-bottom: 34px;
          overflow: hidden;
        }

        .editor-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--archive-border);
          padding: 22px 24px;
        }

        .editor-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 400;
          letter-spacing: -0.02em;
        }

        .cancel-button {
          border: 0;
          background: transparent;
          color: var(--archive-muted);
          font-size: 9px;
          letter-spacing: 0.14em;
          cursor: pointer;
        }

        .cancel-button:hover {
          color: var(--archive-text);
        }

        .editor-grid {
          display: grid;
          grid-template-columns: 0.8fr 1.2fr;
          gap: 0;
        }

        .editor-side {
          padding: 26px;
          border-right: 1px solid var(--archive-border);
        }

        .editor-side label,
        .content-editor label {
          display: block;
          margin-bottom: 22px;
        }

        .adult-option {
          margin-top: -4px;
        }

        .adult-toggle {
          display: flex;
          align-items: center;
          gap: 10px;
          border: 0;
          padding: 0;
          background: transparent;
          color: var(--archive-text);
          cursor: pointer;
          font: inherit;
          text-align: left;
        }

        .adult-toggle-box {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border: 1px solid var(--archive-muted);
          background: var(--archive-card);
          color: var(--archive-card);
          font-size: 11px;
          line-height: 1;
        }

        .adult-toggle.active .adult-toggle-box {
          border-color: var(--archive-text);
          background: var(--archive-text);
        }

        .adult-toggle-text {
          font-size: 11px;
        }

        .public-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 3px 7px;
          border: 1px solid currentColor;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        .adult-badge {
          display: inline-flex;
          align-items: center;
          border: 1px solid var(--archive-text);
          padding: 3px 6px;
          color: var(--archive-text);
          background: var(--archive-card);
          font-size: 8px;
          line-height: 1;
          letter-spacing: 0.08em;
        }
                  .editor-side label > span,
        .content-editor label > span {
          display: block;
          margin-bottom: 8px;
          font-size: 7px;
          letter-spacing: 0.14em;
          color: var(--archive-muted);
        }

        input,
        select,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid var(--archive-border);
          background: var(--archive-soft);
          color: var(--archive-text);
          padding: 12px;
          outline: none;
          font: inherit;
          font-size: 12px;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: var(--archive-text);
          background: var(--archive-card);
        }

        textarea {
          resize: vertical;
          line-height: 1.7;
        }

        small {
          display: block;
          margin-top: 6px;
          color: var(--archive-muted);
          font-size: 9px;
        }

        .link-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .content-editor {
          padding: 26px;
        }

        .prompt-textarea {
          min-height: 520px;
          height: calc(100% - 28px);
          resize: vertical;
          font-family: var(--font-geist-mono), monospace;
          font-size: 12px;
          line-height: 1.75;
          white-space: pre-wrap;
        }

        .prompt-images-editor {
          margin-top: 14px;
          border: 1px solid var(--archive-border);
          border-radius: 14px;
          background: var(--archive-soft);
          padding: 14px;
        }

        .prompt-images-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .prompt-images-header > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .prompt-images-title {
          color: var(--archive-muted);
          font-size: 8px;
          font-weight: 600;
          letter-spacing: 0.12em;
        }

        .prompt-images-header small {
          color: var(--archive-muted);
          font-size: 8px;
          line-height: 1.5;
        }

        .image-add-button {
          flex-shrink: 0;
          border: 1px solid var(--archive-border);
          border-radius: 999px;
          background: var(--archive-card);
          color: var(--archive-muted);
          padding: 8px 11px;
          font-family: inherit;
          font-size: 7px;
          font-weight: 600;
          letter-spacing: 0.08em;
          cursor: pointer;
        }

        .image-add-button:hover {
          border-color: var(--archive-text);
          background: var(--archive-text);
          color: var(--archive-card);
        }

        .prompt-image-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-top: 12px;
        }

        .prompt-image-item {
          position: relative;
          overflow: hidden;
          aspect-ratio: 1 / 1;
          border: 1px solid var(--archive-border);
          border-radius: 10px;
          background: var(--archive-soft);
        }

        .prompt-image-item img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .prompt-image-item > span {
          position: absolute;
          left: 7px;
          bottom: 6px;
          color: var(--archive-card);
          font-size: 7px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-shadow: 0 1px 5px rgba(0, 0, 0, 0.35);
        }

        .prompt-image-remove {
          position: absolute;
          top: 5px;
          right: 5px;
          width: 23px;
          height: 23px;
          border: 0;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.62);
          color: var(--archive-card);
          font-size: 15px;
          line-height: 1;
          cursor: pointer;
        }

        .prompt-image-remove:hover {
          background: var(--archive-text);
        }

        .editor-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid var(--archive-border);
          padding: 14px 18px;
          color: var(--archive-muted);
          font-size: 9px;
          letter-spacing: 0.1em;
        }

        .toolbar {
          display: flex;
          gap: 10px;
          margin-bottom: 24px;
        }

        .toolbar select {
          width: 220px;
          background: var(--archive-card);
          border-radius: 999px;
        }

        .search {
          display: flex;
          align-items: center;
          flex: 1;
          border: 1px solid var(--archive-border);
          border-radius: 999px;
          padding: 0 14px;
          background: var(--archive-card);
        }

        .search span {
          color: var(--archive-muted);
          font-size: 20px;
          margin-right: 8px;
        }

        .search input {
          border: 0;
          background: transparent;
          padding: 12px 0;
        }

        .prompt-list {
          display: grid;
          gap: 12px;
        }

        .prompt-card {
          border: 1px solid var(--archive-border);
          border-radius: 16px;
          background: var(--archive-card);
          padding: 20px 22px 22px;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(0,0,0,0.025);
          transition: background 0.15s ease;
        }

        .prompt-card:hover {
          background: var(--archive-card);
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(0,0,0,0.05);
        }

        .prompt-card:focus-visible {
          outline: 1px solid var(--archive-text);
          outline-offset: 3px;
        }

        .prompt-card-top {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .prompt-index {
          color: var(--archive-muted);
          font-size: 9px;
          letter-spacing: 0.12em;
        }

        .prompt-category {
          color: var(--archive-muted);
          font-size: 9px;
          letter-spacing: 0.12em;
        }

        .card-actions {
          display: flex;
          gap: 14px;
          margin-left: auto;
        }

        .text-button {
          border: 0;
          padding: 0;
          background: transparent;
          color: var(--archive-muted);
          font-size: 9px;
          letter-spacing: 0.12em;
          text-decoration: none;
          cursor: pointer;
        }

        .text-button:hover {
          color: var(--archive-text);
        }

        .text-button.danger:hover {
          color: var(--archive-accent);
        }

        .prompt-card-main {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          margin-top: 20px;
        }

        .prompt-card h2 {
          margin: 0;
          font-size: 25px;
          line-height: 1.1;
          font-weight: 400;
          letter-spacing: -0.035em;
        }

        .description {
          max-width: 760px;
          margin: 12px 0 0;
          color: var(--archive-muted);
          font-size: 12px;
          line-height: 1.7;
        }

        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 18px;
          margin-top: 16px;
          color: var(--archive-muted);
          font-size: 8px;
          letter-spacing: 0.1em;
        }

        .tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 13px;
        }

        .tags span {
          color: var(--archive-muted);
          font-size: 9px;
        }

        .copy-button {
          flex: 0 0 auto;
          align-self: flex-start;
          border: 1px solid var(--archive-border);
          border-radius: 999px;
          background: var(--archive-card);
          color: var(--archive-text);
          min-width: 70px;
          padding: 10px 12px;
          font-size: 9px;
          letter-spacing: 0.12em;
          cursor: pointer;
        }

        .copy-button:hover,
        .copy-button.copied {
          background: var(--archive-text);
          color: var(--archive-card);
        }

        .content-preview {
          margin-top: 20px;
          padding: 16px;
          height: 150px;
          overflow-y: auto;
          overflow-x: hidden;
          border: 1px solid var(--archive-border);
          background: var(--archive-soft);
          color: var(--archive-muted);
          font-family: var(--font-geist-mono), monospace;
          font-size: 10px;
          line-height: 1.7;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .empty-state {
          border: 1px solid var(--archive-border);
          border-radius: 16px;
          padding: 80px 0;
        }

        .empty-state.compact {
          padding: 50px 0;
        }

        .empty-state > span {
          color: var(--archive-muted);
          font-size: 9px;
          letter-spacing: 0.16em;
        }

        .empty-state h2 {
          margin: 14px 0 10px;
          font-size: 38px;
          font-weight: 400;
          letter-spacing: -0.04em;
        }

        .empty-state p {
          margin: 0 0 24px;
          color: var(--archive-muted);
          font-size: 12px;
        }

        .loading {
          padding: 80px;
          text-align: center;
          color: var(--archive-muted);
          font-size: 10px;
          letter-spacing: 0.16em;
        }

        @media (max-width: 800px) {
          .prompt-page {
            padding: 30px 20px 70px;
          }

          .prompt-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .editor-grid {
            grid-template-columns: 1fr;
          }

          .editor-side {
            border-right: 0;
            border-bottom: 1px solid var(--archive-border);
          }

          .prompt-textarea {
            min-height: 380px;
          }

          .toolbar {
            flex-direction: column;
          }

          .toolbar select {
            width: 100%;
          }

          .prompt-card-main {
            flex-direction: column;
          }

          .copy-button {
            align-self: flex-start;
          }
        }

        .quick-insert-row {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin: 14px 0 12px;
        }

        .quick-insert-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .quick-insert-label {
          color: var(--archive-muted);
          font-size: 9px;
          letter-spacing: 0.16em;
        }

        .quick-insert-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .quick-insert-button {
          border: 1px solid var(--archive-border);
          background: var(--archive-card);
          padding: 7px 10px;
          color: var(--archive-text);
          font-size: 10px;
          transition: 0.15s ease;
        }

        .quick-insert-button:hover {
          border-color: var(--archive-text);
          background: var(--archive-text);
          color: var(--archive-card);
        }
      `}</style>
    </main>
  );
}