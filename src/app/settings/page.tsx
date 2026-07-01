import Link from "next/link";
import { getTimezone } from "@/lib/profile";
import { TimezoneSelect } from "@/components/TimezoneSelect";

export default async function SettingsPage() {
  const tz = await getTimezone();
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ marginBottom: 12 }}>
        <Link href="/">← Back</Link>
      </div>
      <h1 style={{ marginTop: 0 }}>Settings</h1>
      <TimezoneSelect initial={tz} />
    </main>
  );
}
