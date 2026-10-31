"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const CHARACTER_STORAGE_KEY = "my-archive-characters";
const PAIR_STORAGE_KEY = "my-archive-pairs";

const DB_NAME = "my-archive-db";
const DB_VERSION = 1;
const IMAGE_STORE = "character-images";

type PairImageMode = "single" | "characters";

type Character = {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  image?: string;
  images?: string[];
  imageId?: string;
  imageIds?: string[];
};

type ParticipantType = "archive" | "external";

type Pair = {
  id: string;
  name: string;
  characterAType: ParticipantType;
  characterAId?: string;
  characterAName: string;
  characterBType: ParticipantType;
  characterBId?: string;
  characterBName: string;
  relationship: string;
  description: string;
  tags: string[];
  representativeImageId?: string;
  characterAImageId?: string;
  characterBImageId?: string;
  detailImageIds?: string[];
};

type ImageUploadProps = {
  label: string;
  imageId?: string;
  imageUrl?: string;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  compact?: boolean;
};

function openImageDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        reject(new Error(`IndexedDB store "${IMAGE_STORE}" not found.`));
        return;
      }

      resolve(db);
    };
  });
}

function saveImageToDB(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fetch(dataUrl)
      .then((response) => response.blob())
      .then(async (blob) => {
        const db = await openImageDB();
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
      })
      .catch(reject);
  });
}

function getImageFromDB(id?: string): Promise<string | undefined> {
  if (!id) return Promise.resolve(undefined);

  return new Promise((resolve, reject) => {
    openImageDB()
      .then((db) => {
        const transaction = db.transaction(IMAGE_STORE, "readonly");
        const request = transaction.objectStore(IMAGE_STORE).get(id);

        request.onsuccess = () => {
          db.close();

          if (!request.result) {
            resolve(undefined);
            return;
          }

          resolve(URL.createObjectURL(request.result));
        };

        request.onerror = () => {
          db.close();
          reject(request.error);
        };
      })
      .catch(() => resolve(undefined));
  });
}

function deleteImageFromDB(id?: string): Promise<void> {
  if (!id) return Promise.resolve();

  return new Promise((resolve) => {
    openImageDB()
      .then((db) => {
        const transaction = db.transaction(IMAGE_STORE, "readwrite");
        transaction.objectStore(IMAGE_STORE).delete(id);

        transaction.oncomplete = () => {
          db.close();
          resolve();
        };

        transaction.onerror = () => {
          db.close();
          resolve();
        };
      })
      .catch(() => resolve());
  });
}

