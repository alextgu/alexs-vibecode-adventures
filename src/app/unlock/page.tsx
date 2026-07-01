import Link from "next/link";
import { UnlockForm } from "@/components/UnlockForm";

export default function UnlockPage() {
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "48px 20px" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/">← Back</Link>
      </div>
      <h1 style={{ marginTop: 0 }}>Unlock edit mode</h1>
      <p style={{ fontSize: 14, opacity: 0.7 }}>
        Enter the admin password to check rules and write in the diary.
      </p>
      <UnlockForm />
    </main>
  );
}
