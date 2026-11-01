"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ABOUT_STORAGE_KEY = "my-archive-about-me";
const CHARACTER_STORAGE_KEY = "my-archive-characters";

const IMAGE_BUCKET = "archive-images";

type ThemeKey =
  | "pastel"
  | "mono"
  | "retro"
  | "dark"
  | "neon"
  | "blue"
  | "natural"
  | "classic"
  | "lavender";

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

type AboutBlockKey =
  | "profile"
  | "intro"
  | "creating"
  | "using"
  | "ai"
  | "posting"
  | "genres"
  | "characters"
  | "unfollow"
  | "follow"
  | "criteria"
  | "dni"
  | "active"
  | "message";

type AboutMeData = {
  theme: ThemeKey;

  profileImageId?: string;
  nickname: string;
  twitterId: string;
  age: string;
  introduction: string;

  creatingPlatforms: string[];
  usingPlatforms: string[];
  aiTools: string[];
  posting: string[];
  genres: string[];

  characters: string[];

  unfollow: string[];
  follow: string[];
  followCriteria: string[];

  triggers: string;
  activeTime: string;
  message: string;

  corner: "rounded" | "square";
  orientation: "vertical" | "horizontal";
  width: number;
  fontSize: number;
  blockSize: number;

  footer: string;
  footerSize: number;

  profileScale: number;
  profileX: number;
  profileY: number;

  blockOrder: AboutBlockKey[];
};

const themes: Record<
  ThemeKey,
  {
    name: string;
    bg: string;
    card: string;
    text: string;
    sub: string;
    border: string;
    accent: string;
  }
> = {
  pastel: {
    name: "파스텔",
    bg: "#f8f4f7",
    card: "#fffafd",
    text: "#463f45",
    sub: "#8c828a",
    border: "#eadde5",
    accent: "#dba9bd",
  },
  mono: {
    name: "모노톤",
    bg: "#eeeeee",
    card: "#ffffff",
    text: "#202020",
    sub: "#777777",
    border: "#d5d5d5",
    accent: "#555555",
  },
  retro: {
    name: "레트로",
    bg: "#e8dcc8",
    card: "#f7eedf",
    text: "#493a2f",
    sub: "#806d5d",
    border: "#cbb69b",
    accent: "#a66b45",
  },
  dark: {
    name: "다크",
    bg: "#111111",
    card: "#1d1d1d",
    text: "#f3f3f3",
    sub: "#a0a0a0",
    border: "#343434",
    accent: "#bbbbbb",
  },
  neon: {
    name: "네온",
    bg: "#111016",
    card: "#191620",
    text: "#f7f0ff",
    sub: "#a99bb5",
    border: "#493a55",
    accent: "#ff6bd6",
  },
  blue: {
    name: "청량블루",
    bg: "#edf7fc",
    card: "#ffffff",
    text: "#244351",
    sub: "#718995",
    border: "#d2e8f0",
    accent: "#65b9d8",
  },
  natural: {
    name: "내추럴",
    bg: "#f0eee5",
    card: "#fbfaf4",
    text: "#46443a",
    sub: "#8b8879",
    border: "#dedaca",
    accent: "#9b9a78",
  },
  classic: {
    name: "클래식",
    bg: "#eee9df",
    card: "#faf8f2",
    text: "#3c342c",
    sub: "#7d7165",
    border: "#d8cec0",
    accent: "#8e6f51",
  },
  lavender: {
    name: "라벤더",
    bg: "#f2eff9",
    card: "#fcfbff",
    text: "#443d52",
    sub: "#888099",
    border: "#ded8ec",
    accent: "#a28bc4",
  },
};

const creatingPreset = [
  "제타",
  "크랙",
  "케이브덕",
  "로판ai",
  "러비더비",
  "멜팅",
  "둠칫",
  "위프",
  "잉크챗",
  "플레이툰",
  "꾸욱",
  "네오나",
  "MYMI",
  "베일",
  "모아리",
  "펄스",
  "니지라",
  "이세계트럭",
  "우마이",
  "라페",
  "STAGE",
  "팅글",
  "티키타",
  "블룸",
];

const aiPreset = [
  "노벨AI",
  "미드저니",
  "스테이블디퓨전",
  "니지저니",
  "DALL·E",
  "ChatGPT",
  "Grok",
  "Krea",
  "SeaArt",
  "Leonardo",
];

const postingPreset = [
  "OOC",
  "로그",
  "드림",
  "짤뽑",
  "프롬 공유",
  "팬아트",
  "후기",
  "캐릭터 소개",
  "일상",
  "정보",
];

const genrePreset = [
  "판타지",
  "로맨스",
  "느와르",
  "학원물",
  "오컬트",
  "SF",
  "무협",
  "미스터리",
  "호러",
  "일상",
  "시대물",
  "스릴러",
  "코미디",
  "액션",
  "일상 힐링",
];

const ageOptions = ["성인", "미자", "비공"];

const unfollowOptions = [
  "블락",
  "블언블",
  "언블블",
  "언블",
  "자유",
  "조용히 언팔",
  "말하고 정리",
];

const followOptions = [
  "전부 맞팔",
  "구독계 제외 맞팔",
  "선팔 = 구독 간주",
  "선팔 후 확인",
];

const criteriaOptions = [
  "마음",
  "알티",
  "인알",
  "댓글",
  "인용",
  "DM",
  "전부",
];

const defaultBlocks: AboutBlockKey[] = [
  "profile",
  "intro",
  "creating",
  "using",
  "ai",
  "posting",
  "genres",
  "characters",
  "unfollow",
  "follow",
  "criteria",
  "dni",
  "active",
  "message",
];

const defaultData: AboutMeData = {
  theme: "pastel",

  nickname: "",
  twitterId: "",
  age: "",
  introduction: "",

  creatingPlatforms: [],
  usingPlatforms: [],
  aiTools: [],
  posting: [],
  genres: [],

  characters: [],

  unfollow: [],
  follow: [],
  followCriteria: [],

  triggers: "",
  activeTime: "",
  message: "",

  corner: "rounded",
  orientation: "vertical",
  width: 640,
  fontSize: 100,
  blockSize: 100,

  footer: "",
  footerSize: 100,

  profileScale: 100,
  profileX: 50,
  profileY: 50,

  blockOrder: defaultBlocks,
};

