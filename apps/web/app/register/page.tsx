"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    churchName: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(form);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sf-auth-shell">
      <form className="sf-card sf-auth-card" onSubmit={onSubmit}>
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>Set up your church</h1>
        <p style={{ fontSize: 13, color: "var(--sf-text-secondary)", marginBottom: 20 }}>
          Creates your church, a main campus, and your Church Admin account.
        </p>
        {error && <div className="sf-error">{error}</div>}
        <label className="sf-label" htmlFor="churchName">Church name</label>
        <input id="churchName" className="sf-input" required value={form.churchName} onChange={update("churchName")} />
        <label className="sf-label" htmlFor="firstName">First name</label>
        <input id="firstName" className="sf-input" required value={form.firstName} onChange={update("firstName")} />
        <label className="sf-label" htmlFor="lastName">Last name</label>
        <input id="lastName" className="sf-input" required value={form.lastName} onChange={update("lastName")} />
        <label className="sf-label" htmlFor="email">Email</label>
        <input id="email" className="sf-input" type="email" required value={form.email} onChange={update("email")} />
        <label className="sf-label" htmlFor="password">Password</label>
        <input id="password" className="sf-input" type="password" required value={form.password} onChange={update("password")} />
        <p style={{ fontSize: 12, color: "var(--sf-text-secondary)", marginBottom: 12 }}>
          At least 10 characters, one uppercase letter, one number.
        </p>
        <button className="sf-button" type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create church"}
        </button>
      </form>
    </div>
  );
}
