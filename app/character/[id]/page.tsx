"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

type Character = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  image: string;
  images: string[];
  imageId?: string;
  imageIds?: string[];
};

type CharacterMetadata = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  image?: string;
  images?: string[];
  imageId?: string;
  imageIds?: string[];
};

type ProfilePrompt = {
  id: string;
  title: string;
  age: string;
  description: string;
  prompt: string;
};

type EditImage = {
  id?: string;
  dataUrl?: string;
  url: string;
};

const DB_NAME = "my-archive-db";
const DB_VERSION = 1;
const IMAGE_STORE = "character-images";
const CHARACTER_STORAGE_KEY = "my-archive-characters";

function openImageDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function saveImageToDB(dataUrl: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openImageDB();

      const response = await fetch(dataUrl);
      const blob = await response.blob();

      const id = crypto.randomUUID();

      const transaction = db.transaction(IMAGE_STORE, "readwrite");
      const store = transaction.objectStore(IMAGE_STORE);

      store.put(blob, id);

      transaction.oncomplete = () => {
        db.close();
        resolve(id);
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    } catch (error) {
      reject(error);
    }
  });
}

function deleteImageFromDB(id: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openImageDB();

      const transaction = db.transaction(IMAGE_STORE, "readwrite");
      const store = transaction.objectStore(IMAGE_STORE);

      store.delete(id);

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    } catch (error) {
      reject(error);
    }
  });
}

function getImageFromDB(id: string): Promise<string | null> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openImageDB();

      const transaction = db.transaction(IMAGE_STORE, "readonly");
      const store = transaction.objectStore(IMAGE_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        const blob = request.result;

        db.close();

        if (!blob) {
          resolve(null);
          return;
        }

        resolve(URL.createObjectURL(blob));
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    } catch (error) {
      reject(error);
    }
  });
}