async function saveImageToDB(dataUrl: string): Promise<string> {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("로그인이 필요합니다.");
  }

  const id = crypto.randomUUID();
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  const path = `${user.id}/${id}`;

  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, blob, {
      contentType: blob.type || "image/png",
      upsert: true,
    });

  if (error) {
    throw error;
  }

  return id;
}

async function getImageFromDB(id: string): Promise<string | null> {
  if (!id) return null;

  try {
    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    const path = `${user.id}/${id}`;

    const { data, error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .download(path);

    if (error || !data) {
      return null;
    }

    return URL.createObjectURL(data);
  } catch {
    return null;
  }
}

async function deleteImageFromDB(id?: string) {
  if (!id) return;

  try {
    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return;
    }

    const path = `${user.id}/${id}`;

    await supabase.storage
      .from(IMAGE_BUCKET)
      .remove([path]);
  } catch {
    // 이미지가 이미 삭제되었거나 Storage를 사용할 수 없는 경우 무시
  }
}

async function getCharacterImage(
  character: Character,
): Promise<string | null> {
  if (character.imageId) {
    return getImageFromDB(character.imageId);
  }

  if (character.imageIds?.[0]) {
    return getImageFromDB(character.imageIds[0]);
  }

  if (character.image) {
    return character.image;
  }

  if (character.images?.[0]) {
    return character.images[0];
  }

  return null;
}


function makeDefaultData(): AboutMeData {
  return JSON.parse(JSON.stringify(defaultData));
}

