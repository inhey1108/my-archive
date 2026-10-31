"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Character = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  image: string;
  images: string[];

  // IndexedDB 이미지 ID
  imageId?: string;
  imageIds?: string[];
};

type CharacterMetadata = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  imageId?: string;
  imageIds?: string[];
};

type CharacterRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  representative_image_id: string | null;
  image_ids: string[] | null;
  created_at: string;
  updated_at: string;
};


const DB_NAME = "my-archive-db";
const DB_VERSION = 1;
const IMAGE_STORE = "character-images";
const CHARACTER_STORAGE_KEY = "my-archive-characters";

/* =========================================================
   IndexedDB
========================================================= */

const openImageDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB를 사용할 수 없습니다."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

const saveImageToDB = async (dataUrl: string): Promise<string> => {
  const db = await openImageDB();

  const id = crypto.randomUUID();

  const response = await fetch(dataUrl);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(IMAGE_STORE, "readwrite");
    const store = transaction.objectStore(IMAGE_STORE);

    const request = store.put(blob, id);

    request.onsuccess = () => {
      db.close();
      resolve(id);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
};

const getImageFromDB = async (
  id: string
): Promise<string | null> => {
  const db = await openImageDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(IMAGE_STORE, "readonly");
    const store = transaction.objectStore(IMAGE_STORE);

    const request = store.get(id);

    request.onsuccess = () => {
      const blob = request.result;

      if (!blob) {
        db.close();
        resolve(null);
        return;
      }

      const url = URL.createObjectURL(blob);

      db.close();
      resolve(url);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
};

const deleteImageFromDB = async (
  id: string
): Promise<void> => {
  try {
    const db = await openImageDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        IMAGE_STORE,
        "readwrite"
      );

      const store = transaction.objectStore(IMAGE_STORE);

      const request = store.delete(id);

      request.onsuccess = () => {
        db.close();
        resolve();
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch {
    // 이미지가 이미 없는 경우 무시
  }
};

/* =========================================================
   Base64 → Blob URL
   기존 localStorage 이미지 마이그레이션용
========================================================= */

const migrateOldCharacterImages = async (
  oldCharacters: Character[]
): Promise<Character[]> => {
  const migratedCharacters: Character[] = [];

  for (const character of oldCharacters) {
    let newImage = character.image || "";
    let newImageId = character.imageId;

    // 기존 대표 이미지가 base64라면 IndexedDB로 이동
    if (
      newImage &&
      newImage.startsWith("data:") &&
      !newImageId
    ) {
      try {
        const id = await saveImageToDB(newImage);
        const blobUrl = await getImageFromDB(id);

        newImageId = id;
        newImage = blobUrl || "";
      } catch {
        console.error(
          "대표 이미지를 마이그레이션하지 못했습니다."
        );
      }
    }

    const newImages: string[] = [];
    const newImageIds: string[] = [];

    for (const galleryImage of character.images ?? []) {
      if (galleryImage.startsWith("data:")) {
        try {
          const id = await saveImageToDB(galleryImage);
          const blobUrl = await getImageFromDB(id);

          if (blobUrl) {
            newImages.push(blobUrl);
            newImageIds.push(id);
          }
        } catch {
          console.error(
            "갤러리 이미지를 마이그레이션하지 못했습니다."
          );
        }
      }
    }

    migratedCharacters.push({
      ...character,
      image: newImage,
      images: newImages,
      imageId: newImageId,
      imageIds: newImageIds,
    });
  }

  return migratedCharacters;
};

/* =========================================================
   Character Page
========================================================= */

export default function CharacterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [user, setUser] = useState<import("@supabase/supabase-js").User | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const [editingCharacterId, setEditingCharacterId] =
    useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [image, setImage] = useState("");
  const [imageId, setImageId] = useState<string | undefined>(
    undefined
  );

  const [images, setImages] = useState<string[]>([]);
  const [imageIds, setImageIds] = useState<string[]>([]);

  const [isSaving, setIsSaving] = useState(false);

  // 화면 옵션
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest" | "name">("latest");
  const [viewMode, setViewMode] = useState<"grid" | "compact" | "list">("grid");

  /* =========================================================
     localStorage 브리지
     - CHARACTER 상세 페이지가 아직 localStorage를 사용하므로
       DB와 함께 메타데이터를 유지한다.
  ========================================================= */

  const saveCharacterMetadata = (
    updatedCharacters: Character[]
  ) => {
    const metadata: CharacterMetadata[] =
      updatedCharacters.map((character) => ({
        id: character.id,
        name: character.name,
        description: character.description,
        tags: character.tags,
        imageId: character.imageId,
        imageIds: character.imageIds ?? [],
      }));

    localStorage.setItem(
      CHARACTER_STORAGE_KEY,
      JSON.stringify(metadata)
    );
  };

  /* =========================================================
     Supabase → 화면 데이터
  ========================================================= */

  const rowToCharacter = async (
    row: CharacterRow
  ): Promise<Character> => {
    let loadedImage = "";
    const loadedImages: string[] = [];

    if (row.representative_image_id) {
      const imageUrl = await getImageFromDB(
        row.representative_image_id
      );

      if (imageUrl) {
        loadedImage = imageUrl;
      }
    }

    for (const id of row.image_ids ?? []) {
      const imageUrl = await getImageFromDB(id);

      if (imageUrl) {
        loadedImages.push(imageUrl);
      }
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      tags: row.tags ?? [],
      image: loadedImage,
      images: loadedImages,
      imageId: row.representative_image_id ?? undefined,
      imageIds: row.image_ids ?? [],
    };
  };

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /* =========================================================
     캐릭터 불러오기
     1. 로그인 확인
     2. Supabase에서 현재 사용자 캐릭터 조회
     3. DB가 비어 있고 기존 localStorage 데이터가 있으면 1회 마이그레이션
     4. localStorage에는 상세 페이지 호환용 메타데이터만 유지
  ========================================================= */

  useEffect(() => {
    const loadCharacters = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        setUser(user);

        const { data, error } = await supabase
          .from("characters")
          .select("*")
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Supabase 캐릭터 조회 오류:", error);
          alert(
            "캐릭터 데이터를 불러오지 못했습니다. 다시 시도해주세요."
          );
          return;
        }

        let rows = (data ?? []) as CharacterRow[];

        /*
         * 기존 localStorage 데이터가 있고 DB가 비어 있으면
         * 현재 로그인한 계정으로 1회 가져온다.
         *
         * 이미지 파일 자체는 아직 IndexedDB에 남겨두고,
         * 이미지 ID만 Supabase에 저장한다.
         */
        if (rows.length === 0 && user) {
          const saved = localStorage.getItem(
            CHARACTER_STORAGE_KEY
          );

          if (saved) {
            try {
              const parsedCharacters: Character[] =
                JSON.parse(saved);

              if (parsedCharacters.length > 0) {
                const migrationRows = parsedCharacters
                  .map((character) => ({
                    id: character.id,
                    user_id: user.id,
                    name: character.name,
                    description: character.description ?? "",
                    tags: character.tags ?? [],
                    representative_image_id:
                      character.imageId ?? null,
                    image_ids: character.imageIds ?? [],
                  }));

                const { data: migrated, error: migrationError } =
                  await supabase
                    .from("characters")
                    .upsert(migrationRows, {
                      onConflict: "id",
                    })
                    .select("*");

                if (migrationError) {
                  /*
                   * 기존 데이터 ID가 UUID가 아닌 경우 등에는
                   * 새 UUID로 다시 넣을 수 있도록 처리한다.
                   */
                  console.warn(
                    "기존 캐릭터 ID로 마이그레이션하지 못했습니다. 새 ID로 재시도합니다.",
                    migrationError
                  );

                  const retryRows = parsedCharacters.map(
                    (character) => ({
                      user_id: user.id,
                      name: character.name,
                      description: character.description ?? "",
                      tags: character.tags ?? [],
                      representative_image_id:
                        character.imageId ?? null,
                      image_ids: character.imageIds ?? [],
                    })
                  );

                  const { data: retried, error: retryError } =
                    await supabase
                      .from("characters")
                      .insert(retryRows)
                      .select("*");

                  if (retryError) {
                    throw retryError;
                  }

                  rows = (retried ?? []) as CharacterRow[];
                } else {
                  rows = (migrated ?? []) as CharacterRow[];
                }
              }
            } catch (migrationError) {
              console.error(
                "기존 캐릭터 마이그레이션 오류:",
                migrationError
              );
            }
          }
        }

        const loadedCharacters: Character[] = [];

        for (const row of rows) {
          loadedCharacters.push(
            await rowToCharacter(row)
          );
        }

        setCharacters(loadedCharacters);

        // 상세 페이지가 아직 localStorage를 읽으므로 메타데이터 동기화
        saveCharacterMetadata(loadedCharacters);
      } catch (error) {
        console.error(
          "캐릭터 데이터를 불러오지 못했습니다.",
          error
        );
      }
    };

    loadCharacters();
  }, [router]);

  /* =========================================================
     폼 초기화
  ========================================================= */

  const resetForm = () => {
    setName("");
    setDescription("");
    setTags("");

    setImage("");
    setImageId(undefined);

    setImages([]);
    setImageIds([]);

    setEditingCharacterId(null);
    setIsAdding(false);
    setIsSaving(false);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("add") === "1" && user) {
      resetForm();
      setIsAdding(true);
      window.history.replaceState({}, "", "/character");
    }
  }, [user]);

  /* =========================================================
     대표 이미지 업로드
  ========================================================= */

  const handleImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImage(reader.result);

        // 새 이미지이므로 기존 ID 제거
        setImageId(undefined);
      }
    };

    reader.onerror = () => {
      alert("이미지를 불러오지 못했습니다.");
    };

    reader.readAsDataURL(file);

    event.target.value = "";
  };

  /* =========================================================
     여러 이미지 업로드
  ========================================================= */

  const handleMultipleImageUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(
      event.target.files || []
    );

    if (files.length === 0) return;

    const imageFiles = files.filter((file) =>
      file.type.startsWith("image/")
    );

    if (imageFiles.length !== files.length) {
      alert("이미지 파일만 업로드할 수 있습니다.");
    }

    if (imageFiles.length === 0) {
      event.target.value = "";
      return;
    }

    const readers = imageFiles.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = () => {
            if (typeof reader.result === "string") {
              resolve(reader.result);
            } else {
              reject(
                new Error("이미지를 읽을 수 없습니다.")
              );
            }
          };

          reader.onerror = () => {
            reject(
              new Error("이미지를 읽을 수 없습니다.")
            );
          };

          reader.readAsDataURL(file);
        })
    );

    Promise.all(readers)
      .then((newImages) => {
        setImages((prev) => [
          ...prev,
          ...newImages,
        ]);

        // 새로 추가된 이미지에는 아직 DB ID가 없음
        // 기존 이미지 ID와 새 이미지의 위치를 맞추기 위해
        // 빈 문자열을 추가
        setImageIds((prev) => [
          ...prev,
          ...newImages.map(() => ""),
        ]);
      })
      .catch(() => {
        alert("이미지를 불러오지 못했습니다.");
      });

    event.target.value = "";
  };

  /* =========================================================
     이미지 하나를 IndexedDB에 저장
  ========================================================= */

  const ensureImageSaved = async (
    imageData: string,
    existingId?: string
  ): Promise<string> => {
    // 이미 IndexedDB에 존재하는 이미지라면 그대로 사용
    if (
      existingId &&
      imageData.startsWith("blob:")
    ) {
      return existingId;
    }

    // 새 base64 이미지라면 IndexedDB에 저장
    if (imageData.startsWith("data:")) {
      return await saveImageToDB(imageData);
    }

    return existingId || "";
  };

  /* =========================================================
     캐릭터 추가
  ========================================================= */

  const addCharacter = async () => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent("/character?add=1")}`);
      return;
    }

    if (!name.trim()) {
      alert("캐릭터 이름을 입력해주세요.");
      return;
    }

    if (isSaving) return;

    setIsSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      // 대표 이미지 저장
      let savedImageId = "";

      if (image) {
        savedImageId = await ensureImageSaved(image);
      }

      // 갤러리 이미지 저장
      const savedImageIds: string[] = [];

      for (const galleryImage of images) {
        const savedId =
          await ensureImageSaved(galleryImage);

        if (savedId) {
          savedImageIds.push(savedId);
        }
      }

      const { data, error } = await supabase
        .from("characters")
        .insert({
          user_id: user.id,
          name: name.trim(),
          description: description.trim(),
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          representative_image_id:
            savedImageId || null,
          image_ids: savedImageIds,
        })
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const savedCharacter = await rowToCharacter(
        data as CharacterRow
      );

      const updatedCharacters = [
        ...characters,
        savedCharacter,
      ];

      setCharacters(updatedCharacters);
      saveCharacterMetadata(updatedCharacters);
      resetForm();
    } catch (error) {
      console.error(error);
      alert(
        "캐릭터를 저장하지 못했습니다. 다시 시도해주세요."
      );
      setIsSaving(false);
    }
  };

  /* =========================================================
     캐릭터 수정
  ========================================================= */

  const updateCharacter = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (!editingCharacterId) return;

    if (!name.trim()) {
      alert("캐릭터 이름을 입력해주세요.");
      return;
    }

    if (isSaving) return;

    setIsSaving(true);

    try {
      const previousCharacter = characters.find(
        (character) =>
          character.id === editingCharacterId
      );

      if (!previousCharacter) {
        setIsSaving(false);
        return;
      }

      /* 대표 이미지 */
      let savedImageId =
        imageId || previousCharacter.imageId;

      if (
        image &&
        image !== previousCharacter.image
      ) {
        savedImageId =
          await ensureImageSaved(image);
      }

      /* 갤러리 이미지 */
      const savedImageIds: string[] = [];

      for (let index = 0; index < images.length; index++) {
        const galleryImage = images[index];

        const existingId =
          imageIds[index] ||
          previousCharacter.imageIds?.[index];

        const savedId = await ensureImageSaved(
          galleryImage,
          existingId
        );

        if (savedId) {
          savedImageIds.push(savedId);
        }
      }

      /* 사용하지 않게 된 기존 이미지 삭제 */
      const oldImageIds = [
        previousCharacter.imageId,
        ...(previousCharacter.imageIds ?? []),
      ].filter(Boolean) as string[];

      const newImageIds = [
        savedImageId,
        ...savedImageIds,
      ].filter(Boolean);

      const imagesToDelete =
        oldImageIds.filter(
          (id) => !newImageIds.includes(id)
        );

      for (const id of imagesToDelete) {
        await deleteImageFromDB(id);
      }

      const { error } = await supabase
        .from("characters")
        .update({
          name: name.trim(),
          description: description.trim(),
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          representative_image_id:
            savedImageId || null,
          image_ids: savedImageIds,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingCharacterId);

      if (error) {
        throw error;
      }

      const updatedCharacters = characters.map(
        (character) =>
          character.id === editingCharacterId
            ? {
                ...character,
                name: name.trim(),
                description: description.trim(),
                tags: tags
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
                image,
                images,
                imageId:
                  savedImageId || undefined,
                imageIds: savedImageIds,
              }
            : character
      );

      setCharacters(updatedCharacters);
      saveCharacterMetadata(updatedCharacters);
      resetForm();
    } catch (error) {
      console.error(error);
      alert(
        "캐릭터를 저장하지 못했습니다. 다시 시도해주세요."
      );
      setIsSaving(false);
    }
  };

  /* =========================================================
     수정 모달
  ========================================================= */

  const openEditModal = (character: Character) => {
    setEditingCharacterId(character.id);

    setName(character.name);
    setDescription(character.description);
    setTags(character.tags.join(", "));

    setImage(character.image);
    setImageId(character.imageId);

    setImages(character.images ?? []);
    setImageIds(character.imageIds ?? []);

    setIsAdding(true);
  };

  /* =========================================================
     캐릭터 삭제
  ========================================================= */

  const deleteCharacter = async (id: string) => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (!confirm("이 캐릭터를 삭제할까요?")) return;

    try {
      const characterToDelete = characters.find(
        (character) => character.id === id
      );

      const { error } = await supabase
        .from("characters")
        .delete()
        .eq("id", id);

      if (error) {
        throw error;
      }

      if (characterToDelete) {
        if (characterToDelete.imageId) {
          await deleteImageFromDB(
            characterToDelete.imageId
          );
        }

        for (const imageId of
          characterToDelete.imageIds ?? []) {
          await deleteImageFromDB(imageId);
        }
      }

      const updatedCharacters =
        characters.filter(
          (character) => character.id !== id
        );

      setCharacters(updatedCharacters);
      saveCharacterMetadata(updatedCharacters);
    } catch (error) {
      console.error(error);
      alert(
        "캐릭터를 삭제하지 못했습니다. 다시 시도해주세요."
      );
    }
  };

  const filteredCharacters = characters
    .filter((character) => {
      const query = searchQuery.trim().toLowerCase();

      if (!query) return true;

      return [
        character.name,
        character.description,
        ...character.tags,
      ].some((value) => value.toLowerCase().includes(query));
    })
    .sort((a, b) => {
      if (sortOrder === "name") {
        return a.name.localeCompare(b.name, "ko");
      }

      const aIndex = characters.indexOf(a);
      const bIndex = characters.indexOf(b);

      return sortOrder === "latest"
        ? bIndex - aIndex
        : aIndex - bIndex;
    });

  return (
    <div className="min-h-screen bg-[var(--archive-bg)] text-[var(--archive-text)]">
      <main className="px-5 py-7 sm:px-7 sm:py-9 lg:px-10 lg:py-11">
        {/* PAGE HEADER */}
        <div className="mb-6 border-b border-[var(--archive-border)] pb-6 sm:mb-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-[9px] font-medium tracking-[0.28em] text-[var(--archive-muted)]">
                PERSONAL ARCHIVE
              </p>

              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-light tracking-[-0.045em] sm:text-4xl">
                  CHARACTERS
                </h1>

                <span className="rounded-full border border-[var(--archive-border)] bg-[var(--archive-card)] px-2.5 py-1 text-[9px] tracking-[0.08em] text-[var(--archive-muted)]">
                  {characters.length}
                </span>
              </div>

              <p className="mt-2 text-xs text-[var(--archive-muted)]">
                당신이 기록한 캐릭터들의 공간
              </p>
            </div>

            {user && (
              <button
                onClick={() => {
                  resetForm();
                  setIsAdding(true);
                }}
              className="group flex w-fit items-center gap-2.5 self-start rounded-full bg-[#262626] px-5 py-3 text-[10px] font-medium tracking-[0.1em] text-[var(--archive-bg)] shadow-[0_8px_22px_rgba(0,0,0,0.08)] transition duration-300 hover:-translate-y-0.5 hover:bg-[var(--archive-text)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.12)] sm:self-auto"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/25 text-sm font-light leading-none transition group-hover:rotate-90">
                +
              </span>
                ADD CHARACTER
              </button>
            )}
          </div>
        </div>

        {/* SEARCH + CONTROLS */}
        <div className="mb-7 flex flex-col gap-2.5 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--archive-muted)]"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M16 16L20 20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>

            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름, 태그, 설명으로 검색하기..."
              className="h-12 w-full rounded-2xl border border-[var(--archive-border)] bg-[var(--archive-card)] pl-11 pr-10 text-xs text-[var(--archive-text)]/70 shadow-[0_3px_14px_rgba(0,0,0,0.025)] outline-none transition placeholder:text-[var(--archive-muted)] focus:border-[var(--archive-border)] focus:shadow-[0_5px_18px_rgba(0,0,0,0.04)]"
            />

            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--archive-muted)] transition hover:text-[var(--archive-text)]/60"
                aria-label="검색어 지우기"
              >
                ×
              </button>
            )}
          </div>

          <div className="flex gap-2.5">
            <select
              value={sortOrder}
              onChange={(e) =>
                setSortOrder(
                  e.target.value as "latest" | "oldest" | "name"
                )
              }
              className="h-12 min-w-[110px] flex-1 appearance-none rounded-2xl border border-[var(--archive-border)] bg-[var(--archive-card)] px-4 text-[10px] text-[var(--archive-muted)] shadow-[0_3px_14px_rgba(0,0,0,0.025)] outline-none sm:flex-none"
            >
              <option value="latest">최신순</option>
              <option value="oldest">오래된순</option>
              <option value="name">이름순</option>
            </select>

            <div className="flex h-12 rounded-2xl border border-[var(--archive-border)] bg-[var(--archive-card)] p-1 shadow-[0_3px_14px_rgba(0,0,0,0.025)]">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex w-10 items-center justify-center rounded-xl transition ${
                  viewMode === "grid"
                    ? "bg-[var(--archive-soft)] text-[var(--archive-text)]"
                    : "text-[var(--archive-muted)] hover:text-[var(--archive-muted)]"
                }`}
                title="그리드 보기"
                aria-label="그리드 보기"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="14" y="4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="4" y="14" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="14" y="14" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </button>

              <button
                onClick={() => setViewMode("compact")}
                className={`flex w-10 items-center justify-center rounded-xl transition ${
                  viewMode === "compact"
                    ? "bg-[var(--archive-soft)] text-[var(--archive-text)]"
                    : "text-[var(--archive-muted)] hover:text-[var(--archive-muted)]"
                }`}
                title="컴팩트 보기"
                aria-label="컴팩트 보기"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M14 5H20M14 8H20M4 17H20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>

              <button
                onClick={() => setViewMode("list")}
                className={`flex w-10 items-center justify-center rounded-xl transition ${
                  viewMode === "list"
                    ? "bg-[var(--archive-soft)] text-[var(--archive-text)]"
                    : "text-[var(--archive-muted)] hover:text-[var(--archive-muted)]"
                }`}
                title="리스트 보기"
                aria-label="리스트 보기"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="5" width="16" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
                  <rect x="4" y="15" width="16" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* RESULT COUNT */}
        {searchQuery && (
          <div className="mb-4 text-[9px] tracking-[0.08em] text-[var(--archive-muted)]">
            SEARCH RESULT · {filteredCharacters.length}
          </div>
        )}

        {/* CHARACTER LIST */}
        {characters.length === 0 ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-[24px] border border-dashed border-[var(--archive-border)] bg-[var(--archive-card)] px-6">
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--archive-border)] bg-[var(--archive-card)] text-[var(--archive-muted)] shadow-sm">
                +
              </div>
              <p className="mb-2 text-sm text-[var(--archive-text)]">
                아직 등록된 캐릭터가 없습니다.
              </p>
              <p className="text-[10px] leading-5 tracking-[0.04em] text-[var(--archive-muted)]">
                ADD CHARACTER를 눌러 첫 번째 캐릭터를 추가해보세요.
              </p>
            </div>
          </div>
        ) : filteredCharacters.length === 0 ? (
          <div className="flex min-h-[260px] items-center justify-center rounded-[24px] border border-[var(--archive-border)] bg-[var(--archive-card)] px-6">
            <div className="text-center">
              <p className="mb-2 text-sm text-[var(--archive-muted)]">
                검색 결과가 없습니다.
              </p>
              <button
                onClick={() => setSearchQuery("")}
                className="text-[10px] tracking-[0.08em] text-[var(--archive-muted)] underline underline-offset-4 transition hover:text-[var(--archive-text)]"
              >
                CLEAR SEARCH
              </button>
            </div>
          </div>
        ) : viewMode === "list" ? (
          <div className="overflow-hidden rounded-[22px] border border-[var(--archive-border)] bg-[var(--archive-card)] shadow-[0_5px_20px_rgba(0,0,0,0.025)]">
            {filteredCharacters.map((character, index) => (
              <div
                key={character.id}
                onClick={() => router.push(`/character/${character.id}`)}
                className={`group flex cursor-pointer items-center gap-4 p-3 transition hover:bg-[var(--archive-hover)] sm:gap-5 sm:p-4 ${
                  index !== filteredCharacters.length - 1
                    ? "border-b border-[var(--archive-border)]"
                    : ""
                }`}
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[14px] bg-[var(--archive-soft)] sm:h-20 sm:w-20">
                  {character.image ? (
                    <img
                      src={character.image}
                      alt={character.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[7px] tracking-[0.1em] text-[var(--archive-muted)]">
                      NO IMAGE
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h2 className="truncate text-sm font-medium">
                      {character.name}
                    </h2>
                    {character.images.length > 0 && (
                      <span className="shrink-0 text-[8px] text-[var(--archive-muted)]">
                        {character.images.length} IMAGES
                      </span>
                    )}
                  </div>

                  {character.description && (
                    <p className="line-clamp-1 text-[10px] leading-5 text-[var(--archive-muted)]">
                      {character.description}
                    </p>
                  )}

                  {character.tags.length > 0 && (
                    <div className="mt-2 hidden flex-wrap gap-1.5 sm:flex">
                      {character.tags.slice(0, 4).map((tag, tagIndex) => (
                        <span
                          key={`${tag}-${tagIndex}`}
                          className="rounded-full bg-[var(--archive-soft)] px-2 py-1 text-[8px] text-[var(--archive-muted)]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {user && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(character);
                      }}
                      className="hidden text-[7px] tracking-[0.06em] text-[var(--archive-muted)] transition hover:text-[var(--archive-text)] sm:block"
                    >
                      EDIT
                    </button>
                  )}
                  <span className="text-lg text-[var(--archive-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--archive-text)]/45">
                    ›
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            }
          >
            {filteredCharacters.map((character) => (
              <article
                key={character.id}
                onClick={() => router.push(`/character/${character.id}`)}
                className={`group cursor-pointer overflow-hidden border border-[var(--archive-border)] bg-[var(--archive-card)] transition duration-300 hover:-translate-y-0.5 hover:border-[var(--archive-border)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.055)] ${
                  viewMode === "grid"
                    ? "rounded-[22px]"
                    : "rounded-[18px]"
                }`}
              >
                <div
                  className={`relative overflow-hidden bg-[var(--archive-soft)] ${
                    viewMode === "grid"
                      ? "aspect-[4/5]"
                      : "aspect-[16/10]"
                  }`}
                >
                  {character.image ? (
                    <img
                      src={character.image}
                      alt={character.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[8px] tracking-[0.12em] text-[var(--archive-muted)]">
                      NO IMAGE
                    </div>
                  )}

                  {character.images.length > 0 && (
                    <div className="absolute bottom-3 right-3 rounded-full bg-[var(--archive-card)]/85 px-2.5 py-1.5 text-[8px] tracking-[0.06em] text-[var(--archive-text)]/45 shadow-sm backdrop-blur-sm">
                      {character.images.length} IMAGES
                    </div>
                  )}
                </div>

                <div className={viewMode === "grid" ? "p-4 sm:p-5" : "p-4"}>
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h2 className="min-w-0 truncate text-sm font-medium tracking-[-0.02em] sm:text-base">
                      {character.name}
                    </h2>

                    {user && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(character);
                          }}
                          className="text-[7px] tracking-[0.06em] text-[var(--archive-muted)] transition hover:text-[var(--archive-text)]"
                        >
                          EDIT
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCharacter(character.id);
                          }}
                          className="text-[7px] tracking-[0.06em] text-[var(--archive-muted)] transition hover:text-red-500"
                        >
                          DELETE
                        </button>
                      </div>
                    )}
                  </div>

                  {character.description && (
                    <p className="mb-3 line-clamp-2 text-[10px] leading-[1.7] text-[var(--archive-muted)]">
                      {character.description}
                    </p>
                  )}

                  {character.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {character.tags.slice(0, viewMode === "grid" ? 5 : 4).map((tag, index) => (
                        <span
                          key={`${tag}-${index}`}
                          className="rounded-full bg-[var(--archive-soft)] px-2 py-1 text-[8px] text-[var(--archive-muted)]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* ADD / EDIT MODAL */}
      {isAdding && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--archive-accent)]/35 p-3 backdrop-blur-[2px] sm:p-5">
          <div className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-[24px] border border-[var(--archive-border)] bg-[var(--archive-bg)] shadow-[0_25px_80px_rgba(0,0,0,0.16)]">
            {/* MODAL HEADER */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--archive-border)] bg-[var(--archive-bg)]/95 px-5 py-5 backdrop-blur sm:px-7">
              <div>
                <p className="mb-1 text-[9px] tracking-[0.22em] text-[var(--archive-muted)]">
                  {editingCharacterId ? "EDIT ENTRY" : "NEW ENTRY"}
                </p>

                <h2 className="text-xl font-light tracking-[-0.03em] sm:text-2xl">
                  {editingCharacterId ? "EDIT CHARACTER" : "ADD CHARACTER"}
                </h2>
              </div>

              <button
                onClick={resetForm}
                disabled={isSaving}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--archive-card)] text-xl font-light text-[var(--archive-muted)] shadow-sm transition hover:text-[var(--archive-text)] disabled:opacity-30"
              >
                ×
              </button>
            </div>

            <div className="space-y-6 px-5 py-6 sm:px-7 sm:py-7">
              {/* NAME */}
              <div>
                <label className="mb-2 block text-[9px] font-medium tracking-[0.16em] text-[var(--archive-muted)]">
                  NAME
                </label>

                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="캐릭터 이름"
                  className="w-full rounded-xl border border-[var(--archive-accent)]/[0.07] bg-[var(--archive-card)] px-4 py-3 text-sm outline-none transition placeholder:text-[var(--archive-muted)] focus:border-[var(--archive-accent)]/20"
                />
              </div>

              {/* DESCRIPTION */}
              <div>
                <label className="mb-2 block text-[9px] font-medium tracking-[0.16em] text-[var(--archive-muted)]">
                  DESCRIPTION
                </label>

                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="캐릭터 설명"
                  rows={5}
                  className="w-full resize-none rounded-xl border border-[var(--archive-accent)]/[0.07] bg-[var(--archive-card)] p-4 text-sm leading-6 outline-none transition placeholder:text-[var(--archive-muted)] focus:border-[var(--archive-accent)]/20"
                />
              </div>

              {/* TAGS */}
              <div>
                <label className="mb-2 block text-[9px] font-medium tracking-[0.16em] text-[var(--archive-muted)]">
                  TAGS
                </label>

                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="예: 군인, 냉정함, 장발"
                  className="w-full rounded-xl border border-[var(--archive-accent)]/[0.07] bg-[var(--archive-card)] px-4 py-3 text-sm outline-none transition placeholder:text-[var(--archive-muted)] focus:border-[var(--archive-accent)]/20"
                />

                <p className="mt-2 text-[9px] text-[var(--archive-muted)]">
                  쉼표(,)로 태그를 구분해주세요.
                </p>
              </div>

              {/* REPRESENTATIVE IMAGE */}
              <div>
                <label className="mb-2 block text-[9px] font-medium tracking-[0.16em] text-[var(--archive-muted)]">
                  REPRESENTATIVE IMAGE
                </label>

                <label className="flex min-h-24 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-[var(--archive-border)] bg-[var(--archive-card)] px-4 py-7 text-[10px] tracking-[0.12em] text-[var(--archive-muted)] transition hover:border-[var(--archive-accent)]/30 hover:bg-[var(--archive-accent)]/[0.015]">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  {image ? "CHANGE IMAGE" : "SELECT IMAGE"}
                </label>

                {image && (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--archive-border)] bg-[var(--archive-card)]">
                    <div className="aspect-[4/5]">
                      <img
                        src={image}
                        alt="대표 이미지 미리보기"
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setImage("");
                        setImageId(undefined);
                      }}
                      className="w-full border-t border-[var(--archive-border)] py-2.5 text-[9px] tracking-[0.1em] text-[var(--archive-muted)] transition hover:text-red-500"
                    >
                      REMOVE IMAGE
                    </button>
                  </div>
                )}
              </div>

              {/* GALLERY */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-[9px] font-medium tracking-[0.16em] text-[var(--archive-muted)]">
                    GALLERY IMAGES
                  </label>

                  {images.length > 0 && (
                    <span className="text-[9px] tracking-[0.06em] text-[var(--archive-muted)]">
                      {images.length} IMAGES
                    </span>
                  )}
                </div>

                <label className="flex min-h-20 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-[var(--archive-border)] bg-[var(--archive-card)] px-4 py-6 text-[10px] tracking-[0.12em] text-[var(--archive-muted)] transition hover:border-[var(--archive-accent)]/30 hover:bg-[var(--archive-accent)]/[0.015]">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleMultipleImageUpload}
                    className="hidden"
                  />
                  + ADD IMAGES
                </label>

                {images.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {images.map((galleryImage, index) => (
                      <div
                        key={`${galleryImage}-${index}`}
                        className="group relative overflow-hidden rounded-xl border border-[var(--archive-border)] bg-[var(--archive-card)]"
                      >
                        <div className="aspect-square">
                          <img
                            src={galleryImage}
                            alt={`추가 이미지 ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setImages((prev) =>
                              prev.filter((_, imageIndex) => imageIndex !== index)
                            );
                            setImageIds((prev) =>
                              prev.filter((_, imageIndex) => imageIndex !== index)
                            );
                          }}
                          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--archive-accent)]/65 text-xs text-[var(--archive-bg)] opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          ×
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const previousImage = image;
                            const previousImageId = imageId;
                            const selectedImageId = imageIds[index];

                            setImage(galleryImage);
                            setImageId(selectedImageId || undefined);

                            setImages((prev) => {
                              const filtered = prev.filter((_, imageIndex) => imageIndex !== index);

                              if (previousImage && previousImage !== galleryImage) {
                                return [previousImage, ...filtered];
                              }

                              return filtered;
                            });

                            setImageIds((prev) => {
                              const filtered = prev.filter((_, imageIndex) => imageIndex !== index);

                              if (previousImage && previousImage !== galleryImage) {
                                return [previousImageId || "", ...filtered];
                              }

                              return filtered;
                            });
                          }}
                          className="absolute bottom-0 left-0 right-0 bg-[var(--archive-accent)]/65 py-1.5 text-[8px] tracking-[0.06em] text-[var(--archive-bg)] opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          MAKE REPRESENTATIVE
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* BUTTONS */}
            <div className="flex flex-col-reverse gap-2 border-t border-[var(--archive-border)] px-5 py-5 sm:flex-row sm:justify-end sm:px-7">
              <button
                onClick={resetForm}
                disabled={isSaving}
                className="w-full rounded-full border border-[var(--archive-border)] bg-[var(--archive-card)] px-5 py-3 text-[9px] tracking-[0.1em] transition hover:bg-[var(--archive-accent)]/[0.03] disabled:opacity-40 sm:w-auto"
              >
                CANCEL
              </button>

              <button
                onClick={editingCharacterId ? updateCharacter : addCharacter}
                disabled={isSaving}
                className="w-full rounded-full bg-[#262626] px-6 py-3 text-[9px] tracking-[0.1em] text-[var(--archive-bg)] shadow-sm transition hover:bg-[var(--archive-accent)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {isSaving
                  ? "SAVING..."
                  : editingCharacterId
                  ? "SAVE CHANGES"
                  : "SAVE CHARACTER"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