function CharacterDetailContent() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<import("@supabase/supabase-js").User | null>(null);

  const characterId = String(params.id);

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

  const [character, setCharacter] = useState<Character | null>(null);
  const [profiles, setProfiles] = useState<ProfilePrompt[]>([]);

  // 프로필
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [editingProfileId, setEditingProfileId] =
    useState<string | null>(null);

  const [profileTitle, setProfileTitle] = useState("");
  const [profileAge, setProfileAge] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [profilePrompt, setProfilePrompt] = useState("");

  // 캐릭터 수정
  const [isEditingCharacter, setIsEditingCharacter] = useState(false);
  const [isSavingCharacter, setIsSavingCharacter] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTags, setEditTags] = useState("");

  const [editImage, setEditImage] = useState<EditImage | null>(null);
  const [editImages, setEditImages] = useState<EditImage[]>([]);

  // 이미지 뷰어
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  /*
   * 캐릭터 불러오기
   * - 상세 페이지는 localStorage가 아니라 Supabase를 기준으로 읽는다.
   * - 로그아웃 상태에서도 공개된 캐릭터를 조회할 수 있다.
   * - 이미지 파일은 현재 IndexedDB에 있으므로, 이미지 ID가 있는 경우
   *   현재 브라우저의 IndexedDB에서 먼저 불러온다.
   */
  useEffect(() => {
    const loadCharacter = async () => {
      try {
        const { data, error } = await supabase
          .from("characters")
          .select("*")
          .eq("id", characterId)
          .maybeSingle();

        if (error) {
          console.error("Supabase 캐릭터 조회 오류:", error);
          setCharacter(null);
          return;
        }

        if (!data) {
          setCharacter(null);
          return;
        }

        let representativeImage = "";
        let galleryImages: string[] = [];

        if (data.representative_image_id) {
          const imageUrl = await getImageFromDB(
            data.representative_image_id
          );

          if (imageUrl) {
            representativeImage = imageUrl;
          }
        }

        if (data.image_ids?.length) {
          const loadedImages = await Promise.all(
            data.image_ids.map((id: string) => getImageFromDB(id))
          );

          galleryImages = loadedImages.filter(
            (image): image is string => Boolean(image)
          );
        }

        setCharacter({
          id: data.id,
          name: data.name,
          description: data.description ?? "",
          tags: data.tags ?? [],
          image: representativeImage,
          images: galleryImages,
          imageId: data.representative_image_id ?? undefined,
          imageIds: data.image_ids ?? [],
        });
      } catch (error) {
        console.error("캐릭터 데이터를 불러오지 못했습니다.", error);
        setCharacter(null);
      }
    };

    loadCharacter();
  }, [characterId]);

  /*
   * 프로필 프롬프트 불러오기
   */
  useEffect(() => {
    const saved = localStorage.getItem(
      `my-archive-profiles-${characterId}`
    );

    if (!saved) return;

    try {
      setProfiles(JSON.parse(saved));
    } catch (error) {
      console.error(
        "프로필 프롬프트를 불러오지 못했습니다.",
        error
      );
    }
  }, [characterId]);

  /*
   * 캐릭터 수정 모달 열기
   */
  const openCharacterEdit = () => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/character/${characterId}`)}`);
      return;
    }

    if (!character) return;

    setEditName(character.name);
    setEditDescription(character.description);
    setEditTags(character.tags.join(", "));

    setEditImage(
      character.image
        ? {
            id: character.imageId,
            url: character.image,
          }
        : null
    );

    const gallery = character.images.map((url, index) => ({
      id: character.imageIds?.[index],
      url,
    }));

    setEditImages(gallery);

    setIsEditingCharacter(true);
  };

  /*
   * 캐릭터 수정 모달 닫기
   */
  const closeCharacterEdit = () => {
    if (isSavingCharacter) return;

    setIsEditingCharacter(false);
    setEditName("");
    setEditDescription("");
    setEditTags("");
    setEditImage(null);
    setEditImages([]);
  };

  /*
   * 대표 이미지 업로드
   */
  const handleEditImageUpload = (
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
        setEditImage({
          dataUrl: reader.result,
          url: reader.result,
        });
      }
    };

    reader.onerror = () => {
      alert("이미지를 불러오지 못했습니다.");
    };

    reader.readAsDataURL(file);

    event.target.value = "";
  };

  /*
   * 갤러리 이미지 업로드
   */
  const handleEditGalleryUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    const imageFiles = files.filter((file) =>
      file.type.startsWith("image/")
    );

    if (imageFiles.length !== files.length) {
      alert("이미지 파일만 업로드할 수 있습니다.");
    }

    const readers = imageFiles.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = () => {
            if (typeof reader.result === "string") {
              resolve(reader.result);
            } else {
              reject(new Error("이미지를 읽을 수 없습니다."));
            }
          };

          reader.onerror = () => {
            reject(new Error("이미지를 읽을 수 없습니다."));
          };

          reader.readAsDataURL(file);
        })
    );

    Promise.all(readers)
      .then((newImages) => {
        setEditImages((prev) => [
          ...prev,
          ...newImages.map((dataUrl) => ({
            dataUrl,
            url: dataUrl,
          })),
        ]);
      })
      .catch(() => {
        alert("이미지를 불러오지 못했습니다.");
      });

    event.target.value = "";
  };

  /*
   * 대표 이미지 제거
   */
  const removeEditImage = () => {
    setEditImage(null);
  };

  /*
   * 갤러리 이미지 삭제
   */
  const removeEditGalleryImage = (index: number) => {
    setEditImages((prev) =>
      prev.filter((_, imageIndex) => imageIndex !== index)
    );
  };

  /*
   * 갤러리 이미지를 대표 이미지로 변경
   */
  const makeEditRepresentative = (index: number) => {
    const selected = editImages[index];

    if (!selected) return;

    const previousRepresentative = editImage;

    setEditImage(selected);

    setEditImages((prev) => {
      const filtered = prev.filter(
        (_, imageIndex) => imageIndex !== index
      );

      if (previousRepresentative) {
        return [previousRepresentative, ...filtered];
      }

      return filtered;
    });
  };

  /*
   * 캐릭터 수정 저장
   */
  const saveCharacterChanges = async () => {
    if (!character) return;

    if (!user) {
      router.push(
        `/login?redirect=${encodeURIComponent(`/character/${characterId}`)}`
      );
      return;
    }

    if (!editName.trim()) {
      alert("캐릭터 이름을 입력해주세요.");
      return;
    }

    setIsSavingCharacter(true);

    try {
      const oldImageIds = [
        character.imageId,
        ...(character.imageIds ?? []),
      ].filter(Boolean) as string[];

      let newRepresentativeId: string | undefined;

      if (editImage?.dataUrl) {
        newRepresentativeId = await saveImageToDB(editImage.dataUrl);
      } else if (editImage?.id) {
        newRepresentativeId = editImage.id;
      }

      const newGalleryIds: string[] = [];

      for (const image of editImages) {
        if (image.dataUrl) {
          const newId = await saveImageToDB(image.dataUrl);
          newGalleryIds.push(newId);
        } else if (image.id) {
          newGalleryIds.push(image.id);
        }
      }

      const usedImageIds = [
        newRepresentativeId,
        ...newGalleryIds,
      ].filter(Boolean) as string[];

      const imagesToDelete = oldImageIds.filter(
        (id) => !usedImageIds.includes(id)
      );

      await Promise.all(
        imagesToDelete.map((id) => deleteImageFromDB(id))
      );

      const { data: updatedRow, error } = await supabase
        .from("characters")
        .update({
          name: editName.trim(),
          description: editDescription.trim(),
          tags: editTags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          representative_image_id: newRepresentativeId ?? null,
          image_ids: newGalleryIds,
          updated_at: new Date().toISOString(),
        })
        .eq("id", character.id)
        .eq("user_id", user.id)
        .select("*")
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!updatedRow) {
        throw new Error("캐릭터 수정 권한이 없거나 캐릭터를 찾을 수 없습니다.");
      }

      const updatedCharacter: Character = {
        ...character,
        name: updatedRow.name,
        description: updatedRow.description ?? "",
        tags: updatedRow.tags ?? [],
        image: editImage?.url ?? "",
        images: editImages.map((image) => image.url),
        imageId: updatedRow.representative_image_id ?? undefined,
        imageIds: updatedRow.image_ids ?? [],
      };

      setCharacter(updatedCharacter);

      // 기존 상세 페이지와의 호환을 위해 현재 브라우저에도 메타데이터를 남긴다.
      const saved = localStorage.getItem(CHARACTER_STORAGE_KEY);
      if (saved) {
        try {
          const characters: CharacterMetadata[] = JSON.parse(saved);
          const updatedCharacters = characters.map((item) =>
            item.id === character.id
              ? {
                  ...item,
                  name: updatedCharacter.name,
                  description: updatedCharacter.description,
                  tags: updatedCharacter.tags,
                  imageId: updatedCharacter.imageId,
                  imageIds: updatedCharacter.imageIds,
                }
              : item
          );

          localStorage.setItem(
            CHARACTER_STORAGE_KEY,
            JSON.stringify(updatedCharacters)
          );
        } catch {
          // localStorage 호환 데이터가 깨져 있어도 Supabase 저장은 성공한 것으로 처리한다.
        }
      }

      closeCharacterEdit();
    } catch (error) {
      console.error("캐릭터 저장 실패:", error);
      alert("캐릭터를 저장하지 못했습니다.");
    } finally {
      setIsSavingCharacter(false);
    }
  };

  /*
   * 이미지 뷰어
   */
  const openImageViewer = (
    images: string[],
    index: number
  ) => {
    if (images.length === 0) return;

    setViewerImages(images);
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const closeImageViewer = () => {
    setViewerOpen(false);
  };

  const showPreviousImage = () => {
    setViewerIndex((current) =>
      current === 0
        ? viewerImages.length - 1
        : current - 1
    );
  };

  const showNextImage = () => {
    setViewerIndex((current) =>
      current === viewerImages.length - 1
        ? 0
        : current + 1
    );
  };

  /*
   * 이미지 뷰어 키보드
   */
  useEffect(() => {
    if (!viewerOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeImageViewer();
      }

      if (event.key === "ArrowLeft") {
        showPreviousImage();
      }

      if (event.key === "ArrowRight") {
        showNextImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );

      document.body.style.overflow = "";
    };
  }, [viewerOpen, viewerImages.length]);

  /*
   * 프로필 추가
   */
  const addProfile = () => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/character/${characterId}`)}`);
      return;
    }

    if (!profileTitle.trim()) {
      alert("프로필 이름을 입력해주세요.");
      return;
    }

    if (!profilePrompt.trim()) {
      alert("프로필 프롬프트를 입력해주세요.");
      return;
    }

    const newProfile: ProfilePrompt = {
      id: crypto.randomUUID(),
      title: profileTitle.trim(),
      age: profileAge.trim(),
      description: profileDescription.trim(),
      prompt: profilePrompt.trim(),
    };

    const updatedProfiles = [...profiles, newProfile];

    setProfiles(updatedProfiles);

    localStorage.setItem(
      `my-archive-profiles-${characterId}`,
      JSON.stringify(updatedProfiles)
    );

    resetProfileForm();
  };

  /*
   * 프로필 수정
   */
  const updateProfile = () => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/character/${characterId}`)}`);
      return;
    }

    if (!editingProfileId) return;

    if (!profileTitle.trim()) {
      alert("프로필 이름을 입력해주세요.");
      return;
    }

    if (!profilePrompt.trim()) {
      alert("프로필 프롬프트를 입력해주세요.");
      return;
    }

    const updatedProfiles = profiles.map((profile) =>
      profile.id === editingProfileId
        ? {
            ...profile,
            title: profileTitle.trim(),
            age: profileAge.trim(),
            description: profileDescription.trim(),
            prompt: profilePrompt.trim(),
          }
        : profile
    );

    setProfiles(updatedProfiles);

    localStorage.setItem(
      `my-archive-profiles-${characterId}`,
      JSON.stringify(updatedProfiles)
    );

    resetProfileForm();
  };

  const resetProfileForm = () => {
    setProfileTitle("");
    setProfileAge("");
    setProfileDescription("");
    setProfilePrompt("");
    setEditingProfileId(null);
    setIsAddingProfile(false);
  };

  /*
   * 프로필 삭제
   */
  const deleteProfile = (id: string) => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/character/${characterId}`)}`);
      return;
    }

    if (!confirm("이 프로필 프롬프트를 삭제할까요?")) {
      return;
    }

    const updatedProfiles = profiles.filter(
      (profile) => profile.id !== id
    );

    setProfiles(updatedProfiles);

    localStorage.setItem(
      `my-archive-profiles-${characterId}`,
      JSON.stringify(updatedProfiles)
    );
  };

  /*
   * 프로필 복사
   */
  const copyPrompt = async (prompt: string) => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/character/${characterId}`)}`);
      return;
    }

    try {
      await navigator.clipboard.writeText(prompt);
      alert("프로필 프롬프트가 복사되었습니다.");
    } catch {
      alert("복사하지 못했습니다.");
    }
  };

  /*
   * 캐릭터가 아직 로딩되지 않은 경우
   */
  if (!character) {
    return (
      <main className="min-h-screen bg-[#f7f6f2] px-5 py-8 text-[#171717] sm:px-8 lg:px-12">
        <button
          onClick={() => router.push("/character")}
          className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-[10px] font-medium tracking-[0.12em] text-black/50 shadow-sm transition hover:border-black/20 hover:text-black"
        >
          ← BACK TO CHARACTERS
        </button>

        <div className="mt-10 flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-black/40">캐릭터를 불러오는 중...</p>
        </div>
      </main>
    );
  }

  const allCharacterImages = [
    ...(character.image ? [character.image] : []),
    ...character.images,
  ];

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#171717]">
      <main className="mx-auto w-full max-w-[1500px] px-5 pb-20 pt-8 sm:px-8 lg:px-12">
        {/* BACK */}
        <button
          onClick={() => router.push("/character")}
          className="mb-7 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-[10px] font-medium tracking-[0.12em] text-black/50 shadow-sm transition hover:border-black/20 hover:text-black"
        >
          ← BACK TO CHARACTERS
        </button>

        {/* CHARACTER PROFILE */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(320px,420px)_1fr] lg:gap-8">
          {/* IMAGE */}
          <div className="min-w-0">
            <div
              className={`group relative aspect-[4/5] overflow-hidden rounded-[24px] border border-black/8 bg-[#ecebe6] shadow-[0_10px_35px_rgba(0,0,0,0.04)] ${
                character.image ? "cursor-zoom-in" : ""
              }`}
              onClick={() =>
                openImageViewer(allCharacterImages, 0)
              }
            >
              {character.image ? (
                <>
                  <img
                    src={character.image}
                    alt={character.name}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.015]"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-black/35 to-transparent p-5 pt-16 opacity-0 transition group-hover:opacity-100">
                    <span className="rounded-full bg-white/90 px-3 py-1.5 text-[9px] font-medium tracking-[0.1em] text-black/60">
                      VIEW IMAGE
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] font-medium tracking-[0.12em] text-black/25">
                  NO IMAGE
                </div>
              )}
            </div>

            {/* GALLERY */}
            {character.images.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2.5 sm:grid-cols-5">
                {character.images.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    onClick={() =>
                      openImageViewer(
                        allCharacterImages,
                        index + 1
                      )
                    }
                    className="group aspect-square overflow-hidden rounded-xl border border-black/8 bg-white shadow-sm"
                  >
                    <img
                      src={image}
                      alt={`갤러리 이미지 ${index + 1}`}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* INFO */}
          <div className="min-w-0 rounded-[24px] border border-black/8 bg-white p-6 shadow-[0_10px_35px_rgba(0,0,0,0.035)] sm:p-8 lg:p-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-3 text-[9px] font-medium tracking-[0.22em] text-black/35">
                  CHARACTER PROFILE
                </p>
                <h1 className="break-words text-4xl font-light tracking-[-0.035em] sm:text-5xl">
                  {character.name}
                </h1>
              </div>

              <button
                onClick={openCharacterEdit}
                  className="shrink-0 rounded-full border border-black/10 bg-[#f7f6f2] px-4 py-2.5 text-[7px] font-medium tracking-[0.1em] text-black/50 transition hover:border-black/20 hover:bg-black hover:text-white"
                >
                  EDIT
                </button>
            </div>

            <div className="mt-8 h-px bg-black/8" />

            {character.description && (
              <div className="mt-7">
                <p className="mb-3 text-[9px] font-medium tracking-[0.18em] text-black/30">
                  DESCRIPTION
                </p>
                <p className="whitespace-pre-wrap text-sm leading-7 text-black/65">
                  {character.description}
                </p>
              </div>
            )}

            {character.tags.length > 0 && (
              <div className={character.description ? "mt-8" : "mt-7"}>
                <p className="mb-3 text-[9px] font-medium tracking-[0.18em] text-black/30">
                  TAGS
                </p>

                <div className="flex flex-wrap gap-2">
                  {character.tags.map((tag, index) => (
                    <span
                      key={`${tag}-${index}`}
                      className="rounded-full border border-black/8 bg-[#f7f6f2] px-3 py-1.5 text-[10px] text-black/55"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!character.description && character.tags.length === 0 && (
              <p className="mt-7 text-xs text-black/30">
                아직 등록된 설명이나 태그가 없습니다.
              </p>
            )}
          </div>
        </section>

        {/* PROFILE PROMPTS */}
        <section className="mt-8 rounded-[24px] border border-black/8 bg-white p-6 shadow-[0_10px_35px_rgba(0,0,0,0.025)] sm:p-8 lg:p-10">
          <div className="flex flex-col gap-5 border-b border-black/8 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-[9px] font-medium tracking-[0.22em] text-black/30">
                CHAT PROFILE
              </p>
              <h2 className="text-2xl font-light tracking-[-0.025em] sm:text-3xl">
                PROFILE PROMPTS
              </h2>
              <p className="mt-2 text-xs leading-5 text-black/35">
                나이와 설정에 따라 여러 개의 프로필 프롬프트를 저장할 수 있습니다.
              </p>
            </div>

            <button
              onClick={() => {
                if (!user) {
                  router.push(
                    `/login?redirect=${encodeURIComponent(`/character/${characterId}`)}`
                  );
                  return;
                }

                resetProfileForm();
                setIsAddingProfile(true);
              }}
                className="inline-flex w-fit items-center rounded-full bg-[#171717] px-5 py-3 text-[10px] font-medium tracking-[0.1em] text-white transition hover:bg-black/75"
              >
                + ADD PROFILE
              </button>
          </div>

          {profiles.length === 0 ? (
            <div className="mt-6 flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-black/10 bg-[#faf9f6] px-6">
              <div className="text-center">
                <p className="mb-2 text-sm text-black/60">
                  아직 프로필 프롬프트가 없습니다.
                </p>
                <p className="text-xs text-black/30">
                  나이별 또는 AU별 프로필을 추가해보세요.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="rounded-2xl border border-black/8 bg-[#faf9f6] p-5 transition hover:border-black/15 hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] sm:p-6"
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="break-words text-lg font-medium tracking-[-0.02em]">
                        {profile.title}
                      </h3>

                      {profile.age && (
                        <p className="mt-1.5 text-[10px] tracking-[0.08em] text-black/35">
                          AGE · {profile.age}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
  <button
    onClick={() => {
      if (!user) {
        router.push(
          `/login?redirect=${encodeURIComponent(`/character/${characterId}`)}`
        );
        return;
      }

      setEditingProfileId(profile.id);
      setProfileTitle(profile.title);
      setProfileAge(profile.age);
      setProfileDescription(profile.description);
      setProfilePrompt(profile.prompt);
      setIsAddingProfile(true);
    }}
    className="rounded-full px-2.5 py-1.5 text-[7px] font-medium tracking-[0.08em] text-black/35 transition hover:bg-white hover:text-black"
  >
    EDIT
  </button>

                        <button
                          onClick={() => deleteProfile(profile.id)}
                          className="rounded-full px-2.5 py-1.5 text-[7px] font-medium tracking-[0.08em] text-black/30 transition hover:bg-red-50 hover:text-red-500"
                        >
                          DELETE
                        </button>
                    </div>
                  </div>

                  {profile.description && (
                    <p className="mb-5 whitespace-pre-wrap text-xs leading-5 text-black/55">
                      {profile.description}
                    </p>
                  )}

                  <div className="rounded-xl border border-black/5 bg-white p-4">
                    <p className="mb-3 text-[8px] font-medium tracking-[0.15em] text-black/30">
                      PROFILE PROMPT
                    </p>

                    <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-black/65">
                      {profile.prompt}
                    </p>
                  </div>

                  {user && (
                    <button
                      onClick={() => copyPrompt(profile.prompt)}
                      className="mt-3 w-full rounded-full border border-black/10 bg-white py-2.5 text-[9px] font-medium tracking-[0.1em] text-black/45 transition hover:border-black/20 hover:bg-black hover:text-white"
                    >
                      COPY PROMPT
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* LINKED ARCHIVE */}
        <section className="mt-8 rounded-[24px] border border-black/8 bg-white p-6 shadow-[0_10px_35px_rgba(0,0,0,0.025)] sm:p-8">
          <div className="mb-5">
            <p className="mb-2 text-[9px] font-medium tracking-[0.22em] text-black/30">
              LINKED ARCHIVE
            </p>
            <p className="text-xs text-black/35">
              이 캐릭터와 관련된 다른 아카이브로 이동합니다.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: "PAIR", href: "/pair" },
              { label: "PROMPT", href: "/prompt" },
              { label: "NOTE", href: "/note" },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => router.push(item.href)}
                className="flex items-center justify-between rounded-2xl border border-black/8 bg-[#faf9f6] px-5 py-4 text-left transition hover:border-black/15 hover:bg-white hover:shadow-sm"
              >
                <span className="text-[10px] font-medium tracking-[0.12em] text-black/50">
                  {item.label}
                </span>
                <span className="text-black/25">→</span>
              </button>
            ))}
          </div>
        </section>
      </main>

      {/* CHARACTER EDIT MODAL */}
      {isEditingCharacter && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/35 p-3 backdrop-blur-sm sm:p-5">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[24px] border border-black/8 bg-[#f7f6f2] p-5 shadow-2xl sm:p-7 md:p-8">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-[9px] font-medium tracking-[0.2em] text-black/30">
                  CHARACTER
                </p>
                <h2 className="text-2xl font-light tracking-[-0.025em]">
                  EDIT CHARACTER
                </h2>
              </div>

              <button
                onClick={closeCharacterEdit}
                disabled={isSavingCharacter}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-black/8 bg-white text-xl font-light text-black/35 transition hover:text-black disabled:opacity-40"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* NAME */}
              <div>
                <label className="mb-2 block text-[9px] font-medium tracking-[0.15em] text-black/40">
                  NAME
                </label>

                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-black/8 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20"
                />
              </div>

              {/* DESCRIPTION */}
              <div>
                <label className="mb-2 block text-[9px] font-medium tracking-[0.15em] text-black/40">
                  DESCRIPTION
                </label>

                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={6}
                  className="w-full resize-y rounded-xl border border-black/8 bg-white p-4 text-sm leading-6 outline-none transition focus:border-black/20"
                />
              </div>

              {/* TAGS */}
              <div>
                <label className="mb-2 block text-[9px] font-medium tracking-[0.15em] text-black/40">
                  TAGS
                </label>

                <input
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="예: military, fashion, cold"
                  className="w-full rounded-xl border border-black/8 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20"
                />

                <p className="mt-2 text-[10px] text-black/30">
                  태그는 쉼표(,)로 구분해주세요.
                </p>
              </div>

              {/* REPRESENTATIVE IMAGE */}
              <div>
                <label className="mb-2 block text-[9px] font-medium tracking-[0.15em] text-black/40">
                  REPRESENTATIVE IMAGE
                </label>

                <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-black/10 bg-white px-4 py-5 text-[10px] font-medium tracking-[0.1em] text-black/40 transition hover:border-black/20 hover:text-black">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEditImageUpload}
                    className="hidden"
                  />
                  {editImage ? "CHANGE IMAGE" : "SELECT IMAGE"}
                </label>

                {editImage && (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-black/8 bg-white">
                    <div className="aspect-[4/5]">
                      <img
                        src={editImage.url}
                        alt="대표 이미지 미리보기"
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={removeEditImage}
                      className="w-full border-t border-black/8 py-3 text-[9px] font-medium tracking-[0.1em] text-black/35 transition hover:text-red-500"
                    >
                      REMOVE IMAGE
                    </button>
                  </div>
                )}
              </div>

              {/* GALLERY */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-[9px] font-medium tracking-[0.15em] text-black/40">
                    GALLERY IMAGES
                  </label>

                  {editImages.length > 0 && (
                    <span className="text-[10px] text-black/30">
                      {editImages.length} IMAGES
                    </span>
                  )}
                </div>

                <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-black/10 bg-white px-4 py-6 text-[10px] font-medium tracking-[0.1em] text-black/40 transition hover:border-black/20 hover:text-black">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleEditGalleryUpload}
                    className="hidden"
                  />
                  + ADD IMAGES
                </label>

                {editImages.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                    {editImages.map((image, index) => (
                      <div
                        key={`${image.id ?? image.url}-${index}`}
                        className="group relative overflow-hidden rounded-xl border border-black/8 bg-white"
                      >
                        <div className="aspect-square">
                          <img
                            src={image.url}
                            alt={`갤러리 이미지 ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => removeEditGalleryImage(index)}
                          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          ×
                        </button>

                        <button
                          type="button"
                          onClick={() => makeEditRepresentative(index)}
                          className="absolute bottom-0 left-1 right-1 rounded-lg bg-black/75 py-1.5 text-[8px] font-medium tracking-[0.06em] text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          MAKE REPRESENTATIVE
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <button
                onClick={closeCharacterEdit}
                disabled={isSavingCharacter}
                className="rounded-full border border-black/10 bg-white px-5 py-3 text-[10px] font-medium tracking-[0.1em] text-black/50 transition hover:border-black/20 hover:text-black disabled:opacity-40"
              >
                CANCEL
              </button>

              <button
                onClick={saveCharacterChanges}
                disabled={isSavingCharacter}
                className="rounded-full bg-[#171717] px-5 py-3 text-[10px] font-medium tracking-[0.1em] text-white transition hover:bg-black/75 disabled:opacity-50"
              >
                {isSavingCharacter ? "SAVING..." : "SAVE CHANGES"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROFILE MODAL */}
      {isAddingProfile && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/35 p-3 backdrop-blur-sm sm:p-5">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[24px] border border-black/8 bg-[#f7f6f2] p-5 shadow-2xl sm:p-7 md:p-8">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-[9px] font-medium tracking-[0.2em] text-black/30">
                  CHAT PROFILE
                </p>
                <h2 className="text-2xl font-light tracking-[-0.025em]">
                  {editingProfileId ? "EDIT PROFILE" : "ADD PROFILE"}
                </h2>
              </div>

              <button
                onClick={resetProfileForm}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-black/8 bg-white text-xl font-light text-black/35 transition hover:text-black"
              >
                ×
              </button>
            </div>

            <div className="space-y-5">
              {/* TITLE */}
              <div>
                <label className="mb-2 block text-[9px] font-medium tracking-[0.15em] text-black/40">
                  PROFILE NAME
                </label>

                <input
                  value={profileTitle}
                  onChange={(e) => setProfileTitle(e.target.value)}
                  placeholder="예: 특수부대 희운"
                  className="w-full rounded-xl border border-black/8 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20"
                />
              </div>

              {/* AGE */}
              <div>
                <label className="mb-2 block text-[9px] font-medium tracking-[0.15em] text-black/40">
                  AGE
                </label>

                <input
                  value={profileAge}
                  onChange={(e) => setProfileAge(e.target.value)}
                  placeholder="예: 27세"
                  className="w-full rounded-xl border border-black/8 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20"
                />
              </div>

              {/* DESCRIPTION */}
              <div>
                <label className="mb-2 block text-[9px] font-medium tracking-[0.15em] text-black/40">
                  DESCRIPTION
                </label>

                <textarea
                  value={profileDescription}
                  onChange={(e) => setProfileDescription(e.target.value)}
                  placeholder="이 프로필의 간단한 설명"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-black/8 bg-white p-4 text-sm outline-none transition focus:border-black/20"
                />
              </div>

              {/* PROMPT */}
              <div>
                <label className="mb-2 block text-[9px] font-medium tracking-[0.15em] text-black/40">
                  PROFILE PROMPT
                </label>

                <textarea
                  value={profilePrompt}
                  onChange={(e) => setProfilePrompt(e.target.value)}
                  placeholder="채팅 프로필에 복사해서 사용할 프롬프트를 입력하세요."
                  rows={12}
                  className="w-full resize-y rounded-xl border border-black/8 bg-white p-4 text-sm leading-6 outline-none transition focus:border-black/20"
                />
              </div>
            </div>

            <div className="mt-8 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <button
                onClick={resetProfileForm}
                className="rounded-full border border-black/10 bg-white px-5 py-3 text-[10px] font-medium tracking-[0.1em] text-black/50 transition hover:border-black/20 hover:text-black"
              >
                CANCEL
              </button>

              <button
                onClick={editingProfileId ? updateProfile : addProfile}
                className="rounded-full bg-[#171717] px-5 py-3 text-[10px] font-medium tracking-[0.1em] text-white transition hover:bg-black/75"
              >
                {editingProfileId ? "SAVE CHANGES" : "SAVE PROFILE"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE VIEWER */}
      {viewerOpen && viewerImages.length > 0 && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-3 sm:p-5"
          onClick={closeImageViewer}
        >
          <button
            onClick={closeImageViewer}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl font-light text-white/70 transition hover:bg-white/15 hover:text-white sm:right-6 sm:top-5"
          >
            ×
          </button>

          <div className="absolute left-4 top-5 rounded-full bg-white/10 px-3 py-1.5 text-[9px] tracking-[0.12em] text-white/55 sm:left-6 sm:top-6">
            {viewerIndex + 1} / {viewerImages.length}
          </div>

          {viewerImages.length > 1 && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                showPreviousImage();
              }}
              className="absolute left-1 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-3xl font-light text-white/65 transition hover:bg-white/15 hover:text-white sm:left-5"
            >
              ‹
            </button>
          )}

          <img
            src={viewerImages[viewerIndex]}
            alt={`${character.name} 이미지 ${viewerIndex + 1}`}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[88vh] max-w-[88vw] rounded-xl object-contain shadow-2xl"
          />

          {viewerImages.length > 1 && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                showNextImage();
              }}
              className="absolute right-1 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-3xl font-light text-white/65 transition hover:bg-white/15 hover:text-white sm:right-5"
            >
              ›
            </button>
          )}

          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/10 px-3 py-1.5 text-[8px] tracking-[0.1em] text-white/40">
            ESC TO CLOSE · ← → TO NAVIGATE
          </p>
        </div>
      )}
    </div>
  );
}

export default function CharacterDetailPage() {
  return (
    <Suspense fallback={null}>
      <CharacterDetailContent />
    </Suspense>
  );
}
