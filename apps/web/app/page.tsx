import Link from "next/link";

export default function HomePage() {
  return (
    <div className="sf-auth-shell">
      <div className="sf-card sf-auth-card" style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>ServeFlow</h1>
        <p style={{ color: "var(--sf-text-secondary)", fontSize: 14, marginBottom: 24 }}>
          The intelligent volunteer management platform for churches.
        </p>
        <Link href="/login" className="sf-button" style={{ display: "block", textDecoration: "none", marginBottom: 12 }}>
          Log in
        </Link>
        <Link href="/register" style={{ fontSize: 13, color: "var(--sf-brand-600)" }}>
          Set up your church &rarr;
        </Link>
      </div>
    </div>
  );
}
