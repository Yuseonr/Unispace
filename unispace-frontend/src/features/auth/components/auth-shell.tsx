import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

type AuthShellProps = {
  children: ReactNode;
  titleId: string;
  variant: "login" | "register";
};

export function AuthShell({ children, titleId, variant }: AuthShellProps) {
  const isRegister = variant === "register";

  return (
    <main className={`auth-page auth-page--login${isRegister ? " auth-page--register" : ""}`}>
      <section className="auth-showcase auth-showcase--login" aria-hidden="true">
        <Image
          alt=""
          className="auth-showcase__photo"
          fill
          priority
          sizes="(max-width: 820px) 100vw, 50vw"
          src="/login.png"
        />
      </section>

      <section className="auth-panel auth-panel--login" aria-labelledby={titleId}>
        <Link className="auth-panel__logo" href="/" aria-label="Kembali ke Unispace">
          <Image
            alt="Unispace"
            height={360}
            src="/Unispace_Logo_Trademark.svg"
            width={1450}
          />
        </Link>
        <div className="auth-panel__inner">{children}</div>
      </section>
    </main>
  );
}
