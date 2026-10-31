"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const DB_NAME = "my-archive-db";
const DB_VERSION = 1;
const IMAGE_STORE = "character-images";
const PAIR_STORAGE_KEY = "my-archive-pairs";
const CHARACTER_STORAGE_KEY = "my-archive-characters";

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

function openImageDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

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

        if (!value) {
          resolve("");
          return;
        }

        const blob =
          value instanceof Blob
            ? value
            : value?.blob instanceof Blob
              ? value.blob
              : null;

        if (!blob) {
          resolve("");
          return;
        }

        resolve(URL.createObjectURL(blob));
      };

      request.onerror = () => reject(request.error);
    });
  } catch {
    return "";
  }
}

function ParticipantCard({
  side,
  type,
  name,
  character,
  imageUrl,
  onOpenImage,
}: {
  side: "A" | "B";
  type: ParticipantType;
  name: string;
  character?: Character;
  imageUrl: string;
  onOpenImage: (url: string) => void;
}) {
  return (
    <article className="participant-card">
      {imageUrl && (
        <button
          type="button"
          className="participant-image-button"
          onClick={() => onOpenImage(imageUrl)}
        >
          <img src={imageUrl} alt={name} />
        </button>
      )}

      <div className="participant-info">
        <div className="participant-topline">
          <span className="participant-side">CHARACTER {side}</span>
          <span className="participant-divider">·</span>
          <span className="participant-type">
            {type === "archive" ? "ARCHIVE" : "AI / EXTERNAL"}
          </span>
        </div>

        <h2
          className="participant-name"
          style={{
            display: "block",
            fontSize: "44px",
            lineHeight: 1.05,
            fontWeight: 400,
            letterSpacing: "-0.045em",
            margin: 0,
            marginTop: "24px",
          }}
        >
          {name || "UNNAMED"}
        </h2>


      </div>
    </article>
  );
}

