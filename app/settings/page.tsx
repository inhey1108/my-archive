"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArchiveTheme,
  DEFAULT_THEME,
  THEME_PRESETS,
  useTheme,
} from "@/components/ThemeProvider";

type ArchiveCounts = {
  characters: number;
  pairs: number;
  prompts: number;
  notes: number;
};

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const { theme, saveTheme, resetTheme, saving } = useTheme();

  const [email, setEmail] = useState("");
  const [counts, setCounts] = useState<ArchiveCounts>({
    characters: 0,
    pairs: 0,
    prompts: 0,
    notes: 0,
  });

  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const [customTheme, setCustomTheme] =
    useState<ArchiveTheme>(theme);

  useEffect(() => {
    setCustomTheme(theme);
  }, [theme]);

  useEffect(() => {
    async function loadSettings() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        setEmail(user.email ?? "");

        const [
          charactersResult,
          pairsResult,
          promptsResult,
          notesResult,
        ] = await Promise.all([
          supabase
            .from("characters")
            .select("id", {
              count: "exact",
              head: true,
            }),

          supabase
            .from("pairs")
            .select("id", {
              count: "exact",
              head: true,
            }),

          supabase
            .from("prompts")
            .select("id", {
              count: "exact",
              head: true,
            }),

          supabase
            .from("notes")
            .select("id", {
              count: "exact",
              head: true,
            }),
        ]);

        setCounts({
          characters: charactersResult.count ?? 0,
          pairs: pairsResult.count ?? 0,
          prompts: promptsResult.count ?? 0,
          notes: notesResult.count ?? 0,
        });
      } catch (error) {
        console.error(
          "Failed to load settings:",
          error,
        );
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [router, supabase]);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Failed to logout:", error);
      alert("로그아웃하지 못했습니다.");
      setLoggingOut(false);
    }
  }

  async function handlePresetSelect(
    preset: ArchiveTheme,
  ) {
    await saveTheme(preset);
  }

  async function handleCustomSave() {
    await saveTheme({
      ...customTheme,
      name: "CUSTOM",
    });
  }

  function updateCustomColor(
    key: keyof ArchiveTheme,
    value: string,
  ) {
    setCustomTheme((current) => ({
      ...current,
      [key]: value,
      name: "CUSTOM",
    }));
  }

  const total =
    counts.characters +
    counts.pairs +
    counts.prompts +
    counts.notes;

  if (loading) {
    return (
      <main className="settings-page">
        <div className="loading">LOADING...</div>

        <style jsx>{`
          .settings-page {
            min-height: 100vh;
            background: var(--archive-bg);
            color: var(--archive-text);
            padding: 42px 48px 100px;
          }

          .loading {
            padding: 80px;
            text-align: center;
            color: var(--archive-muted);
            font-size: 10px;
            letter-spacing: 0.16em;
          }

          @media (max-width: 700px) {
            .settings-page {
              padding: 28px 20px 70px;
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="settings-page">
      <div className="settings-container">
        <header className="page-header">
          <div>
            <span className="eyebrow">
              07 · SETTINGS
            </span>

            <h1>SETTINGS</h1>

            <p>
              Manage your MY.ARCHIVE account and archive.
            </p>
          </div>
        </header>

        {/* ACCOUNT */}
        <section className="settings-section">
          <div className="section-label">
            <span>01</span>
            <h2>ACCOUNT</h2>
          </div>

          <div className="account-card">
            <div className="account-info">
              <span className="field-label">
                EMAIL
              </span>

              <strong>
                {email || "UNKNOWN"}
              </strong>
            </div>

            <button
              type="button"
              className="logout-button"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut
                ? "LOGGING OUT..."
                : "LOG OUT"}
            </button>
          </div>
        </section>

        {/* ARCHIVE */}
        <section className="settings-section">
          <div className="section-label">
            <span>02</span>
            <h2>ARCHIVE</h2>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <span>CHARACTER</span>
              <strong>{counts.characters}</strong>
            </div>

            <div className="stat-card">
              <span>PAIR</span>
              <strong>{counts.pairs}</strong>
            </div>

            <div className="stat-card">
              <span>PROMPT</span>
              <strong>{counts.prompts}</strong>
            </div>

            <div className="stat-card">
              <span>NOTE</span>
              <strong>{counts.notes}</strong>
            </div>

            <div className="stat-card total">
              <span>TOTAL ITEMS</span>
              <strong>{total}</strong>
            </div>
          </div>
        </section>

        {/* APPEARANCE */}
        <section className="settings-section">
          <div className="section-label">
            <span>03</span>
            <h2>APPEARANCE</h2>
          </div>

          <div className="theme-card">
            <div className="theme-intro">
              <div>
                <span className="field-label">
                  CURRENT THEME
                </span>

                <strong>{theme.name}</strong>
              </div>

              <p>
                MY.ARCHIVE 전체의 배경, 글자,
                카드와 포인트 색상을 변경합니다.
              </p>
            </div>

            <div className="theme-presets">
              {THEME_PRESETS.map((preset) => {
                const active =
                  theme.name === preset.name;

                return (
                  <button
                    key={preset.name}
                    type="button"
                    className={`theme-preset ${
                      active ? "active" : ""
                    }`}
                    onClick={() =>
                      handlePresetSelect(preset)
                    }
                    disabled={saving}
                  >
                    <span
                      className="theme-preview"
                      style={{
                        backgroundColor: preset.bg,
                        borderColor: preset.border,
                      }}
                    >
                      <span
                        style={{
                          backgroundColor:
                            preset.accent,
                        }}
                      />
                      <span
                        style={{
                          backgroundColor:
                            preset.card,
                          borderColor:
                            preset.border,
                        }}
                      />
                    </span>

                    <span className="theme-name">
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="custom-theme">
              <div className="custom-header">
                <div>
                  <span className="field-label">
                    CUSTOM COLORS
                  </span>

                  <strong>
                    직접 색상을 지정하세요.
                  </strong>
                </div>

                <button
                  type="button"
                  className="save-theme-button"
                  onClick={handleCustomSave}
                  disabled={saving}
                >
                  {saving
                    ? "SAVING..."
                    : "SAVE CUSTOM"}
                </button>
              </div>

              <div className="color-grid">
                <ColorInput
                  label="BACKGROUND"
                  value={customTheme.bg}
                  onChange={(value) =>
                    updateCustomColor(
                      "bg",
                      value,
                    )
                  }
                />

                <ColorInput
                  label="TEXT"
                  value={customTheme.text}
                  onChange={(value) =>
                    updateCustomColor(
                      "text",
                      value,
                    )
                  }
                />

                <ColorInput
                  label="MUTED"
                  value={customTheme.muted}
                  onChange={(value) =>
                    updateCustomColor(
                      "muted",
                      value,
                    )
                  }
                />

                <ColorInput
                  label="BORDER"
                  value={customTheme.border}
                  onChange={(value) =>
                    updateCustomColor(
                      "border",
                      value,
                    )
                  }
                />

                <ColorInput
                  label="CARD"
                  value={customTheme.card}
                  onChange={(value) =>
                    updateCustomColor(
                      "card",
                      value,
                    )
                  }
                />

                <ColorInput
                  label="ACCENT"
                  value={customTheme.accent}
                  onChange={(value) =>
                    updateCustomColor(
                      "accent",
                      value,
                    )
                  }
                />

                <ColorInput
                  label="HOVER"
                  value={customTheme.hover}
                  onChange={(value) =>
                    updateCustomColor(
                      "hover",
                      value,
                    )
                  }
                />

                <ColorInput
                  label="SOFT"
                  value={customTheme.soft}
                  onChange={(value) =>
                    updateCustomColor(
                      "soft",
                      value,
                    )
                  }
                />
              </div>
            </div>

            <button
              type="button"
              className="reset-theme-button"
              onClick={resetTheme}
              disabled={saving}
            >
              RESET TO MONO
            </button>
          </div>
        </section>

        {/* DATA */}
        <section className="settings-section">
          <div className="section-label">
            <span>04</span>
            <h2>DATA</h2>
          </div>

          <div className="info-card">
            <div>
              <span className="field-label">
                ARCHIVE STORAGE
              </span>

              <strong>SUPABASE</strong>
            </div>

            <p>
              Your archive data is stored securely in
              your MY.ARCHIVE account.
            </p>
          </div>
        </section>

        {/* ABOUT */}
        <section className="settings-section">
          <div className="section-label">
            <span>05</span>
            <h2>ABOUT</h2>
          </div>

          <div className="about-card">
            <div className="about-title">
              <span>MY.ARCHIVE</span>
              <strong>PERSONAL ARCHIVE</strong>
            </div>

            <p>
              A private archive for characters,
              relationships, prompts and notes.
            </p>

            <div className="version">
              <span>VERSION</span>
              <strong>1.0</strong>
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        .settings-page {
          min-height: 100vh;
          background: var(--archive-bg);
          color: var(--archive-text);
          padding: 42px 48px 100px;
          transition:
            background-color 0.25s ease,
            color 0.25s ease;
        }

        .settings-container {
          max-width: 1280px;
          margin: 0 auto;
        }

        .page-header {
          border-top: 1px solid var(--archive-accent);
          padding-top: 18px;
          margin-bottom: 90px;
        }

        .eyebrow {
          display: block;
          margin-bottom: 18px;
          color: var(--archive-muted);
          font-size: 9px;
          letter-spacing: 0.18em;
        }

        .page-header h1 {
          margin: 0;
          font-size: clamp(48px, 8vw, 100px);
          line-height: 0.9;
          font-weight: 400;
          letter-spacing: -0.06em;
        }

        .page-header p {
          max-width: 620px;
          margin: 24px 0 0;
          color: var(--archive-muted);
          font-size: 13px;
          line-height: 1.7;
        }

        .settings-section {
          border-top: 1px solid var(--archive-accent);
          padding-top: 18px;
          margin-bottom: 80px;
        }

        .section-label {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 24px;
        }

        .section-label span {
          color: var(--archive-muted);
          font-size: 9px;
          letter-spacing: 0.16em;
        }

        .section-label h2 {
          margin: 0;
          font-size: 12px;
          font-weight: 400;
          letter-spacing: 0.15em;
        }

        .account-card,
        .info-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 24px;
          border: 1px solid var(--archive-border);
          background: var(--archive-card);
        }

        .account-info,
        .info-card > div {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .field-label {
          color: var(--archive-muted);
          font-size: 8px;
          letter-spacing: 0.14em;
        }

        .account-info strong {
          font-size: 14px;
          font-weight: 400;
          overflow-wrap: anywhere;
        }

        .logout-button {
          flex-shrink: 0;
          min-width: 100px;
          height: 38px;
          padding: 0 14px;
          border: 1px solid var(--archive-accent);
          background: transparent;
          color: var(--archive-text);
          font-family: inherit;
          font-size: 9px;
          letter-spacing: 0.13em;
          cursor: pointer;
          transition:
            background 0.18s ease,
            color 0.18s ease;
        }

        .logout-button:hover {
          background: var(--archive-accent);
          color: var(--archive-bg);
        }

        .logout-button:disabled {
          opacity: 0.45;
          cursor: default;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          border-top: 1px solid var(--archive-border);
          border-left: 1px solid var(--archive-border);
        }

        .stat-card {
          min-height: 140px;
          box-sizing: border-box;
          padding: 20px;
          border-right: 1px solid var(--archive-border);
          border-bottom: 1px solid var(--archive-border);
          background: var(--archive-card);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .stat-card span {
          color: var(--archive-muted);
          font-size: 8px;
          letter-spacing: 0.13em;
        }

        .stat-card strong {
          font-size: 42px;
          line-height: 1;
          font-weight: 400;
          letter-spacing: -0.05em;
        }

        .stat-card.total {
          background: var(--archive-accent);
          color: var(--archive-bg);
        }

        .stat-card.total span {
          color: var(--archive-bg);
          opacity: 0.65;
        }

        .theme-card {
          padding: 24px;
          border: 1px solid var(--archive-border);
          background: var(--archive-card);
        }

        .theme-intro {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 30px;
          margin-bottom: 28px;
        }

        .theme-intro > div {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .theme-intro strong {
          font-size: 18px;
          font-weight: 400;
          letter-spacing: 0.04em;
        }

        .theme-intro p {
          max-width: 430px;
          margin: 0;
          color: var(--archive-muted);
          font-size: 11px;
          line-height: 1.7;
        }

        .theme-presets {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
        }

        .theme-preset {
          padding: 10px;
          border: 1px solid var(--archive-border);
          background: transparent;
          color: var(--archive-text);
          text-align: left;
          transition:
            border-color 0.18s ease,
            transform 0.18s ease;
        }

        .theme-preset:hover {
          transform: translateY(-2px);
          border-color: var(--archive-accent);
        }

        .theme-preset.active {
          border-color: var(--archive-accent);
          box-shadow: inset 0 0 0 1px var(--archive-accent);
        }

        .theme-preview {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 72px;
          padding: 10px;
          border: 1px solid;
        }

        .theme-preview > span:first-child {
          width: 10px;
          height: 32px;
          border-radius: 99px;
        }

        .theme-preview > span:last-child {
          flex: 1;
          height: 32px;
          border: 1px solid;
        }

        .theme-name {
          display: block;
          margin-top: 10px;
          font-size: 8px;
          letter-spacing: 0.13em;
        }

        .custom-theme {
          margin-top: 30px;
          padding-top: 24px;
          border-top: 1px solid var(--archive-border);
        }

        .custom-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 20px;
        }

        .custom-header > div {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .custom-header strong {
          font-size: 13px;
          font-weight: 400;
        }

        .save-theme-button,
        .reset-theme-button {
          height: 36px;
          padding: 0 14px;
          border: 1px solid var(--archive-accent);
          background: var(--archive-accent);
          color: var(--archive-bg);
          font-size: 8px;
          letter-spacing: 0.12em;
          transition: opacity 0.18s ease;
        }

        .save-theme-button:hover,
        .reset-theme-button:hover {
          opacity: 0.75;
        }

        .save-theme-button:disabled,
        .reset-theme-button:disabled {
          opacity: 0.45;
          cursor: default;
        }

        .color-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .color-input {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          padding: 10px;
          border: 1px solid var(--archive-border);
          background: var(--archive-soft);
        }

        .color-input input[type="color"] {
          width: 32px;
          height: 32px;
          padding: 0;
          border: 0;
          background: transparent;
          cursor: pointer;
        }

        .color-input-text {
          min-width: 0;
          flex: 1;
        }

        .color-input-text span {
          display: block;
          margin-bottom: 5px;
          color: var(--archive-muted);
          font-size: 7px;
          letter-spacing: 0.12em;
        }

        .color-input-text input[type="text"] {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--archive-text);
          font-size: 9px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .reset-theme-button {
          margin-top: 18px;
          background: transparent;
          color: var(--archive-text);
        }

        .info-card {
          align-items: flex-end;
        }

        .info-card strong {
          font-size: 15px;
          font-weight: 400;
          letter-spacing: 0.08em;
        }

        .info-card p {
          max-width: 420px;
          margin: 0;
          color: var(--archive-muted);
          font-size: 11px;
          line-height: 1.7;
        }

        .about-card {
          padding: 30px;
          border: 1px solid var(--archive-border);
          background: var(--archive-card);
        }

        .about-title {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .about-title span {
          font-size: 28px;
          letter-spacing: -0.04em;
        }

        .about-title strong {
          color: var(--archive-muted);
          font-size: 8px;
          font-weight: 400;
          letter-spacing: 0.16em;
        }

        .about-card > p {
          max-width: 600px;
          margin: 28px 0;
          color: var(--archive-muted);
          font-size: 12px;
          line-height: 1.8;
        }

        .version {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-top: 16px;
          border-top: 1px solid var(--archive-border);
        }

        .version span {
          color: var(--archive-muted);
          font-size: 8px;
          letter-spacing: 0.13em;
        }

        .version strong {
          font-size: 9px;
          font-weight: 400;
          letter-spacing: 0.1em;
        }

        @media (max-width: 1000px) {
          .theme-presets {
            grid-template-columns: repeat(3, 1fr);
          }

          .color-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 900px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .stat-card.total {
            grid-column: span 2;
          }
        }

        @media (max-width: 700px) {
          .settings-page {
            padding: 28px 20px 70px;
          }

          .page-header {
            margin-bottom: 60px;
          }

          .settings-section {
            margin-bottom: 60px;
          }

          .account-card,
          .info-card,
          .theme-intro,
          .custom-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .logout-button {
            width: 100%;
          }

          .theme-presets {
            grid-template-columns: repeat(2, 1fr);
          }

          .color-grid {
            grid-template-columns: 1fr;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .stat-card {
            min-height: 120px;
          }

          .stat-card strong {
            font-size: 34px;
          }

          .save-theme-button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const safeValue =
    /^#[0-9A-Fa-f]{6}$/.test(value)
      ? value
      : "#000000";

  return (
    <label className="color-input">
      <input
        type="color"
        value={safeValue}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />

      <span className="color-input-text">
        <span>{label}</span>

        <input
          type="text"
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          spellCheck={false}
        />
      </span>
    </label>
  );
}