function CheckboxGroup({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: string[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    );
  };

  return (
    <div className="field-group">
      <label className="field-title">{title}</label>

      <div className="check-grid">
        {options.map((option) => (
          <button
            type="button"
            key={option}
            className={`check-chip ${
              selected.includes(option) ? "active" : ""
            }`}
            onClick={() => toggle(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function TagEditor({
  title,
  tags,
  onChange,
  presets,
}: {
  title: string;
  tags: string[];
  onChange: (value: string[]) => void;
  presets: string[];
}) {
  const [input, setInput] = useState("");

  const addTag = (value: string) => {
    const trimmed = value.trim();

    if (!trimmed || tags.includes(trimmed)) return;

    onChange([...tags, trimmed]);
  };

  const submit = () => {
    addTag(input);
    setInput("");
  };

  return (
    <div className="field-group">
      <label className="field-title">{title}</label>

      <div className="tag-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="직접 입력 후 Enter"
        />

        <button type="button" onClick={submit}>
          추가
        </button>
      </div>

      <div className="preset-wrap">
        {presets.map((preset) => (
          <button
            type="button"
            key={preset}
            className={`preset ${
              tags.includes(preset) ? "selected" : ""
            }`}
            onClick={() =>
              tags.includes(preset)
                ? onChange(tags.filter((tag) => tag !== preset))
                : onChange([...tags, preset])
            }
          >
            {preset}
          </button>
        ))}
      </div>

      {tags.length > 0 && (
        <div className="selected-tags">
          {tags.map((tag) => (
            <button
              type="button"
              key={tag}
              onClick={() =>
                onChange(tags.filter((item) => item !== tag))
              }
            >
              #{tag} ×
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AboutPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<import("@supabase/supabase-js").User | null>(null);
  const [data, setData] = useState<AboutMeData | null>(null);
  const [editData, setEditData] = useState<AboutMeData>(
    makeDefaultData(),
  );

  const [editing, setEditing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [characterList, setCharacterList] = useState<Character[]>([]);
  const [characterImages, setCharacterImages] = useState<
    Record<string, string>
  >({});

  const [characterModal, setCharacterModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [profilePreview, setProfilePreview] = useState<string | null>(
    null,
  );

  const profileInputRef = useRef<HTMLInputElement | null>(null);
  const exportRef = useRef<HTMLDivElement | null>(null);

  const currentTheme = themes[(editing ? editData : data)?.theme ?? "pastel"];

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    const saved = localStorage.getItem(ABOUT_STORAGE_KEY);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        const normalized: AboutMeData = {
          ...makeDefaultData(),
          ...parsed,
          blockOrder: parsed.blockOrder?.length
            ? parsed.blockOrder
            : defaultBlocks,
        };

        setData(normalized);
        setEditData(normalized);
      } catch {
        setData(null);
      }
    }

    const chars = localStorage.getItem(CHARACTER_STORAGE_KEY);

    if (chars) {
      try {
        const parsedCharacters: Character[] = JSON.parse(chars);
        setCharacterList(parsedCharacters);
      } catch {
        setCharacterList([]);
      }
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;
    const urls: string[] = [];

    async function loadImages() {
      const result: Record<string, string> = {};

      for (const character of characterList) {
        const url = await getCharacterImage(character);

        if (url) {
          result[character.id] = url;

          if (url.startsWith("blob:")) {
            urls.push(url);
          }
        }
      }

      if (!cancelled) {
        setCharacterImages(result);
      } else {
        urls.forEach((url) => URL.revokeObjectURL(url));
      }
    }

    loadImages();

    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [characterList]);

  useEffect(() => {
    if (!editData.profileImageId) {
      setProfilePreview(null);
      return;
    }

    let url: string | null = null;

    getImageFromDB(editData.profileImageId).then((result) => {
      if (result) {
        url = result;
        setProfilePreview(result);
      } else {
        setProfilePreview(null);
      }
    });

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [editData.profileImageId]);

  const selectedCharacters = useMemo(
    () =>
      characterList.filter((character) =>
        editData.characters.includes(character.id),
      ),
    [characterList, editData.characters],
  );

  const update = <K extends keyof AboutMeData>(
    key: K,
    value: AboutMeData[K],
  ) => {
    setEditData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const startEditing = () => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent("/about")}`);
      return;
    }

    setEditData(data ? { ...data } : makeDefaultData());
    setEditing(true);
  };

  const cancelEditing = () => {
    if (data) {
      setEditData({ ...data });
      setEditing(false);
    } else {
      setEditing(false);
    }
  };

  const fillExample = () => {
    setEditData({
      ...makeDefaultData(),

      nickname: "HEEWOON",
      twitterId: "@example",
      age: "성인",

      introduction:
        "캐릭터와 세계관을 만들고 이야기를 기록합니다.\n취향 맞는 분들과 편하게 교류해요.",

      creatingPlatforms: ["제타", "크랙", "로판ai"],
      usingPlatforms: ["제타", "케이브덕", "잉크챗"],
      aiTools: ["ChatGPT", "DALL·E", "NovelAI"],
      posting: ["OOC", "로그", "프롬 공유", "캐릭터 소개"],
      genres: ["판타지", "로맨스", "느와르", "일상 힐링"],

      unfollow: ["블언블", "조용히 언팔"],
      follow: ["전부 맞팔"],
      followCriteria: ["마음", "알티", "댓글"],

      triggers:
        "과도한 혐오 표현, 현실 정치, 불편한 소재는 피해주세요.",

      activeTime: "주로 저녁 ~ 새벽",

      message:
        "편하게 마음 남겨주셔도 좋아요.\n취향이 맞는다면 즐겁게 이야기해요.",

      footer: "MY.ARCHIVE",
    });
  };

  const handleProfileImage = async (file?: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();

    reader.onload = async () => {
      const dataUrl = String(reader.result);

      try {
        setSaving(true);

        const newId = await saveImageToDB(dataUrl);

        if (editData.profileImageId) {
          await deleteImageFromDB(editData.profileImageId);
        }

        update("profileImageId", newId);
      } finally {
        setSaving(false);
      }
    };

    reader.readAsDataURL(file);
  };

  const removeProfileImage = async () => {
    if (editData.profileImageId) {
      await deleteImageFromDB(editData.profileImageId);
    }

    update("profileImageId", undefined);
  };

  const saveAbout = () => {
    setSaving(true);

    const finalData = {
      ...editData,
      blockOrder: editData.blockOrder.filter(Boolean),
    };

    localStorage.setItem(
      ABOUT_STORAGE_KEY,
      JSON.stringify(finalData),
    );

    setData(finalData);
    setEditData(finalData);
    setEditing(false);

    setTimeout(() => {
      setSaving(false);
    }, 250);
  };

  const exportPNG = async () => {
    if (!exportRef.current) return;

    try {
      setSaving(true);

      const dataUrl = await toPng(exportRef.current, {
        pixelRatio: 4,
        cacheBust: true,
        backgroundColor: currentTheme.bg,
      });

      const link = document.createElement("a");

      link.download = "about-me.png";
      link.href = dataUrl;
      link.click();
    } finally {
      setSaving(false);
    }
  };

  const moveBlock = (
    block: AboutBlockKey,
    direction: "up" | "down",
  ) => {
    const order = [...editData.blockOrder];
    const index = order.indexOf(block);

    if (index === -1) return;

    const nextIndex =
      direction === "up" ? index - 1 : index + 1;

    if (nextIndex < 0 || nextIndex >= order.length) return;

    [order[index], order[nextIndex]] = [
      order[nextIndex],
      order[index],
    ];

    update("blockOrder", order);
  };

  const handleDropBlock = (
    e: React.DragEvent<HTMLDivElement>,
    target: AboutBlockKey,
  ) => {
    e.preventDefault();

    const source = e.dataTransfer.getData("text/plain") as AboutBlockKey;

    if (!source || source === target) return;

    const order = [...editData.blockOrder];

    const sourceIndex = order.indexOf(source);
    const targetIndex = order.indexOf(target);

    if (sourceIndex === -1 || targetIndex === -1) return;

    order.splice(sourceIndex, 1);
    order.splice(targetIndex, 0, source);

    update("blockOrder", order);
  };

  const blockNames: Record<AboutBlockKey, string> = {
    profile: "프로필",
    intro: "소개",
    creating: "제작 플랫폼",
    using: "사용 플랫폼",
    ai: "AI 이미지",
    posting: "게시",
    genres: "장르 / 취향",
    characters: "캐릭터",
    unfollow: "언팔",
    follow: "맞팔",
    criteria: "맞팔 기준",
    dni: "트리거 / DNI",
    active: "활동 시간",
    message: "메시지",
  };

  if (!hydrated) {
    return (
      <main className="loading-page">
        <span>LOADING...</span>
      </main>
    );
  }

  if (!data && !editing) {
    return (
      <>
        <style>{styles}</style>

        <main className="empty-page">
          <div className="empty-card">
            <span className="eyebrow">ABOUT ME</span>

            <h1>아직 ABOUT ME가 작성되지 않았어요.</h1>

            <p>
              나만의 프로필 카드를 만들어
              <br />
              MY.ARCHIVE에 저장해보세요.
            </p>

            <button
              className="primary-button"
              onClick={startEditing}
            >
              CREATE ABOUT ME
            </button>
          </div>
        </main>
      </>
    );
  }

  if (!editing && data) {
    return (
      <>
        <style>{styles}</style>

        <main
          className="about-page"
          style={
            {
              "--page-bg": themes[data.theme].bg,
              "--card-bg": themes[data.theme].card,
              "--text": themes[data.theme].text,
              "--sub": themes[data.theme].sub,
              "--border": themes[data.theme].border,
              "--accent": themes[data.theme].accent,
            } as React.CSSProperties
          }
        >
          <div className="topbar">
            <div>
              <span className="eyebrow">ABOUT ME</span>
              <h1>PROFILE</h1>
            </div>

            <div className="top-actions">
              <button
                className="secondary-button"
                onClick={exportPNG}
              >
                PNG
              </button>

              <button
                className="primary-button"
                onClick={startEditing}
              >
                EDIT
              </button>
            </div>
          </div>

          <div
            ref={exportRef}
            className={`profile-card ${
              data.orientation === "horizontal"
                ? "horizontal"
                : "vertical"
            } ${data.corner === "square" ? "square" : ""}`}
            style={{
              width: `${data.width}px`,
              fontSize: `${data.fontSize}%`,
            }}
          >
            <ProfileContent
              data={data}
              theme={themes[data.theme]}
              selectedCharacters={selectedCharacters}
              characterImages={characterImages}
              profilePreview={profilePreview}
            />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>

      <main className="editor-page">
        <header className="editor-header">
          <div>
            <span className="eyebrow">ABOUT ME</span>
            <h1>PROFILE BUILDER</h1>
          </div>

          <div className="top-actions">
            <button
              className="ghost-button"
              onClick={cancelEditing}
            >
              CANCEL
            </button>

            <button
              className="secondary-button"
              onClick={fillExample}
            >
              EXAMPLE
            </button>

            <button
              className="primary-button"
              onClick={saveAbout}
              disabled={saving}
            >
              {saving ? "SAVING..." : "SAVE"}
            </button>
          </div>
        </header>

        <div className="builder-layout">
          <aside className="builder-sidebar">
            <section className="editor-section">
              <h2>THEME</h2>

              <div className="theme-grid">
                {Object.entries(themes).map(([key, theme]) => (
                  <button
                    type="button"
                    key={key}
                    className={`theme-button ${
                      editData.theme === key ? "active" : ""
                    }`}
                    onClick={() =>
                      update("theme", key as ThemeKey)
                    }
                    aria-label={`${theme.name} 테마 선택`}
                  >
                    <span
                      className="theme-preview"
                      style={{
                        background: theme.bg,
                        borderColor: theme.border,
                      }}
                    >
                      <span
                        className="theme-preview-window"
                        style={{
                          background: theme.card,
                          borderColor: theme.border,
                        }}
                      >
                        <i
                          style={{
                            background: theme.accent,
                          }}
                        />
                        <i
                          style={{
                            background: theme.text,
                            opacity: 0.18,
                          }}
                        />
                        <i
                          style={{
                            background: theme.sub,
                            opacity: 0.45,
                          }}
                        />
                      </span>
                    </span>

                    <span className="theme-name">{theme.name}</span>

                    {editData.theme === key && (
                      <span className="theme-check">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </section>

            <section className="editor-section">
              <h2>PROFILE</h2>

              <div
                className="upload-box"
                onClick={() =>
                  profileInputRef.current?.click()
                }
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleProfileImage(e.dataTransfer.files?.[0]);
                }}
              >
                {profilePreview ? (
                  <img src={profilePreview} alt="" />
                ) : (
                  <>
                    <strong>PROFILE IMAGE</strong>
                    <span>클릭 또는 드래그해서 업로드</span>
                  </>
                )}
              </div>

              <input
                ref={profileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) =>
                  handleProfileImage(e.target.files?.[0])
                }
              />

              {profilePreview && (
                <button
                  type="button"
                  className="danger-button full"
                  onClick={removeProfileImage}
                >
                  이미지 삭제
                </button>
              )}

              <RangeField
                label="ZOOM"
                value={editData.profileScale}
                min={50}
                max={180}
                onChange={(value) =>
                  update("profileScale", value)
                }
              />

              <RangeField
                label="LEFT / RIGHT"
                value={editData.profileX}
                min={0}
                max={100}
                onChange={(value) =>
                  update("profileX", value)
                }
              />

              <RangeField
                label="UP / DOWN"
                value={editData.profileY}
                min={0}
                max={100}
                onChange={(value) =>
                  update("profileY", value)
                }
              />

              <TextField
                label="NICKNAME"
                value={editData.nickname}
                onChange={(value) =>
                  update("nickname", value)
                }
                placeholder="닉네임"
              />

              <TextField
                label="TWITTER ID"
                value={editData.twitterId}
                onChange={(value) =>
                  update("twitterId", value)
                }
                placeholder="@username"
              />

              <div className="field-group">
                <label className="field-title">AGE</label>

                <div className="check-grid">
                  {ageOptions.map((option) => (
                    <button
                      type="button"
                      key={option}
                      className={`check-chip ${
                        editData.age === option
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        update("age", option)
                      }
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <TextAreaField
                label="INTRODUCTION"
                value={editData.introduction}
                onChange={(value) =>
                  update("introduction", value)
                }
              />
            </section>

            <section className="editor-section">
              <h2>PLATFORMS</h2>

              <TagEditor
                title="CREATING"
                tags={editData.creatingPlatforms}
                onChange={(value) =>
                  update("creatingPlatforms", value)
                }
                presets={creatingPreset}
              />

              <TagEditor
                title="USING"
                tags={editData.usingPlatforms}
                onChange={(value) =>
                  update("usingPlatforms", value)
                }
                presets={creatingPreset}
              />
            </section>

            <section className="editor-section">
              <h2>CONTENT</h2>

              <TagEditor
                title="AI IMAGE TOOLS"
                tags={editData.aiTools}
                onChange={(value) =>
                  update("aiTools", value)
                }
                presets={aiPreset}
              />

              <TagEditor
                title="POSTING"
                tags={editData.posting}
                onChange={(value) =>
                  update("posting", value)
                }
                presets={postingPreset}
              />

              <TagEditor
                title="GENRES / TRAITS"
                tags={editData.genres}
                onChange={(value) =>
                  update("genres", value)
                }
                presets={genrePreset}
              />
            </section>

            <section className="editor-section">
              <h2>CHARACTERS</h2>

              <button
                type="button"
                className="secondary-button full"
                onClick={() => setCharacterModal(true)}
              >
                + 캐릭터 추가
              </button>

              {selectedCharacters.length > 0 && (
                <div className="mini-character-list">
                  {selectedCharacters.map((character) => (
                    <div
                      className="mini-character"
                      key={character.id}
                    >
                      {characterImages[character.id] && (
                        <img
                          src={characterImages[character.id]}
                          alt=""
                        />
                      )}

                      <span>{character.name}</span>

                      <button
                        type="button"
                        onClick={() =>
                          update(
                            "characters",
                            editData.characters.filter(
                              (id) => id !== character.id,
                            ),
                          )
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="editor-section">
              <h2>FOLLOW</h2>

              <CheckboxGroup
                title="UNFOLLOW"
                options={unfollowOptions}
                selected={editData.unfollow}
                onChange={(value) =>
                  update("unfollow", value)
                }
              />

              <CheckboxGroup
                title="FOLLOW"
                options={followOptions}
                selected={editData.follow}
                onChange={(value) =>
                  update("follow", value)
                }
              />

              <CheckboxGroup
                title="FOLLOW CRITERIA"
                options={criteriaOptions}
                selected={editData.followCriteria}
                onChange={(value) =>
                  update("followCriteria", value)
                }
              />
            </section>

            <section className="editor-section">
              <h2>OTHER</h2>

              <TextAreaField
                label="TRIGGERS / DNI"
                value={editData.triggers}
                onChange={(value) =>
                  update("triggers", value)
                }
              />

              <TextField
                label="ACTIVE TIME"
                value={editData.activeTime}
                onChange={(value) =>
                  update("activeTime", value)
                }
                placeholder="예: 저녁 ~ 새벽"
              />

              <TextAreaField
                label="MESSAGE"
                value={editData.message}
                onChange={(value) =>
                  update("message", value)
                }
              />
            </section>

            <section className="editor-section">
              <h2>LAYOUT</h2>

              <div className="field-group">
                <label className="field-title">CORNER</label>

                <div className="check-grid two">
                  {(["rounded", "square"] as const).map(
                    (value) => (
                      <button
                        type="button"
                        key={value}
                        className={`check-chip ${
                          editData.corner === value
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          update("corner", value)
                        }
                      >
                        {value === "rounded"
                          ? "ROUND"
                          : "SQUARE"}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="field-group">
                <label className="field-title">
                  ORIENTATION
                </label>

                <div className="check-grid two">
                  {(
                    ["vertical", "horizontal"] as const
                  ).map((value) => (
                    <button
                      type="button"
                      key={value}
                      className={`check-chip ${
                        editData.orientation === value
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        update("orientation", value)
                      }
                    >
                      {value === "vertical"
                        ? "VERTICAL"
                        : "HORIZONTAL"}
                    </button>
                  ))}
                </div>
              </div>

              <RangeField
                label={`WIDTH · ${editData.width}px`}
                value={editData.width}
                min={480}
                max={1000}
                onChange={(value) =>
                  update("width", value)
                }
              />

              <RangeField
                label={`FONT SIZE · ${editData.fontSize}%`}
                value={editData.fontSize}
                min={80}
                max={130}
                onChange={(value) =>
                  update("fontSize", value)
                }
              />

              <RangeField
                label={`BLOCK SIZE · ${editData.blockSize}%`}
                value={editData.blockSize}
                min={70}
                max={130}
                onChange={(value) =>
                  update("blockSize", value)
                }
              />

              <TextField
                label="FOOTER"
                value={editData.footer}
                onChange={(value) =>
                  update("footer", value)
                }
                placeholder="하단 문구"
              />

              <RangeField
                label={`FOOTER SIZE · ${editData.footerSize}%`}
                value={editData.footerSize}
                min={70}
                max={130}
                onChange={(value) =>
                  update("footerSize", value)
                }
              />
            </section>
          </aside>

          <section className="preview-area">
            <div className="preview-label">
              LIVE PREVIEW
            </div>

            <div className="preview-scroll">
              <div
                ref={exportRef}
                className={`profile-card ${
                  editData.orientation === "horizontal"
                    ? "horizontal"
                    : "vertical"
                } ${
                  editData.corner === "square"
                    ? "square"
                    : ""
                }`}
                style={{
                  width: `${editData.width}px`,
                  fontSize: `${editData.fontSize}%`,
                  "--page-bg": themes[editData.theme].bg,
                  "--card-bg": themes[editData.theme].card,
                  "--text": themes[editData.theme].text,
                  "--sub": themes[editData.theme].sub,
                  "--border": themes[editData.theme].border,
                  "--accent": themes[editData.theme].accent,
                } as React.CSSProperties}
              >
                <ProfileContent
                  data={editData}
                  theme={themes[editData.theme]}
                  selectedCharacters={selectedCharacters}
                  characterImages={characterImages}
                  profilePreview={profilePreview}
                  editing
                />
              </div>
            </div>

            <div className="block-order">
              <div className="preview-label">
                BLOCK ORDER
              </div>

              {editData.blockOrder.map((block) => (
                <div
                  key={block}
                  className="order-item"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "text/plain",
                      block,
                    );
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) =>
                    handleDropBlock(e, block)
                  }
                >
                  <span className="drag-handle">☷</span>

                  <span>{blockNames[block]}</span>

                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        moveBlock(block, "up")
                      }
                    >
                      ↑
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        moveBlock(block, "down")
                      }
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {characterModal && (
          <div
            className="modal-backdrop"
            onClick={() => setCharacterModal(false)}
          >
            <div
              className="character-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div>
                  <span className="eyebrow">
                    CHARACTER
                  </span>
                  <h2>캐릭터 추가</h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setCharacterModal(false)
                  }
                >
                  ×
                </button>
              </div>

              {characterList.length === 0 ? (
                <div className="empty-modal">
                  CHARACTER에 등록된 캐릭터가 없습니다.
                </div>
              ) : (
                <div className="character-select-grid">
                  {characterList.map((character) => {
                    const selected =
                      editData.characters.includes(
                        character.id,
                      );

                    return (
                      <button
                        type="button"
                        key={character.id}
                        className={`character-select ${
                          selected ? "selected" : ""
                        }`}
                        onClick={() => {
                          update(
                            "characters",
                            selected
                              ? editData.characters.filter(
                                  (id) =>
                                    id !== character.id,
                                )
                              : [
                                  ...editData.characters,
                                  character.id,
                                ],
                          );
                        }}
                      >
                        {characterImages[character.id] ? (
                          <img
                            src={
                              characterImages[
                                character.id
                              ]
                            }
                            alt=""
                          />
                        ) : (
                          <div className="no-image">
                            NO IMAGE
                          </div>
                        )}

                        <span>{character.name}</span>

                        {selected && (
                          <i>✓</i>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function ProfileContent({
  data,
  theme,
  selectedCharacters,
  characterImages,
  profilePreview,
  editing = false,
}: {
  data: AboutMeData;
  theme: (typeof themes)[ThemeKey];
  selectedCharacters: Character[];
  characterImages: Record<string, string>;
  profilePreview: string | null;
  editing?: boolean;
}) {
  const has = (values: string[]) => values.length > 0;

  return (
    <div
      className="profile-inner"
      style={{
        color: theme.text,
        background: theme.card,
        "--profile-accent": theme.accent,
        "--profile-border": theme.border,
        "--profile-sub": theme.sub,
        "--block-scale": `${data.blockSize}`,
      } as React.CSSProperties}
    >
      {data.blockOrder.map((block) => {
        switch (block) {
          case "profile":
            return (
              <section className="profile-header" key={block}>
                <div
                  className="profile-image"
                  style={{
                    borderColor: theme.border,
                  }}
                >
                  {profilePreview ? (
                    <img
                      src={profilePreview}
                      alt=""
                      style={{
                        width: `${data.profileScale}%`,
                        height: `${data.profileScale}%`,
                        left: `${data.profileX}%`,
                        top: `${data.profileY}%`,
                      }}
                    />
                  ) : (
                    <span>ABOUT</span>
                  )}
                </div>

                <div className="profile-heading">
                  <h2>
                    {data.nickname || "YOUR NAME"}
                  </h2>

                  {data.twitterId && (
                    <span>{data.twitterId}</span>
                  )}

                  {data.age && (
                    <span className="age">
                      {data.age}
                    </span>
                  )}
                </div>
              </section>
            );

          case "intro":
            return data.introduction ? (
              <InfoBlock
                key={block}
                title="ABOUT"
                text={data.introduction}
              />
            ) : null;

          case "creating":
            return has(data.creatingPlatforms) ? (
              <TagBlock
                key={block}
                title="CREATING"
                tags={data.creatingPlatforms}
              />
            ) : null;

          case "using":
            return has(data.usingPlatforms) ? (
              <TagBlock
                key={block}
                title="USING"
                tags={data.usingPlatforms}
              />
            ) : null;

          case "ai":
            return has(data.aiTools) ? (
              <TagBlock
                key={block}
                title="AI IMAGE"
                tags={data.aiTools}
              />
            ) : null;

          case "posting":
            return has(data.posting) ? (
              <TagBlock
                key={block}
                title="POSTING"
                tags={data.posting}
              />
            ) : null;

          case "genres":
            return has(data.genres) ? (
              <TagBlock
                key={block}
                title="GENRES / TRAITS"
                tags={data.genres}
              />
            ) : null;

          case "characters":
            return selectedCharacters.length > 0 ? (
              <section className="profile-block" key={block}>
                <BlockTitle>CHARACTERS</BlockTitle>

                <div className="character-showcase">
                  {selectedCharacters.map((character) => (
                    <div
                      className="character-card"
                      key={character.id}
                    >
                      {characterImages[character.id] ? (
                        <img
                          src={
                            characterImages[character.id]
                          }
                          alt=""
                        />
                      ) : (
                        <div className="no-image">
                          NO IMAGE
                        </div>
                      )}

                      <span>{character.name}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null;

          case "unfollow":
            return has(data.unfollow) ? (
              <TagBlock
                key={block}
                title="UNFOLLOW"
                tags={data.unfollow}
              />
            ) : null;

          case "follow":
            return has(data.follow) ? (
              <TagBlock
                key={block}
                title="FOLLOW"
                tags={data.follow}
              />
            ) : null;

          case "criteria":
            return has(data.followCriteria) ? (
              <TagBlock
                key={block}
                title="FOLLOW CRITERIA"
                tags={data.followCriteria}
              />
            ) : null;

          case "dni":
            return data.triggers ? (
              <InfoBlock
                key={block}
                title="TRIGGERS / DNI"
                text={data.triggers}
              />
            ) : null;

          case "active":
            return data.activeTime ? (
              <InfoBlock
                key={block}
                title="ACTIVE TIME"
                text={data.activeTime}
              />
            ) : null;

          case "message":
            return data.message ? (
              <InfoBlock
                key={block}
                title="MESSAGE"
                text={data.message}
              />
            ) : null;

          default:
            return null;
        }
      })}

      {data.footer && (
        <footer
          className="profile-footer"
          style={{
            fontSize: `${data.footerSize}%`,
          }}
        >
          {data.footer}
        </footer>
      )}

      {editing && (
        <div className="preview-note">
          LIVE PREVIEW · PNG 4×
        </div>
      )}
    </div>
  );
}

function BlockTitle({
  children,
}: {
  children: React.ReactNode;
}) {
  return <h3 className="block-title">{children}</h3>;
}

function TagBlock({
  title,
  tags,
}: {
  title: string;
  tags: string[];
}) {
  return (
    <section className="profile-block">
      <BlockTitle>{title}</BlockTitle>

      <div className="display-tags">
        {tags.map((tag) => (
          <span key={tag}>#{tag}</span>
        ))}
      </div>
    </section>
  );
}

function InfoBlock({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <section className="profile-block">
      <BlockTitle>{title}</BlockTitle>

      <p className="info-text">
        {text}
      </p>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="field-group">
      <label className="field-title">{label}</label>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="field-group">
      <label className="field-title">{label}</label>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
      />
    </div>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="field-group">
      <div className="range-label">
        <label className="field-title">{label}</label>
        <span>{value}</span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) =>
          onChange(Number(e.target.value))
        }
      />
    </div>
  );
}

const styles = `
* {
  box-sizing: border-box;
}

button,
input,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

.loading-page,
.empty-page {
  min-height: calc(100vh - 80px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: #f5f5f5;
  color: #222;
}

.empty-card {
  width: min(620px, 100%);
  text-align: center;
  padding: 70px 40px;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 24px;
}

.empty-card h1 {
  margin: 14px 0;
  font-size: 25px;
}

.empty-card p {
  margin: 0 0 30px;
  color: #777;
  line-height: 1.8;
}

.eyebrow {
  font-size: 10px;
  letter-spacing: .18em;
  font-weight: 700;
}

.about-page,
.editor-page {
  min-height: 100vh;
  padding: 35px;
}

.about-page {
  background: var(--page-bg);
  color: var(--text);
}

.editor-page {
  background: #f4f4f4;
  color: #202020;
}

.topbar,
.editor-header {
  max-width: 1400px;
  margin: 0 auto 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.topbar h1,
.editor-header h1 {
  margin: 6px 0 0;
  font-size: 30px;
  letter-spacing: -.03em;
}

.top-actions {
  display: flex;
  gap: 8px;
}

.primary-button,
.secondary-button,
.ghost-button,
.danger-button {
  min-height: 40px;
  padding: 0 18px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .08em;
}

.primary-button {
  background: #202020;
  color: white;
}

.secondary-button {
  background: white;
  color: #222;
  border-color: #ddd;
}

.ghost-button {
  background: transparent;
  border-color: #ddd;
  color: #555;
}

.danger-button {
  background: #f8eaea;
  border-color: #edd0d0;
  color: #a34848;
}

.full {
  width: 100%;
}

.profile-card {
  margin: 0 auto;
  overflow: hidden;
  border-radius: 28px;
  box-shadow: 0 25px 70px rgba(0,0,0,.08);
}

.profile-card.square {
  border-radius: 0;
}

.profile-inner {
  min-height: 500px;
  padding: 52px;
}

.profile-card.horizontal .profile-inner {
  min-height: 380px;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 28px;
  padding-bottom: 30px;
  border-bottom: 1px solid var(--profile-border);
}

.profile-image {
  position: relative;
  width: 130px;
  height: 130px;
  min-width: 130px;
  overflow: hidden;
  border: 1px solid;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--profile-border);
  color: var(--profile-sub);
  font-size: 10px;
  letter-spacing: .12em;
}

.profile-image img {
  position: absolute;
  max-width: none;
  max-height: none;
  object-fit: cover;
  transform: translate(-50%, -50%);
}

.profile-heading h2 {
  margin: 0 0 8px;
  font-size: 34px;
  letter-spacing: -.04em;
}

.profile-heading > span {
  display: block;
  margin-top: 4px;
  color: var(--profile-sub);
  font-size: 13px;
}

.profile-heading .age {
  display: inline-block;
  margin-top: 12px;
  padding: 5px 10px;
  border: 1px solid var(--profile-border);
  border-radius: 999px;
  font-size: 10px;
}

.profile-block {
  padding: 25px 0;
  border-bottom: 1px solid var(--profile-border);
  transform: scale(calc(var(--block-scale) / 100));
  transform-origin: top left;
  margin-bottom: calc((var(--block-scale) - 100) * -0.25px);
}

.block-title {
  margin: 0 0 13px;
  font-size: 10px;
  letter-spacing: .16em;
  color: var(--profile-accent);
}

.info-text {
  margin: 0;
  white-space: pre-line;
  color: var(--profile-sub);
  line-height: 1.8;
  font-size: 14px;
}

.display-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.display-tags span {
  padding: 7px 11px;
  border: 1px solid var(--profile-border);
  border-radius: 999px;
  color: var(--profile-sub);
  font-size: 12px;
}

.character-showcase {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.character-card {
  overflow: hidden;
  border: 1px solid var(--profile-border);
  border-radius: 12px;
}

.character-card img,
.character-card .no-image {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.character-card .no-image {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--profile-border);
  color: var(--profile-sub);
  font-size: 9px;
}

.character-card span {
  display: block;
  padding: 10px;
  font-size: 12px;
}

.profile-footer {
  padding-top: 28px;
  text-align: center;
  color: var(--profile-sub);
  letter-spacing: .12em;
}

.preview-note {
  margin-top: 30px;
  text-align: center;
  color: var(--profile-sub);
  font-size: 9px;
  letter-spacing: .12em;
}

.builder-layout {
  max-width: 1600px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 400px minmax(0, 1fr);
  gap: 25px;
  align-items: start;
}

.builder-sidebar {
  max-height: calc(100vh - 130px);
  overflow-y: auto;
  padding-right: 8px;
}

.builder-sidebar::-webkit-scrollbar {
  width: 4px;
}

.builder-sidebar::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 10px;
}

.editor-section {
  margin-bottom: 15px;
  padding: 22px;
  background: white;
  border: 1px solid #e3e3e3;
  border-radius: 18px;
}

.editor-section > h2 {
  margin: 0 0 20px;
  font-size: 11px;
  letter-spacing: .15em;
}

.field-group {
  margin-bottom: 20px;
}

.field-group:last-child {
  margin-bottom: 0;
}

.field-title {
  display: block;
  margin-bottom: 8px;
  color: #777;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .12em;
}

.field-group input:not([type="range"]),
.field-group textarea {
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 10px;
  padding: 11px 12px;
  outline: none;
  background: #fafafa;
}

.field-group textarea {
  resize: vertical;
  line-height: 1.6;
}

.field-group input:focus,
.field-group textarea:focus {
  border-color: #aaa;
  background: white;
}

.check-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.check-grid.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.check-chip,
.preset {
  border: 1px solid #ddd;
  background: white;
  color: #666;
  border-radius: 999px;
  padding: 7px 10px;
  font-size: 10px;
}

.check-chip.active,
.preset.selected {
  background: #222;
  border-color: #222;
  color: white;
}

.tag-input-row {
  display: flex;
  gap: 6px;
}

.tag-input-row input {
  flex: 1;
}

.tag-input-row button {
  padding: 0 14px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 10px;
}

.preset-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 9px;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 9px;
}

.selected-tags button {
  border: 0;
  background: #eee;
  border-radius: 999px;
  padding: 6px 9px;
  color: #555;
  font-size: 10px;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;
}

.theme-button {
  position: relative;
  min-width: 0;
  padding: 5px;
  border: 1px solid #e5e5e5;
  border-radius: 14px;
  background: #fafafa;
  color: #555;
  text-align: left;
  transition:
    border-color .18s ease,
    background .18s ease,
    transform .18s ease,
    box-shadow .18s ease;
}

.theme-button:hover {
  border-color: #cfcfcf;
  background: #fff;
  transform: translateY(-1px);
}

.theme-button.active {
  border-color: #222;
  background: #fff;
  box-shadow: 0 5px 18px rgba(0,0,0,.08);
}

.theme-preview {
  position: relative;
  display: block;
  width: 100%;
  height: 54px;
  overflow: hidden;
  border: 1px solid;
  border-radius: 10px;
}

.theme-preview-window {
  position: absolute;
  left: 9px;
  right: 9px;
  top: 9px;
  bottom: 9px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 7px;
  border: 1px solid;
  border-radius: 6px;
}

.theme-preview-window i {
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.theme-preview-window i:nth-child(2) {
  width: 24px;
  height: 4px;
  border-radius: 3px;
}

.theme-preview-window i:nth-child(3) {
  width: 16px;
  height: 4px;
  border-radius: 3px;
}

.theme-name {
  display: block;
  padding: 8px 4px 5px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: -.02em;
}

.theme-check {
  position: absolute;
  top: 9px;
  right: 9px;
  width: 19px;
  height: 19px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #222;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}

.upload-box {
  position: relative;
  min-height: 180px;
  margin-bottom: 8px;
  border: 1px dashed #ccc;
  border-radius: 15px;
  overflow: hidden;
  background: #fafafa;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.upload-box img {
  width: 100%;
  height: 220px;
  object-fit: cover;
}

.upload-box strong {
  font-size: 10px;
  letter-spacing: .12em;
}

.upload-box span {
  margin-top: 8px;
  color: #999;
  font-size: 10px;
}

.range-label {
  display: flex;
  justify-content: space-between;
}

.range-label span {
  color: #aaa;
  font-size: 10px;
}

input[type="range"] {
  width: 100%;
  accent-color: #222;
}

.preview-area {
  min-width: 0;
  position: sticky;
  top: 20px;
}

.preview-label {
  margin-bottom: 10px;
  color: #777;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .15em;
}

.preview-scroll {
  min-height: calc(100vh - 180px);
  max-height: calc(100vh - 180px);
  overflow: auto;
  padding: 35px;
  border: 1px solid #ddd;
  border-radius: 20px;
  background:
    linear-gradient(45deg, #eeeeee 25%, transparent 25%),
    linear-gradient(-45deg, #eeeeee 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #eeeeee 75%),
    linear-gradient(-45deg, transparent 75%, #eeeeee 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
}

.preview-scroll .profile-card {
  margin: 0 auto;
}

.block-order {
  margin-top: 20px;
  padding: 18px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 18px;
}

.order-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 6px 8px;
  border-bottom: 1px solid #eee;
  font-size: 11px;
}

.order-item:last-child {
  border-bottom: 0;
}

.drag-handle {
  color: #aaa;
  cursor: grab;
}

.order-item > span:nth-child(2) {
  flex: 1;
}

.order-item button {
  width: 25px;
  height: 25px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 7px;
}

.mini-character-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 10px;
}

.mini-character {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border: 1px solid #eee;
  border-radius: 9px;
}

.mini-character img {
  width: 32px;
  height: 32px;
  object-fit: cover;
  border-radius: 6px;
}

.mini-character span {
  flex: 1;
  font-size: 11px;
}

.mini-character button {
  border: 0;
  background: transparent;
  color: #999;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px;
  background: rgba(0,0,0,.45);
}

.character-modal {
  width: min(850px, 100%);
  max-height: 85vh;
  overflow: auto;
  padding: 25px;
  background: white;
  border-radius: 22px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.modal-header h2 {
  margin: 5px 0 0;
}

.modal-header > button {
  width: 35px;
  height: 35px;
  border: 0;
  background: #f3f3f3;
  border-radius: 50%;
  font-size: 20px;
}

.character-select-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.character-select {
  position: relative;
  padding: 0;
  overflow: hidden;
  border: 2px solid #eee;
  background: white;
  border-radius: 12px;
  text-align: left;
}

.character-select.selected {
  border-color: #222;
}

.character-select img,
.character-select .no-image {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.character-select .no-image {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eee;
  color: #999;
  font-size: 9px;
}

.character-select span {
  display: block;
  padding: 10px;
  font-size: 11px;
}

.character-select i {
  position: absolute;
  right: 8px;
  top: 8px;
  width: 25px;
  height: 25px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #222;
  color: white;
  font-style: normal;
}

.empty-modal {
  padding: 60px 20px;
  text-align: center;
  color: #999;
}

@media (max-width: 1100px) {
  .builder-layout {
    grid-template-columns: 340px minmax(0, 1fr);
  }

  .character-select-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 850px) {
  .about-page,
  .editor-page {
    padding: 20px;
  }

  .topbar,
  .editor-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .builder-layout {
    grid-template-columns: 1fr;
  }

  .builder-sidebar {
    max-height: none;
    overflow: visible;
    order: 2;
  }

  .preview-area {
    position: static;
    order: 1;
  }

  .preview-scroll {
    max-height: none;
  }

  .character-showcase {
    grid-template-columns: repeat(2, 1fr);
  }
}
`;