function readStoredCharacters(): Character[] {
  try {
    const raw = localStorage.getItem(CHARACTER_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readStoredPairs(): Pair[] {
  try {
    const raw = localStorage.getItem(PAIR_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}


function getPairDuplicateKey(pair: Pair) {
  return JSON.stringify({
    name: pair.name ?? "",
    characterAType: pair.characterAType ?? "archive",
    characterAId: pair.characterAType === "archive" ? pair.characterAId ?? null : null,
    characterAName: pair.characterAName ?? "",
    characterBType: pair.characterBType ?? "archive",
    characterBId: pair.characterBType === "archive" ? pair.characterBId ?? null : null,
    characterBName: pair.characterBName ?? "",
    relationship: pair.relationship ?? "",
    description: pair.description ?? "",
    tags: pair.tags ?? [],
    representativeImageId: pair.representativeImageId ?? null,
    characterAImageId: pair.characterAImageId ?? null,
    characterBImageId: pair.characterBImageId ?? null,
    detailImageIds: pair.detailImageIds ?? [],
  });
}

function dedupePairs(pairs: Pair[]) {
  const seen = new Set<string>();
  const result: Pair[] = [];

  for (const pair of pairs) {
    const key = getPairDuplicateKey(pair);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(pair);
  }

  return result;
}

function savePairs(pairs: Pair[]) {
  localStorage.setItem(PAIR_STORAGE_KEY, JSON.stringify(pairs));
}

function getCharacterImageId(character?: Character): string | undefined {
  return character?.imageId ?? character?.imageIds?.[0];
}

function getPairOwnedImageIds(pair?: Pair | null): string[] {
  if (!pair) return [];

  return [
    pair.representativeImageId,
    pair.characterAImageId,
    pair.characterBImageId,
    ...(pair.detailImageIds ?? []),
  ].filter((id): id is string => Boolean(id));
}

function dataUrlFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("이미지를 읽을 수 없습니다."));
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function ImageUploadSection({
  label,
  imageId,
  imageUrl,
  onUpload,
  onRemove,
  compact = false,
}: ImageUploadProps) {
  return (
    <div
      className={`rounded-2xl border border-[var(--archive-border)] bg-[var(--archive-card)] ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold tracking-[0.18em] text-[var(--archive-muted)]">
          {label}
        </span>

        {imageId && (
          <button
            type="button"
            onClick={onRemove}
            className="text-[10px] tracking-[0.12em] text-[var(--archive-text)]/45 transition hover:text-red-500"
          >
            REMOVE
          </button>
        )}
      </div>

      {imageUrl ? (
        <div className={`relative overflow-hidden rounded-xl bg-[var(--archive-accent)]/5 ${compact ? "aspect-square" : "aspect-[16/9]"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
          <label className="absolute bottom-2 right-2 cursor-pointer rounded-full bg-[var(--archive-card)]/90 px-3 py-1.5 text-[9px] font-semibold tracking-[0.14em] shadow-sm backdrop-blur transition hover:bg-[var(--archive-card)]">
            CHANGE
            <input
              type="file"
              accept="image/*"
              onChange={onUpload}
              className="hidden"
            />
          </label>
        </div>
      ) : (
        <label
          className={`flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[var(--archive-border)] bg-[var(--archive-accent)]/[0.02] text-center transition hover:border-[var(--archive-accent)]/30 hover:bg-[var(--archive-accent)]/[0.04] ${
            compact ? "aspect-square" : "aspect-[16/9]"
          }`}
        >
          <div>
            <div className="mb-1 text-xl font-light text-[var(--archive-muted)]">+</div>
            <div className="text-[10px] tracking-[0.12em] text-[var(--archive-text)]/45">
              ADD IMAGE
            </div>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={onUpload}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}

function ParticipantSelect({
  label,
  type,
  setType,
  archiveId,
  setArchiveId,
  externalName,
  setExternalName,
  characters,
  excludeId,
}: {
  label: string;
  type: ParticipantType;
  setType: (value: ParticipantType) => void;
  archiveId: string;
  setArchiveId: (value: string) => void;
  externalName: string;
  setExternalName: (value: string) => void;
  characters: Character[];
  excludeId?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-[9px] tracking-[0.15em] text-[var(--archive-muted)]">
        {label}
      </label>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setType("archive")}
          className={`border px-3 py-2 text-[9px] tracking-[0.08em] transition ${
            type === "archive"
              ? "border-[var(--archive-accent)] bg-[var(--archive-accent)] text-[var(--archive-bg)]"
              : "border-[var(--archive-border)] hover:border-[var(--archive-accent)]"
          }`}
        >
          ARCHIVE
        </button>

        <button
          type="button"
          onClick={() => setType("external")}
          className={`border px-3 py-2 text-[9px] tracking-[0.08em] transition ${
            type === "external"
              ? "border-[var(--archive-accent)] bg-[var(--archive-accent)] text-[var(--archive-bg)]"
              : "border-[var(--archive-border)] hover:border-[var(--archive-accent)]"
          }`}
        >
          AI / EXTERNAL
        </button>
      </div>

      {type === "archive" ? (
        <select
          value={archiveId}
          onChange={(e) => setArchiveId(e.target.value)}
          className="w-full border border-[var(--archive-border)] bg-[var(--archive-card)] px-3 py-2.5 text-xs outline-none"
        >
          <option value="">SELECT CHARACTER</option>

          {characters
            .filter((character) => character.id !== excludeId)
            .map((character) => (
              <option key={character.id} value={character.id}>
                {character.name}
              </option>
            ))}
        </select>
      ) : (
        <input
          type="text"
          value={externalName}
          onChange={(e) => setExternalName(e.target.value)}
          placeholder="AI 챗 캐릭터 이름"
          className="w-full border border-[var(--archive-border)] bg-[var(--archive-card)] px-3 py-2.5 text-xs outline-none placeholder:text-[var(--archive-muted)]"
        />
      )}
    </div>
  );
}

export default function PairPage() {
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [user, setUser] = useState<import("@supabase/supabase-js").User | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [editingPairId, setEditingPairId] = useState<string | null>(null);
  const [returnToDetail, setReturnToDetail] = useState(false);

  const [pairName, setPairName] = useState("");

  const [characterAType, setCharacterAType] =
    useState<ParticipantType>("archive");
  const [characterBType, setCharacterBType] =
    useState<ParticipantType>("archive");

  const [characterAId, setCharacterAId] = useState("");
  const [characterBId, setCharacterBId] = useState("");
  const [characterAName, setCharacterAName] = useState("");
  const [characterBName, setCharacterBName] = useState("");

  const [relationship, setRelationship] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const [imageMode, setImageMode] = useState<PairImageMode>("single");
  const [representativeImageId, setRepresentativeImageId] = useState<
    string | undefined
  >();
  const [characterAImageId, setCharacterAImageId] = useState<
    string | undefined
  >();
  const [characterBImageId, setCharacterBImageId] = useState<
    string | undefined
  >();
  const [detailImageIds, setDetailImageIds] = useState<string[]>([]);

  const [representativeImageUrl, setRepresentativeImageUrl] = useState<
    string | undefined
  >();
  const [characterAImageUrl, setCharacterAImageUrl] = useState<
    string | undefined
  >();
  const [characterBImageUrl, setCharacterBImageUrl] = useState<
    string | undefined
  >();
  const [detailImageUrls, setDetailImageUrls] = useState<
    Record<string, string>
  >({});

  const [temporaryImageIds, setTemporaryImageIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();

      if (!cancelled) setUser(authData.user ?? null);

      const savedCharacters = readStoredCharacters();
      if (!cancelled) setCharacters(savedCharacters);

      const { data: pairRows, error: pairError } = await supabase
        .from("pairs")
        .select("*")
        .order("created_at", { ascending: false });

      if (pairError) {
        console.error("PAIR 데이터 불러오기 실패:", pairError);
        if (!cancelled) setPairs(readStoredPairs());
        return;
      }

      if (pairError) {
        console.error("PAIR 데이터 불러오기 실패:", pairError);
        if (!cancelled) setPairs(readStoredPairs());
        return;
      }

      const localPairs = dedupePairs(readStoredPairs());
      savePairs(localPairs);

      const mappedRawPairs: Pair[] = (pairRows ?? []).map((row) => ({
        id: row.id,
        name: row.name ?? "",
        characterAType: (row.character_a_type ?? "archive") as ParticipantType,
        characterAId: row.character_a_id ?? undefined,
        characterAName: row.character_a_name ?? "",
        characterBType: (row.character_b_type ?? "archive") as ParticipantType,
        characterBId: row.character_b_id ?? undefined,
        characterBName: row.character_b_name ?? "",
        relationship: row.relationship ?? "",
        description: row.description ?? "",
        tags: Array.isArray(row.tags) ? row.tags : [],
        representativeImageId: row.representative_image_id ?? undefined,
        characterAImageId: row.character_a_image_id ?? undefined,
        characterBImageId: row.character_b_image_id ?? undefined,
        detailImageIds: Array.isArray(row.detail_image_ids)
          ? row.detail_image_ids
          : [],
      }));

      const mappedPairs = dedupePairs(mappedRawPairs);
      const duplicateIds = mappedRawPairs
        .filter((pair) => !mappedPairs.some((unique) => unique.id === pair.id))
        .map((pair) => pair.id);

      if (duplicateIds.length > 0 && authData.user) {
        const { error: duplicateDeleteError } = await supabase
          .from("pairs")
          .delete()
          .eq("user_id", authData.user.id)
          .in("id", duplicateIds);

        if (duplicateDeleteError) {
          console.error("중복 PAIR 정리 실패:", duplicateDeleteError);
        }
      }

      if ((!pairRows || pairRows.length === 0) && localPairs.length > 0 && authData.user) {
        const rowsToInsert = localPairs.map((pair) => ({
          id: pair.id,
          user_id: authData.user.id,
          name: pair.name,
          character_a_type: pair.characterAType ?? "archive",
          character_a_id:
            pair.characterAType === "archive" ? pair.characterAId ?? null : null,
          character_a_name: pair.characterAName,
          character_b_type: pair.characterBType ?? "archive",
          character_b_id:
            pair.characterBType === "archive" ? pair.characterBId ?? null : null,
          character_b_name: pair.characterBName,
          relationship: pair.relationship ?? "",
          description: pair.description ?? "",
          tags: pair.tags ?? [],
          representative_image_id: pair.representativeImageId ?? null,
          character_a_image_id: pair.characterAImageId ?? null,
          character_b_image_id: pair.characterBImageId ?? null,
          detail_image_ids: pair.detailImageIds ?? [],
        }));

        const { error: migrationError } = await supabase
          .from("pairs")
          .upsert(rowsToInsert, { onConflict: "id" });

        if (migrationError) {
          console.error("PAIR 기존 데이터 이전 실패:", migrationError);
          if (!cancelled) setPairs(localPairs);
          return;
        }

        if (!cancelled) setPairs(localPairs);
        return;
      }

      if (!cancelled) {
        setPairs(mappedPairs);
        savePairs(mappedPairs);
      }
    }

    loadData();

    const supabase = createClient();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadImages() {
      if (representativeImageId) {
        const url = await getImageFromDB(representativeImageId);
        if (!cancelled) setRepresentativeImageUrl(url);
      } else {
        setRepresentativeImageUrl(undefined);
      }

      if (characterAImageId) {
        const url = await getImageFromDB(characterAImageId);
        if (!cancelled) setCharacterAImageUrl(url);
      } else {
        setCharacterAImageUrl(undefined);
      }

      if (characterBImageId) {
        const url = await getImageFromDB(characterBImageId);
        if (!cancelled) setCharacterBImageUrl(url);
      } else {
        setCharacterBImageUrl(undefined);
      }

      const entries = await Promise.all(
        detailImageIds.map(async (id) => {
          const url = await getImageFromDB(id);
          return [id, url] as const;
        })
      );

      if (!cancelled) {
        const next: Record<string, string> = {};
        entries.forEach(([id, url]) => {
          if (url) next[id] = url;
        });
        setDetailImageUrls(next);
      }
    }

    loadImages();

    return () => {
      cancelled = true;
    };
  }, [
    representativeImageId,
    characterAImageId,
    characterBImageId,
    detailImageIds,
  ]);

  useEffect(() => {
    return () => {
      if (representativeImageUrl) URL.revokeObjectURL(representativeImageUrl);
      if (characterAImageUrl) URL.revokeObjectURL(characterAImageUrl);
      if (characterBImageUrl) URL.revokeObjectURL(characterBImageUrl);

      Object.values(detailImageUrls).forEach((url) =>
        URL.revokeObjectURL(url)
      );
    };
  }, [
    representativeImageUrl,
    characterAImageUrl,
    characterBImageUrl,
    detailImageUrls,
  ]);

  const characterMap = useMemo(() => {
    return new Map(characters.map((character) => [character.id, character]));
  }, [characters]);

  const selectedCharacterA =
    characterAType === "archive"
      ? characterMap.get(characterAId)
      : undefined;
  const selectedCharacterB =
    characterBType === "archive"
      ? characterMap.get(characterBId)
      : undefined;

  const displayCharacterAName =
    characterAType === "archive"
      ? selectedCharacterA?.name || "CHARACTER A"
      : characterAName || "AI CHARACTER A";

  const displayCharacterBName =
    characterBType === "archive"
      ? selectedCharacterB?.name || "CHARACTER B"
      : characterBName || "AI CHARACTER B";

  function resetForm() {
    setPairName("");

    setCharacterAType("archive");
    setCharacterBType("archive");

    setCharacterAId("");
    setCharacterBId("");
    setCharacterAName("");
    setCharacterBName("");

    setRelationship("");
    setDescription("");
    setTagsInput("");

    setImageMode("single");
    setRepresentativeImageId(undefined);
    setCharacterAImageId(undefined);
    setCharacterBImageId(undefined);
    setDetailImageIds([]);

    setTemporaryImageIds([]);
    setEditingPairId(null);
    setIsAdding(false);
  }

  async function cleanupTemporaryImages() {
    const ids = [...temporaryImageIds];

    await Promise.all(ids.map((id) => deleteImageFromDB(id)));
    setTemporaryImageIds([]);
  }

  function startAdd() {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent("/pair?add=1")}`);
      return;
    }

    resetForm();
    setIsAdding(true);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addMode = params.get("add");
    const editId = params.get("edit");
    const requestedReturnTo = params.get("returnTo");

    if (addMode === "1" && user) {
      startAdd();
      router.replace("/pair", { scroll: false });
      return;
    }

    if (!user || !editId || pairs.length === 0 || editingPairId === editId) {
      return;
    }

    const targetPair = pairs.find((pair) => pair.id === editId);

    if (targetPair) {
      // 상세페이지에서 들어온 수정이라면 저장/취소 후 원래 상세페이지로 돌아간다.
      setReturnToDetail(requestedReturnTo === "detail");

      // EDIT 쿼리는 한 번 읽어 수정 폼을 연 뒤 즉시 제거한다.
      // returnTo는 state에 보관하므로 URL에서 제거해도 복귀 위치를 잃지 않는다.
      router.replace("/pair", { scroll: false });
      startEdit(targetPair);
    }
  }, [pairs, editingPairId, router, user]);

  function startEdit(pair: Pair) {
    if (!user) {
      router.push("/login");
      return;
    }

    setEditingPairId(pair.id);
    setIsAdding(true);

    setPairName(pair.name);

    setCharacterAType(pair.characterAType ?? "archive");
    setCharacterBType(pair.characterBType ?? "archive");

    setCharacterAId(pair.characterAId ?? "");
    setCharacterBId(pair.characterBId ?? "");
    setCharacterAName(pair.characterAName ?? "");
    setCharacterBName(pair.characterBName ?? "");

    setRelationship(pair.relationship);
    setDescription(pair.description);
    setTagsInput(pair.tags.join(", "));

    setImageMode(pair.representativeImageId ? "single" : "characters");
    setRepresentativeImageId(pair.representativeImageId);
    setCharacterAImageId(pair.characterAImageId);
    setCharacterBImageId(pair.characterBImageId);
    setDetailImageIds(pair.detailImageIds ?? []);

    setTemporaryImageIds([]);
  }

  async function handleCancel() {
    const targetPairId = editingPairId;
    const shouldReturnToDetail = returnToDetail;

    await cleanupTemporaryImages();
    resetForm();

    setReturnToDetail(false);

    if (shouldReturnToDetail && targetPairId) {
      router.push(`/pair/${targetPairId}`);
    }
  }

  async function handleImageUpload(
    event: ChangeEvent<HTMLInputElement>,
    setter: (id: string | undefined) => void
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    try {
      const dataUrl = await dataUrlFromFile(file);
      const id = await saveImageToDB(dataUrl);

      setTemporaryImageIds((prev) => [...prev, id]);
      setter(id);
    } catch {
      alert("이미지를 저장하지 못했습니다.");
    }
  }

  async function handleDetailUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!files.length) return;

    try {
      const newIds = await Promise.all(
        files.map(async (file) => {
          const dataUrl = await dataUrlFromFile(file);
          return saveImageToDB(dataUrl);
        })
      );

      setTemporaryImageIds((prev) => [...prev, ...newIds]);
      setDetailImageIds((prev) => [...prev, ...newIds]);
    } catch {
      alert("이미지를 저장하지 못했습니다.");
    }
  }

  function removeImage(
    id: string | undefined,
    setter: (id: string | undefined) => void
  ) {
    if (!id) return;
    setter(undefined);
  }

  function removeDetailImage(id: string) {
    setDetailImageIds((prev) => prev.filter((imageId) => imageId !== id));
  }

  async function handleSave() {
    if (!user) {
      router.push("/login");
      return;
    }

    if (!pairName.trim()) {
      alert("PAIR 이름을 입력해주세요.");
      return;
    }

    if (characterAType === "archive" && !characterAId) {
      alert("CHARACTER A를 선택해주세요.");
      return;
    }

    if (characterBType === "archive" && !characterBId) {
      alert("CHARACTER B를 선택해주세요.");
      return;
    }

    if (characterAType === "external" && !characterAName.trim()) {
      alert("CHARACTER A의 이름을 입력해주세요.");
      return;
    }

    if (characterBType === "external" && !characterBName.trim()) {
      alert("CHARACTER B의 이름을 입력해주세요.");
      return;
    }

    if (
      characterAType === "archive" &&
      characterBType === "archive" &&
      characterAId === characterBId
    ) {
      alert("서로 다른 캐릭터를 선택해주세요.");
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        alert("로그인이 필요합니다.");
        return;
      }

      const oldPair = editingPairId
        ? pairs.find((pair) => pair.id === editingPairId)
        : undefined;

      const nextPair: Pair = {
        id: editingPairId ?? crypto.randomUUID(),
        name: pairName.trim(),
        characterAType,
        characterAId:
          characterAType === "archive" ? characterAId : undefined,
        characterAName:
          characterAType === "archive"
            ? selectedCharacterA?.name || ""
            : characterAName.trim(),
        characterBType,
        characterBId:
          characterBType === "archive" ? characterBId : undefined,
        characterBName:
          characterBType === "archive"
            ? selectedCharacterB?.name || ""
            : characterBName.trim(),
        relationship: relationship.trim(),
        description: description.trim(),
        tags: tagsInput
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        representativeImageId:
          imageMode === "single" ? representativeImageId : undefined,
        characterAImageId:
          imageMode === "characters" ? characterAImageId : undefined,
        characterBImageId:
          imageMode === "characters" ? characterBImageId : undefined,
        detailImageIds,
      };

      const row = {
        id: nextPair.id,
        user_id: authData.user.id,
        name: nextPair.name,
        character_a_type: nextPair.characterAType,
        character_a_id:
          nextPair.characterAType === "archive"
            ? nextPair.characterAId ?? null
            : null,
        character_a_name: nextPair.characterAName,
        character_b_type: nextPair.characterBType,
        character_b_id:
          nextPair.characterBType === "archive"
            ? nextPair.characterBId ?? null
            : null,
        character_b_name: nextPair.characterBName,
        relationship: nextPair.relationship,
        description: nextPair.description,
        tags: nextPair.tags,
        representative_image_id: nextPair.representativeImageId ?? null,
        character_a_image_id: nextPair.characterAImageId ?? null,
        character_b_image_id: nextPair.characterBImageId ?? null,
        detail_image_ids: nextPair.detailImageIds ?? [],
      };

      const { error: saveError } = await supabase
        .from("pairs")
        .upsert(row, { onConflict: "id" });

      if (saveError) {
        console.error("PAIR 저장 실패:", saveError);
        alert("PAIR을 저장하지 못했습니다.");
        return;
      }

      const nextPairs = editingPairId
        ? pairs.map((pair) =>
            pair.id === editingPairId ? nextPair : pair
          )
        : [nextPair, ...pairs];

      savePairs(nextPairs);
      setPairs(nextPairs);

      const oldIds = new Set(getPairOwnedImageIds(oldPair));
      const newIds = new Set(getPairOwnedImageIds(nextPair));

      await Promise.all(
        [...oldIds]
          .filter((id) => !newIds.has(id))
          .map((id) => deleteImageFromDB(id))
      );

      setTemporaryImageIds([]);

      const savedPairId = nextPair.id;
      const shouldReturnToDetail = returnToDetail;

      resetForm();
      setReturnToDetail(false);

      if (shouldReturnToDetail) {
        router.push(`/pair/${savedPairId}`);
      }
    } catch (error) {
      console.error("PAIR 저장 실패:", error);
      alert("PAIR을 저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(pair: Pair) {
    if (!user) {
      router.push("/login");
      return;
    }

    const confirmed = window.confirm(
      `"${pair.name}" PAIR을 삭제할까요?\n등록된 PAIR 이미지도 함께 삭제됩니다.`
    );

    if (!confirmed) return;

    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        alert("로그인이 필요합니다.");
        return;
      }

      const { error: deleteError } = await supabase
        .from("pairs")
        .delete()
        .eq("id", pair.id)
        .eq("user_id", authData.user.id);

      if (deleteError) {
        console.error("PAIR 삭제 실패:", deleteError);
        alert("PAIR을 삭제하지 못했습니다.");
        return;
      }

      const ids = getPairOwnedImageIds(pair);
      await Promise.all(ids.map((id) => deleteImageFromDB(id)));

      const nextPairs = pairs.filter((item) => item.id !== pair.id);
      savePairs(nextPairs);
      setPairs(nextPairs);

      if (editingPairId === pair.id) {
        resetForm();
      }
    } catch (error) {
      console.error("PAIR 삭제 실패:", error);
      alert("PAIR을 삭제하지 못했습니다.");
    }
  }

  function getCharacterFallbackUrl(character?: Character) {
    if (!character) return undefined;

    if (character.image && character.image.startsWith("data:")) {
      return character.image;
    }

    return undefined;
  }

  function PairVisual({
    pair,
    large = false,
  }: {
    pair: Pair;
    large?: boolean;
  }) {
    const characterA =
      pair.characterAType === "archive" && pair.characterAId
        ? characterMap.get(pair.characterAId)
        : undefined;
    const characterB =
      pair.characterBType === "archive" && pair.characterBId
        ? characterMap.get(pair.characterBId)
        : undefined;

    const [singleUrl, setSingleUrl] = useState<string | undefined>();
    const [aUrl, setAUrl] = useState<string | undefined>();
    const [bUrl, setBUrl] = useState<string | undefined>();

    useEffect(() => {
      let cancelled = false;

      async function load() {
        if (pair.representativeImageId) {
          const url = await getImageFromDB(pair.representativeImageId);
          if (!cancelled) setSingleUrl(url);
        } else {
          setSingleUrl(undefined);
        }

        if (pair.characterAImageId) {
          const url = await getImageFromDB(pair.characterAImageId);
          if (!cancelled) setAUrl(url);
        } else {
          setAUrl(undefined);
        }

        if (pair.characterBImageId) {
          const url = await getImageFromDB(pair.characterBImageId);
          if (!cancelled) setBUrl(url);
        } else {
          setBUrl(undefined);
        }
      }

      load();

      return () => {
        cancelled = true;
      };
    }, [
      pair.representativeImageId,
      pair.characterAImageId,
      pair.characterBImageId,
    ]);

    useEffect(() => {
      return () => {
        if (singleUrl) URL.revokeObjectURL(singleUrl);
        if (aUrl) URL.revokeObjectURL(aUrl);
        if (bUrl) URL.revokeObjectURL(bUrl);
      };
    }, [singleUrl, aUrl, bUrl]);

    if (singleUrl || pair.representativeImageId) {
      return (
        <div className={`overflow-hidden bg-[var(--archive-soft)] ${large ? "aspect-[16/10]" : "aspect-[4/3]"}`}>
          {singleUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={singleUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] tracking-[0.15em] text-[var(--archive-muted)]">
              IMAGE
            </div>
          )}
        </div>
      );
    }

    const fallbackA =
      aUrl || getCharacterFallbackUrl(characterA) || characterA?.image;
    const fallbackB =
      bUrl || getCharacterFallbackUrl(characterB) || characterB?.image;

    return (
      <div className={`grid grid-cols-2 overflow-hidden bg-[var(--archive-soft)] ${large ? "aspect-[16/10]" : "aspect-[4/3]"}`}>
        <div className="overflow-hidden border-r border-white">
          {fallbackA ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fallbackA}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[9px] tracking-[0.12em] text-[var(--archive-muted)]">
              {pair.characterAName || "A"}
            </div>
          )}
        </div>

        <div className="overflow-hidden">
          {fallbackB ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fallbackB}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[9px] tracking-[0.12em] text-[var(--archive-muted)]">
              {pair.characterBName || "B"}
            </div>
          )}
        </div>
      </div>
    );
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"newest" | "oldest" | "name">(
    "newest"
  );
  const [viewMode, setViewMode] = useState<"grid" | "compact" | "list">(
    "grid"
  );

  const filteredPairs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const result = pairs.filter((pair) => {
      if (!query) return true;

      return [
        pair.name,
        pair.relationship,
        pair.description,
        pair.characterAName,
        pair.characterBName,
        ...(pair.tags ?? []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

    return [...result].sort((a, b) => {
      if (sortMode === "name") {
        return a.name.localeCompare(b.name, "ko");
      }

      const aIndex = pairs.findIndex((pair) => pair.id === a.id);
      const bIndex = pairs.findIndex((pair) => pair.id === b.id);

      return sortMode === "newest"
        ? aIndex - bIndex
        : bIndex - aIndex;
    });
  }, [pairs, searchQuery, sortMode]);

  const previewPair: Pair = {
    id: "preview",
    name: pairName || "PAIR NAME",

    characterAType,
    characterAId:
      characterAType === "archive" ? characterAId || undefined : undefined,
    characterAName:
      characterAType === "archive"
        ? selectedCharacterA?.name || "CHARACTER A"
        : characterAName || "AI CHARACTER A",

    characterBType,
    characterBId:
      characterBType === "archive" ? characterBId || undefined : undefined,
    characterBName:
      characterBType === "archive"
        ? selectedCharacterB?.name || "CHARACTER B"
        : characterBName || "AI CHARACTER B",

    relationship,
    description,
    tags: tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    representativeImageId:
      imageMode === "single" ? representativeImageId : undefined,
    characterAImageId:
      imageMode === "characters" ? characterAImageId : undefined,
    characterBImageId:
      imageMode === "characters" ? characterBImageId : undefined,
    detailImageIds,
  };

  if (isAdding) {
    return (
      <main className="min-h-screen bg-[var(--archive-bg)] px-6 pb-20 pt-12 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex items-end justify-between gap-6 border-b border-[var(--archive-border)] pb-6">
            <div>
              <p className="mb-2 text-[10px] tracking-[0.25em] text-[var(--archive-muted)]">
                {editingPairId ? "EDIT PAIR" : "NEW PAIR"}
              </p>
              <h1 className="text-4xl font-light tracking-[-0.04em]">
                {editingPairId ? "EDIT PAIR" : "CREATE PAIR"}
              </h1>
            </div>

            <button
              type="button"
              onClick={handleCancel}
              className="rounded-full border border-[var(--archive-border)] bg-[var(--archive-card)] px-5 py-2.5 text-[10px] font-semibold tracking-[0.15em] transition hover:border-[var(--archive-accent)]/25"
            >
              CANCEL
            </button>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
            <section className="space-y-6">
              <div className="rounded-3xl border border-[var(--archive-border)] bg-[var(--archive-card)] p-6">
                <p className="mb-5 text-[10px] font-semibold tracking-[0.2em] text-[var(--archive-muted)]">
                  BASIC INFORMATION
                </p>

                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-[10px] font-semibold tracking-[0.18em] text-[var(--archive-muted)]">
                      PAIR NAME
                    </label>
                    <input
                      value={pairName}
                      onChange={(event) => setPairName(event.target.value)}
                      placeholder="예: HEEWOON × JAEHA"
                      className="w-full rounded-xl border border-[var(--archive-border)] bg-[var(--archive-card)] px-4 py-3 text-sm outline-none transition placeholder:text-[var(--archive-muted)] focus:border-[var(--archive-accent)]/30"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <ParticipantSelect
                      type={characterAType}
                      setType={setCharacterAType}
                      archiveId={characterAId}
                      setArchiveId={setCharacterAId}
                      externalName={characterAName}
                      setExternalName={setCharacterAName}
                      excludeId={
                        characterBType === "archive"
                          ? characterBId
                          : undefined
                      }
                      label="CHARACTER A"
                      characters={characters}
                    />

                    <ParticipantSelect
                      type={characterBType}
                      setType={setCharacterBType}
                      archiveId={characterBId}
                      setArchiveId={setCharacterBId}
                      externalName={characterBName}
                      setExternalName={setCharacterBName}
                      excludeId={
                        characterAType === "archive"
                          ? characterAId
                          : undefined
                      }
                      label="CHARACTER B"
                      characters={characters}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-semibold tracking-[0.18em] text-[var(--archive-muted)]">
                      RELATIONSHIP
                    </label>
                    <input
                      value={relationship}
                      onChange={(event) => setRelationship(event.target.value)}
                      placeholder="예: 연인 / 동료 / 라이벌 / 친구"
                      className="w-full rounded-xl border border-[var(--archive-border)] bg-[var(--archive-card)] px-4 py-3 text-sm outline-none transition placeholder:text-[var(--archive-muted)] focus:border-[var(--archive-accent)]/30"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-semibold tracking-[0.18em] text-[var(--archive-muted)]">
                      DESCRIPTION
                    </label>
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="두 사람의 관계나 설정을 기록해주세요."
                      rows={5}
                      className="w-full resize-none rounded-xl border border-[var(--archive-border)] bg-[var(--archive-card)] px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-[var(--archive-muted)] focus:border-[var(--archive-accent)]/30"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-semibold tracking-[0.18em] text-[var(--archive-muted)]">
                      TAGS
                    </label>
                    <input
                      value={tagsInput}
                      onChange={(event) => setTagsInput(event.target.value)}
                      placeholder="쉼표로 구분 · 예: romance, military, slow burn"
                      className="w-full rounded-xl border border-[var(--archive-border)] bg-[var(--archive-card)] px-4 py-3 text-sm outline-none transition placeholder:text-[var(--archive-muted)] focus:border-[var(--archive-accent)]/30"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-[var(--archive-border)] bg-[var(--archive-card)] p-6">
                <div className="mb-5">
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-[var(--archive-muted)]">
                    REPRESENTATIVE IMAGE
                  </p>
                  <p className="mt-1 text-xs text-[var(--archive-muted)]">
                    목록에서 보여줄 대표 이미지를 선택하세요.
                  </p>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setImageMode("single")}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      imageMode === "single"
                        ? "border-[var(--archive-accent)] bg-[var(--archive-accent)] text-[var(--archive-bg)]"
                        : "border-[var(--archive-border)] bg-[var(--archive-card)] text-[var(--archive-text)] hover:border-[var(--archive-accent)]/25"
                    }`}
                  >
                    <span className="block text-[10px] font-semibold tracking-[0.15em]">
                      REPRESENTATIVE
                    </span>
                    <span
                      className={`mt-1 block text-[10px] ${
                        imageMode === "single"
                          ? "text-[var(--archive-bg)]/55"
                          : "text-[var(--archive-muted)]"
                      }`}
                    >
                      대표 이미지 1장
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImageMode("characters")}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      imageMode === "characters"
                        ? "border-[var(--archive-accent)] bg-[var(--archive-accent)] text-[var(--archive-bg)]"
                        : "border-[var(--archive-border)] bg-[var(--archive-card)] text-[var(--archive-text)] hover:border-[var(--archive-accent)]/25"
                    }`}
                  >
                    <span className="block text-[10px] font-semibold tracking-[0.15em]">
                      CHARACTER A + B
                    </span>
                    <span
                      className={`mt-1 block text-[10px] ${
                        imageMode === "characters"
                          ? "text-[var(--archive-bg)]/55"
                          : "text-[var(--archive-muted)]"
                      }`}
                    >
                      두 사람 각각의 이미지
                    </span>
                  </button>
                </div>

                {imageMode === "single" ? (
                  <ImageUploadSection
                    label="PAIR REPRESENTATIVE"
                    imageId={representativeImageId}
                    imageUrl={representativeImageUrl}
                    onUpload={(event) =>
                      handleImageUpload(event, setRepresentativeImageId)
                    }
                    onRemove={() =>
                      removeImage(
                        representativeImageId,
                        setRepresentativeImageId
                      )
                    }
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ImageUploadSection
                      label={`CHARACTER A · ${displayCharacterAName}`}
                      imageId={characterAImageId}
                      imageUrl={characterAImageUrl}
                      onUpload={(event) =>
                        handleImageUpload(event, setCharacterAImageId)
                      }
                      onRemove={() =>
                        removeImage(
                          characterAImageId,
                          setCharacterAImageId
                        )
                      }
                      compact
                    />

                    <ImageUploadSection
                      label={`CHARACTER B · ${displayCharacterBName}`}
                      imageId={characterBImageId}
                      imageUrl={characterBImageUrl}
                      onUpload={(event) =>
                        handleImageUpload(event, setCharacterBImageId)
                      }
                      onRemove={() =>
                        removeImage(
                          characterBImageId,
                          setCharacterBImageId
                        )
                      }
                      compact
                    />
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-[var(--archive-border)] bg-[var(--archive-card)] p-6">
                <div className="mb-5">
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-[var(--archive-muted)]">
                    DETAIL IMAGES
                  </p>
                  <p className="mt-1 text-xs text-[var(--archive-muted)]">
                    관계 설정이나 분위기를 보여주는 이미지를 여러 장 추가할 수 있어요.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {detailImageIds.map((id) => {
                    const url = detailImageUrls[id];

                    return (
                      <div
                        key={id}
                        className="group relative aspect-square overflow-hidden rounded-xl bg-[var(--archive-accent)]/5"
                      >
                        {url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}

                        <button
                          type="button"
                          onClick={() => removeDetailImage(id)}
                          className="absolute right-2 top-2 rounded-full bg-[var(--archive-card)]/90 px-2 py-1 text-[9px] opacity-0 shadow-sm transition group-hover:opacity-100"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}

                  <label className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border border-dashed border-[var(--archive-border)] bg-[var(--archive-accent)]/[0.02] transition hover:border-[var(--archive-accent)]/30 hover:bg-[var(--archive-accent)]/[0.04]">
                    <div className="text-center">
                      <div className="mb-1 text-xl font-light text-[var(--archive-muted)]">
                        +
                      </div>
                      <div className="text-[9px] tracking-[0.12em] text-[var(--archive-muted)]">
                        ADD IMAGES
                      </div>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleDetailUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSave}
                  className="rounded-full bg-[var(--archive-accent)] px-7 py-3 text-[10px] font-semibold tracking-[0.18em] text-[var(--archive-bg)] transition hover:bg-[var(--archive-accent)]/80 disabled:cursor-wait disabled:opacity-50"
                >
                  {isSaving ? "SAVING..." : "SAVE PAIR"}
                </button>
              </div>
            </section>

            <aside className="lg:sticky lg:top-8 lg:h-fit">
              <p className="mb-3 text-[10px] font-semibold tracking-[0.2em] text-[var(--archive-muted)]">
                LIVE PREVIEW
              </p>

              <div className="overflow-hidden rounded-3xl border border-[var(--archive-border)] bg-[var(--archive-card)]">
                <PairVisual pair={previewPair} large />

                <div className="p-6">
                  <p className="mb-2 text-[9px] tracking-[0.2em] text-[var(--archive-muted)]">
                    {relationship || "RELATIONSHIP"}
                  </p>

                  <h2 className="text-2xl font-light tracking-[-0.03em]">
                    {pairName || "PAIR NAME"}
                  </h2>

                  <div className="mt-3 flex items-center gap-2 text-xs text-[var(--archive-text)]/45">
                    <span>{displayCharacterAName}</span>
                    <span>×</span>
                    <span>{displayCharacterBName}</span>
                  </div>

                  {description && (
                    <p className="mt-5 whitespace-pre-wrap text-xs leading-6 text-[var(--archive-muted)]">
                      {description}
                    </p>
                  )}

                  {previewPair.tags.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-1.5">
                      {previewPair.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[var(--archive-accent)]/[0.05] px-2.5 py-1 text-[9px] tracking-[0.08em] text-[var(--archive-muted)]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {detailImageIds.length > 0 && (
                    <div className="mt-6 grid grid-cols-3 gap-2">
                      {detailImageIds.slice(0, 6).map((id) => {
                        const url = detailImageUrls[id];

                        return (
                          <div
                            key={id}
                            className="aspect-square overflow-hidden rounded-lg bg-[var(--archive-accent)]/5"
                          >
                            {url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--archive-bg)] px-6 pb-20 pt-12 md:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10 flex items-end justify-between gap-6 border-b border-[var(--archive-border)] pb-6">
          <div>
            <p className="mb-2 text-[10px] tracking-[0.25em] text-[var(--archive-muted)]">
              MY.ARCHIVE
            </p>
            <h1 className="text-4xl font-light tracking-[-0.04em]">
              PAIR
            </h1>
            <p className="mt-3 text-xs text-[var(--archive-muted)]">
              캐릭터와 캐릭터 사이의 관계를 기록합니다.
            </p>
          </div>

          {user && (
            <button
              type="button"
              onClick={startAdd}
              className="rounded-full bg-[var(--archive-accent)] px-5 py-2.5 text-[10px] font-semibold tracking-[0.15em] text-[var(--archive-bg)] transition hover:bg-[var(--archive-accent)]/80"
            >
              + ADD PAIR
            </button>
          )}
        </header>

        {pairs.length === 0 ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-[var(--archive-border)] bg-[var(--archive-card)]">
            <div className="text-center">
              <p className="text-sm text-[var(--archive-muted)]">아직 등록된 PAIR이 없습니다.</p>
              {user && (
                <button
                  type="button"
                  onClick={startAdd}
                  className="mt-4 text-[10px] font-semibold tracking-[0.15em] underline underline-offset-4"
                >
                  CREATE YOUR FIRST PAIR
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {pairs.map((pair) => {
              const characterA =
                pair.characterAType === "archive" && pair.characterAId
                  ? characterMap.get(pair.characterAId)
                  : undefined;
              const characterB =
                pair.characterBType === "archive" && pair.characterBId
                  ? characterMap.get(pair.characterBId)
                  : undefined;

              return (
                <article
                  key={pair.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(`/pair/${pair.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/pair/${pair.id}`);
                    }
                  }}
                  className="group cursor-pointer overflow-hidden rounded-3xl border border-[var(--archive-border)] bg-[var(--archive-card)]"
                >
                  <PairVisual pair={pair} />

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="mb-1 text-[9px] tracking-[0.18em] text-[var(--archive-muted)]">
                          {pair.relationship || "PAIR"}
                        </p>
                        <h2 className="text-xl font-light tracking-[-0.025em]">
                          {pair.name}
                        </h2>
                      </div>

                      {user && (
                        <div className="flex gap-2 opacity-0 transition group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              startEdit(pair);
                            }}
                            onKeyDown={(event) => event.stopPropagation()}
                            className="text-[7px] tracking-[0.12em] text-[var(--archive-text)]/45 hover:text-[var(--archive-text)]"
                          >
                            EDIT
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDelete(pair);
                            }}
                            onKeyDown={(event) => event.stopPropagation()}
                            className="text-[7px] tracking-[0.12em] text-[var(--archive-muted)] hover:text-red-500"
                          >
                            DELETE
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs text-[var(--archive-text)]/45">
                      <span>
                        {pair.characterAName || characterA?.name || "CHARACTER A"}
                      </span>
                      <span>×</span>
                      <span>
                        {pair.characterBName || characterB?.name || "CHARACTER B"}
                      </span>
                    </div>

                    {pair.description && (
                      <p className="mt-4 line-clamp-3 text-xs leading-5 text-[var(--archive-text)]/45">
                        {pair.description}
                      </p>
                    )}

                    {pair.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {pair.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-[var(--archive-accent)]/[0.05] px-2 py-1 text-[8px] tracking-[0.08em] text-[var(--archive-text)]/45"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {pair.detailImageIds && pair.detailImageIds.length > 0 && (
                      <div className="mt-4 text-[9px] tracking-[0.12em] text-[var(--archive-muted)]">
                        {pair.detailImageIds.length} DETAIL IMAGE
                        {pair.detailImageIds.length > 1 ? "S" : ""}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-10 flex items-center justify-between border-t border-[var(--archive-border)] pt-5 text-[9px] tracking-[0.15em] text-[var(--archive-muted)]">
          <span>{pairs.length} PAIR{pairs.length !== 1 ? "S" : ""}</span>
          <Link
            href="/character"
            className="transition hover:text-[var(--archive-text)]"
          >
            VIEW CHARACTERS →
          </Link>
        </div>
      </div>
    </main>
  );
}
