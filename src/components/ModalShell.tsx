"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Wraps children in a fixed-position modal. Closes via the X button, ESC key,
 * or a backdrop click.
 */
export function ModalShell({
  closeHref,
  children,
}: {
  closeHref: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") router.push(closeHref);
    }
    window.addEventListener("keydown", onKey);
    // Lock body scroll while modal is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [router, closeHref]);

  return (
    <div
      onClick={() => router.push(closeHref)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          border: "1px solid #000",
          maxWidth: 520,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: 20,
          position: "relative",
        }}
      >
        <Link
          href={closeHref}
          aria-label="Close"
          style={{
            position: "absolute",
            right: 12,
            top: 8,
            fontSize: 24,
            lineHeight: 1,
            textDecoration: "none",
          }}
        >
          ×
        </Link>
        {children}
      </div>
    </div>
  );
}
