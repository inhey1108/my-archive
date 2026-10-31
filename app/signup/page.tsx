"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    if (password !== confirmPassword) {
      setError("비밀번호가 서로 다릅니다.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError("회원가입에 실패했습니다. 입력한 정보를 확인해주세요.");
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/");
      router.refresh();
      return;
    }

    setMessage(
      "회원가입이 완료되었습니다. 이메일 인증이 필요한 경우 메일함을 확인해주세요."
    );
    setLoading(false);
  };

  return (
    <main className="auth-page">
      <div className="auth-wrap">
        <div className="auth-intro">
          <p className="eyebrow">MY.ARCHIVE</p>
          <h1>CREATE<br />ACCOUNT.</h1>
          <p className="description">
            하나의 계정으로 캐릭터, 페어, 프롬프트,<br />
            노트를 여러 기기에서 관리하세요.
          </p>
        </div>

        <form className="auth-card" onSubmit={handleSignup}>
          <div className="card-heading">
            <p className="eyebrow">ACCOUNT / 02</p>
            <h2>SIGN UP</h2>
          </div>

          <label>
            <span>EMAIL</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            <span>PASSWORD</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상"
              autoComplete="new-password"
              required
            />
          </label>

          <label>
            <span>CONFIRM PASSWORD</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="비밀번호 다시 입력"
              autoComplete="new-password"
              required
            />
          </label>

          {error && <p className="error">{error}</p>}
          {message && <p className="message">{message}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "CREATING..." : "CREATE ACCOUNT"}
          </button>

          <p className="switch">
            이미 계정이 있나요?{" "}
            <Link href="/login">로그인</Link>
          </p>
        </form>
      </div>

      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          background: #f4f4f0;
          color: #171717;
          padding: 70px 44px;
          display: flex;
          align-items: center;
        }

        .auth-wrap {
          width: min(1080px, 100%);
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 420px;
          gap: 90px;
          align-items: center;
        }

        .eyebrow {
          margin: 0 0 12px;
          color: #888;
          font-size: 9px;
          letter-spacing: 0.2em;
        }

        h1 {
          margin: 0;
          font-size: clamp(52px, 7vw, 92px);
          font-weight: 400;
          line-height: 0.88;
          letter-spacing: -0.06em;
        }

        .description {
          margin-top: 28px;
          color: #777;
          font-size: 12px;
          line-height: 1.8;
        }

        .auth-card {
          border: 1px solid #d8d8d2;
          background: #fff;
          padding: 34px;
        }

        .card-heading {
          border-bottom: 1px solid #ddd;
          padding-bottom: 24px;
          margin-bottom: 28px;
        }

        h2 {
          margin: 0;
          font-size: 30px;
          font-weight: 400;
          letter-spacing: -0.04em;
        }

        label {
          display: block;
          margin-top: 20px;
        }

        label span {
          display: block;
          margin-bottom: 8px;
          color: #777;
          font-size: 9px;
          letter-spacing: 0.14em;
        }

        input {
          box-sizing: border-box;
          width: 100%;
          border: 1px solid #d5d5d0;
          background: #fff;
          padding: 13px 12px;
          outline: none;
          font: inherit;
          font-size: 12px;
        }

        input:focus {
          border-color: #111;
        }

        form > button {
          width: 100%;
          margin-top: 28px;
          border: 1px solid #111;
          background: #111;
          color: #fff;
          padding: 14px;
          cursor: pointer;
          font-size: 10px;
          letter-spacing: 0.15em;
        }

        form > button:hover:not(:disabled) {
          background: #fff;
          color: #111;
        }

        form > button:disabled {
          opacity: 0.5;
          cursor: default;
        }

        .error {
          margin-top: 14px;
          color: #a33;
          font-size: 10px;
        }

        .message {
          margin-top: 14px;
          color: #555;
          font-size: 10px;
          line-height: 1.6;
        }

        .switch {
          margin: 20px 0 0;
          color: #888;
          text-align: center;
          font-size: 10px;
        }

        .switch a {
          color: #111;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        @media (max-width: 760px) {
          .auth-page {
            padding: 36px 18px;
          }

          .auth-wrap {
            grid-template-columns: 1fr;
            gap: 42px;
          }

          .auth-card {
            padding: 24px;
          }
        }
      `}</style>
    </main>
  );
}