function PairDetailContent() {
  const params = useParams();
  const router = useRouter();

  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [pair, setPair] = useState<Pair | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [representativeUrl, setRepresentativeUrl] = useState("");
  const [characterAUrl, setCharacterAUrl] = useState("");
  const [characterBUrl, setCharacterBUrl] = useState("");
  const [detailUrls, setDetailUrls] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<import("@supabase/supabase-js").User | null>(null);

  const characterMap = useMemo(() => {
    return new Map(characters.map((character) => [character.id, character]));
  }, [characters]);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    }

    loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const supabase = createClient();
        const storedPairs = localStorage.getItem(PAIR_STORAGE_KEY);
        const storedCharacters = localStorage.getItem(
          CHARACTER_STORAGE_KEY
        );

        const localPairs: Pair[] = storedPairs ? JSON.parse(storedPairs) : [];
        const loadedCharacters: Character[] = storedCharacters
          ? JSON.parse(storedCharacters)
          : [];

        const { data: row, error: pairError } = await supabase
          .from("pairs")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        const found: Pair | undefined = row
          ? {
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
              detailImageIds: Array.isArray(row.detail_image_ids) ? row.detail_image_ids : [],
            }
          : localPairs.find((item) => item.id === id);

        if (pairError) {
          console.error("Failed to load pair from Supabase:", pairError);
        }

        if (cancelled) return;

        setCharacters(loadedCharacters);

        if (!found) {
          setPair(null);
          setLoading(false);
          return;
        }

        setPair(found);

        const urls = await Promise.all([
          getImageFromDB(found.representativeImageId),
          getImageFromDB(found.characterAImageId),
          getImageFromDB(found.characterBImageId),
          ...(found.detailImageIds ?? []).map((imageId) =>
            getImageFromDB(imageId)
          ),
        ]);

        if (cancelled) {
          urls.forEach((url) => {
            if (url) URL.revokeObjectURL(url);
          });
          return;
        }

        setRepresentativeUrl(urls[0] ?? "");
        setCharacterAUrl(urls[1] ?? "");
        setCharacterBUrl(urls[2] ?? "");
        setDetailUrls(urls.slice(3).filter(Boolean));
      } catch (error) {
        console.error("Failed to load pair:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    return () => {
      if (representativeUrl) URL.revokeObjectURL(representativeUrl);
      if (characterAUrl) URL.revokeObjectURL(characterAUrl);
      if (characterBUrl) URL.revokeObjectURL(characterBUrl);
      detailUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [representativeUrl, characterAUrl, characterBUrl, detailUrls]);

  const characterA =
    pair?.characterAType === "archive"
      ? characterMap.get(pair.characterAId ?? "")
      : undefined;

  const characterB =
    pair?.characterBType === "archive"
      ? characterMap.get(pair.characterBId ?? "")
      : undefined;

  async function handleDelete() {
    if (!user) {
      router.push("/login");
      return;
    }

    if (!pair) return;

    const confirmed = window.confirm(
      `"${pair.name}" PAIR를 삭제할까요?\n삭제하면 되돌릴 수 없습니다.`
    );

    if (!confirmed) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("pairs")
        .delete()
        .eq("id", pair.id)
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to delete pair:", error);
        alert("삭제하지 못했습니다.");
        return;
      }

      const storedPairs = localStorage.getItem(PAIR_STORAGE_KEY);
      const pairs: Pair[] = storedPairs ? JSON.parse(storedPairs) : [];

      localStorage.setItem(
        PAIR_STORAGE_KEY,
        JSON.stringify(pairs.filter((item) => item.id !== pair.id))
      );

      router.push("/pair");
    } catch (error) {
      console.error("Failed to delete pair:", error);
      alert("삭제하지 못했습니다.");
    }
  }

  if (loading) {
    return (
      <main className="pair-detail-page">
        <div className="pair-detail-loading">LOADING...</div>
      </main>
    );
  }

  if (!pair) {
    return (
      <main className="pair-detail-page">
        <div className="pair-detail-empty">
          <span>404</span>
          <h1>PAIR NOT FOUND</h1>
          <p>존재하지 않거나 삭제된 PAIR입니다.</p>
          <Link href="/pair" className="detail-button">
            BACK TO PAIR
          </Link>
        </div>
      </main>
    );
  }

  const hasRepresentative =
    Boolean(representativeUrl) ||
    Boolean(characterAUrl) ||
    Boolean(characterBUrl);

  return (
    <>
      <main className="pair-detail-page">
        <header className="pair-detail-header">
          <Link href="/pair" className="back-link">
            ← PAIR
          </Link>

          <div className="flex items-center gap-2">
  <Link
    href={`/pair?edit=${pair.id}`}
    className="inline-flex h-[30px] items-center justify-center rounded-full border border-[var(--archive-border)] bg-[var(--archive-card)] px-3 text-[7px] font-medium tracking-[0.08em] text-[var(--archive-muted)] transition hover:border-[var(--archive-border)] hover:bg-[var(--archive-hover)]"
  >
    EDIT
  </Link>

  <button
    type="button"
    onClick={handleDelete}
    className="inline-flex h-[30px] items-center justify-center rounded-full border border-[var(--archive-border)] bg-[var(--archive-card)] px-3 text-[7px] font-medium tracking-[0.08em] text-[var(--archive-muted)] transition hover:border-[var(--archive-border)] hover:bg-[var(--archive-hover)]"
  >
    DELETE
  </button>
</div>

        </header>

        <section className="pair-title-section">
          <span className="section-index">PAIR</span>
          <h1>{pair.name || "UNTITLED PAIR"}</h1>

          {pair.relationship && (
            <p className="relationship">{pair.relationship}</p>
          )}
        </section>

        {hasRepresentative && (
          <section className="hero-section">
            {representativeUrl ? (
              <button
                type="button"
                className="hero-image-button"
                onClick={() => setSelectedImage(representativeUrl)}
              >
                <img
                  src={representativeUrl}
                  alt={pair.name}
                  className="hero-image"
                />
              </button>
            ) : (
              <div className="hero-character-images">
                {characterAUrl && (
                  <button
                    type="button"
                    onClick={() => setSelectedImage(characterAUrl)}
                  >
                    <img
                      src={characterAUrl}
                      alt={pair.characterAName}
                    />
                  </button>
                )}

                {characterBUrl && (
                  <button
                    type="button"
                    onClick={() => setSelectedImage(characterBUrl)}
                  >
                    <img
                      src={characterBUrl}
                      alt={pair.characterBName}
                    />
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        <section className="participants-section">
          <div className="section-heading">
            <span>01</span>
            <h2>CHARACTERS</h2>
          </div>

          <div className="participants-grid">
            <ParticipantCard
              side="A"
              type={pair.characterAType}
              name={pair.characterAName}
              character={characterA}
              imageUrl={characterAUrl}
              onOpenImage={setSelectedImage}
            />

            <ParticipantCard
              side="B"
              type={pair.characterBType}
              name={pair.characterBName}
              character={characterB}
              imageUrl={characterBUrl}
              onOpenImage={setSelectedImage}
            />
          </div>
        </section>

        {(pair.relationship || pair.description) && (
          <section className="info-section">
            <div className="section-heading">
              <span>02</span>
              <h2>RELATIONSHIP</h2>
            </div>

            {pair.relationship && (
              <p className="relationship-large">
                {pair.relationship}
              </p>
            )}

            {pair.description && (
              <div className="info-block">
                <span className="info-label">DESCRIPTION</span>
                <p className="description">{pair.description}</p>
              </div>
            )}
          </section>
        )}

        {pair.tags.length > 0 && (
          <section className="tags-section">
            <div className="section-heading">
              <span>03</span>
              <h2>TAGS</h2>
            </div>

            <div className="tags">
              {pair.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
          </section>
        )}

        {detailUrls.length > 0 && (
          <section className="gallery-section">
            <div className="section-heading">
              <span>04</span>
              <h2>DETAIL IMAGES</h2>
            </div>

            <div className="detail-gallery">
              {detailUrls.map((url, index) => (
                <button
                  type="button"
                  key={`${url}-${index}`}
                  onClick={() => setSelectedImage(url)}
                >
                  <img
                    src={url}
                    alt={`${pair.name} detail ${index + 1}`}
                  />
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      {selectedImage && (
        <div
          className="image-lightbox"
          role="button"
          tabIndex={0}
          onClick={() => setSelectedImage(null)}
          onKeyDown={(event) => {
            if (event.key === "Escape" || event.key === "Enter") {
              setSelectedImage(null);
            }
          }}
        >
          <button
            type="button"
            className="lightbox-close"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedImage(null);
            }}
          >
            ×
          </button>

          <img
            src={selectedImage}
            alt="PAIR preview"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}

      <style jsx>{`
        .pair-detail-page {
          min-height: 100vh;
          padding: 34px 42px 90px;
          max-width: 1280px;
          margin: 0 auto;
          background: var(--archive-bg);
        }

        .pair-detail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 54px;
        }

        .back-link,
        .detail-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 32px;
          border: 1px solid var(--archive-border);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.72);
          color: var(--archive-muted);
          text-decoration: none;
          font-size: 7px;
          font-weight: 600;
          letter-spacing: 0.14em;
          transition: all 0.18s ease;
          cursor: pointer;
        }

        .back-link {
          padding: 0 13px;
        }

        .header-actions {
          display: flex;
          gap: 6px;
        }

        .detail-button {
          padding: 0 13px;
        }

        .detail-button:hover,
        .back-link:hover {
          border-color: var(--archive-border);
          background: var(--archive-card);
          color: var(--archive-text);
        }

        .detail-button.danger {
          color: var(--archive-muted);
        }

        .detail-button.danger:hover {
          border-color: var(--archive-border);
          background: var(--archive-card);
          color: var(--archive-accent);
        }

        .pair-title-section {
          border-top: 1px solid var(--archive-border);
          padding-top: 15px;
          margin-bottom: 34px;
        }

        .section-index {
          display: block;
          margin-bottom: 12px;
          color: var(--archive-muted);
          font-size: 8px;
          font-weight: 600;
          letter-spacing: 0.2em;
        }

        .pair-title-section h1 {
          margin: 0;
          color: var(--archive-text);
          font-size: clamp(40px, 6vw, 76px);
          line-height: 0.98;
          font-weight: 400;
          letter-spacing: -0.055em;
          word-break: break-word;
        }

        .relationship {
          margin: 14px 0 0;
          color: var(--archive-muted);
          font-size: 12px;
          letter-spacing: 0.02em;
        }

        .hero-section {
          margin-bottom: 64px;
        }

        .hero-image-button,
        .hero-character-images button {
          display: block;
          border: 1px solid var(--archive-border);
          border-radius: 18px;
          padding: 0;
          background: var(--archive-soft);
          cursor: pointer;
          overflow: hidden;
        }

        .hero-image-button {
          width: 100%;
        }

        .hero-image {
          display: block;
          width: 100%;
          max-height: 680px;
          object-fit: contain;
          background: var(--archive-soft);
        }

        .hero-character-images {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .hero-character-images img {
          display: block;
          width: 100%;
          aspect-ratio: 1 / 1;
          object-fit: cover;
          transition: transform 0.3s ease;
        }

        .hero-character-images button:hover img {
          transform: scale(1.02);
        }

        .participants-section,
        .info-section,
        .tags-section,
        .gallery-section {
          margin-bottom: 64px;
        }

        .section-heading {
          display: flex;
          align-items: baseline;
          gap: 10px;
          border-top: 1px solid var(--archive-border);
          padding-top: 11px;
          margin-bottom: 20px;
        }

        .section-heading span {
          color: var(--archive-muted);
          font-size: 8px;
          letter-spacing: 0.12em;
        }

        .section-heading h2 {
          margin: 0;
          color: var(--archive-muted);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.16em;
        }

        .participants-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .participant-card {
          min-width: 0;
          overflow: hidden;
          border: 1px solid var(--archive-border);
          border-radius: 18px;
          background: var(--archive-card);
          box-shadow: 0 8px 24px rgba(30, 28, 24, 0.035);
        }

        .participant-card + .participant-card {
          border-left: 1px solid var(--archive-border);
        }

        .participant-image-button {
          display: block;
          width: 100%;
          border: 0;
          border-bottom: 1px solid var(--archive-border);
          padding: 0;
          background: var(--archive-soft);
          cursor: pointer;
          overflow: hidden;
        }

        .participant-image-button img {
          display: block;
          width: 100%;
          aspect-ratio: 4 / 3;
          object-fit: cover;
          transition: transform 0.3s ease;
        }

        .participant-image-button:hover img {
          transform: scale(1.025);
        }

        .participant-info {
          padding: 20px 22px 22px;
        }

        .participant-topline {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin-bottom: 10px;
        }

        .participant-side,
        .participant-type {
          font-size: 7px;
          letter-spacing: 0.13em;
        }

        .participant-side {
          color: var(--archive-muted);
        }

        .participant-divider {
          color: var(--archive-border);
          font-size: 8px;
        }

        .participant-type {
          color: var(--archive-muted);
          white-space: nowrap;
        }

        .participant-name {
          display: block;
          margin: 0;
          color: var(--archive-text);
          font-size: clamp(28px, 4vw, 48px) !important;
          line-height: 1.05;
          font-weight: 400;
          letter-spacing: -0.045em;
          word-break: keep-all;
        }

        .info-block {
          max-width: 820px;
          margin-bottom: 24px;
          padding: 20px 22px;
          border: 1px solid var(--archive-border);
          border-radius: 16px;
          background: var(--archive-card);
        }

        .relationship-large {
          margin: 0 0 24px;
          color: var(--archive-text);
          font-size: 22px;
          line-height: 1.45;
        }

        .info-label {
          display: block;
          margin-bottom: 9px;
          color: var(--archive-muted);
          font-size: 7px;
          font-weight: 600;
          letter-spacing: 0.15em;
        }

        .description {
          margin: 0;
          color: var(--archive-muted);
          font-size: 12px;
          line-height: 1.8;
          white-space: pre-wrap;
        }

        .tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .tags span {
          border: 1px solid var(--archive-border);
          border-radius: 999px;
          padding: 6px 9px;
          color: var(--archive-muted);
          background: var(--archive-card);
          font-size: 8px;
          letter-spacing: 0.05em;
        }

        .detail-gallery {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .detail-gallery button {
          border: 1px solid var(--archive-border);
          border-radius: 14px;
          padding: 0;
          background: var(--archive-soft);
          cursor: pointer;
          overflow: hidden;
        }

        .detail-gallery img {
          display: block;
          width: 100%;
          aspect-ratio: 1 / 1;
          object-fit: cover;
          transition: transform 0.25s ease;
        }

        .detail-gallery button:hover img {
          transform: scale(1.03);
        }

        .pair-detail-loading,
        .pair-detail-empty {
          min-height: 70vh;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 12px;
          text-align: center;
        }

        .pair-detail-empty span {
          color: var(--archive-muted);
          font-size: 8px;
          letter-spacing: 0.15em;
        }

        .pair-detail-empty h1 {
          margin: 0;
          color: var(--archive-text);
          font-size: 30px;
          font-weight: 400;
        }

        .pair-detail-empty p {
          margin: 0 0 12px;
          color: var(--archive-muted);
          font-size: 11px;
        }

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

        @media (max-width: 760px) {
          .pair-detail-page {
            padding: 24px 18px 70px;
          }

          .pair-detail-header {
            margin-bottom: 42px;
          }

          .pair-title-section h1 {
            font-size: 44px;
          }

          .participants-grid {
            grid-template-columns: 1fr;
          }

          .participant-card + .participant-card {
            border-left: 1px solid var(--archive-border);
          }

          .detail-gallery {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .hero-character-images {
            grid-template-columns: 1fr;
          }

          .header-actions {
            gap: 5px;
          }
        }
      `}</style>
    </>
  );
}

function PairDetailPageFallback() {
  return (
    <main className="pair-detail-page">
      <div className="pair-detail-loading">LOADING...</div>
    </main>
  );
}

export default function PairDetailPage() {
  return (
    <Suspense fallback={<PairDetailPageFallback />}>
      <PairDetailContent />
    </Suspense>
  );
}

