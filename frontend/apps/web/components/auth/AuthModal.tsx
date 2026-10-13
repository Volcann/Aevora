"use client";

import React, { useState } from "react";
import { X, Zap } from "lucide-react";
import { api, type UserProfile } from "../../lib/api";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("folium");
  const [password, setPassword] = useState("password123");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.login({
        username: identifier,
        password,
      });
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.register({
        username: regUsername,
        email: regEmail,
        password: regPassword,
      });
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.login({
        username: "folium",
        password: "password123",
      });
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to log in as folium");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-2xl bg-surface-solid border border-border p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-md cursor-pointer transition-colors"
          title="Close"
        >
          <X size={15} />
        </button>

        {/* Brand Avatar */}
        <div className="flex flex-col items-center mb-5 text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-400 via-indigo-500 to-purple-500 flex items-center justify-center shadow-md mb-2">
            <span className="text-xl font-black text-white">A</span>
          </div>
          <h2 className="text-lg font-bold text-foreground">
            {tab === "login" ? "Sign in to Aevora" : "Create an Account"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connected to local Django API
          </p>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Tab switch */}
        <div className="flex rounded-lg bg-surface p-1 mb-4 border border-border">
          <button
            type="button"
            onClick={() => {
              setTab("login");
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
              tab === "login"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("register");
              setError(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
              tab === "register"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Register
          </button>
        </div>

        {tab === "login" ? (
          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Username or Email
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="folium or folium@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:opacity-95 transition-opacity disabled:opacity-50 mt-1 shadow-sm"
            >
              {loading ? "Authenticating..." : "Sign In"}
            </button>

            {/* Quick 1-click test button */}
            <div className="pt-2 border-t border-border mt-3 text-center">
              <button
                type="button"
                onClick={handleQuickDemoLogin}
                disabled={loading}
                className="text-xs text-cyan-400 hover:underline font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Zap size={13} className="text-cyan-400" />
                <span>Quick 1-Click Login as folium</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Username
              </label>
              <input
                type="text"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                required
                className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="my_username"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
                className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Password
              </label>
              <input
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
                className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:opacity-95 transition-opacity disabled:opacity-50 mt-1 shadow-sm"
            >
              {loading ? "Registering..." : "Create Account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
