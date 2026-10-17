"use client";

import React, { useState } from "react";
import { Eye, EyeOff, Check, X, ArrowLeft, Key, RefreshCw } from "lucide-react";
import { api, type UserProfile } from "../../lib/api";
import type { ViewType } from "../nav/TopNavSwitcher";

interface AuthViewsProps {
  currentView: ViewType;
  onSwitchView: (view: ViewType) => void;
  onAuthSuccess: (user: UserProfile) => void;
  resetToken: string;
  setResetToken: (token: string) => void;
}

export function AuthViews({
  currentView,
  onSwitchView,
  onAuthSuccess,
  resetToken,
  setResetToken,
}: AuthViewsProps) {
  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Refresh token login state
  const [useTokenMode, setUseTokenMode] = useState(false);
  const [refreshTokenInput, setRefreshTokenInput] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenSuccess, setTokenSuccess] = useState<string | null>(null);

  // Register form state
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  // Reset password form state
  const [manualToken, setManualToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const activeToken = resetToken || manualToken;

  // Password strength calculation
  const getPasswordStrength = (val: string) => {
    if (!val) return { width: "0%", bg: "transparent", label: "Enter password", color: "var(--text-muted)" };
    let score = 0;
    if (val.length >= 8) score++;
    if (val.length >= 12) score++;
    if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
    if (/\d/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    if (score <= 1) {
      return { width: "25%", bg: "var(--err-text)", label: "Weak (Min 8 chars required)", color: "var(--err-text)" };
    } else if (score === 2 || score === 3) {
      return { width: "60%", bg: "#d29922", label: "Fair (Add symbols & numbers)", color: "#e3b341" };
    } else {
      return { width: "100%", bg: "var(--gh-green-bright)", label: "Strong & Secure", color: "var(--gh-green-bright)" };
    }
  };

  const regPassStrength = getPasswordStrength(regPassword);
  const resetPassStrength = getPasswordStrength(newPassword);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim() || !loginPassword) {
      setLoginError("Please enter your username/email and password.");
      return;
    }

    setLoginLoading(true);
    setLoginError(null);
    try {
      const isEmail = loginIdentifier.includes("@");
      const res = await api.login({
        email: isEmail ? loginIdentifier.trim() : undefined,
        username: !isEmail ? loginIdentifier.trim() : undefined,
        password: loginPassword,
      });
      onAuthSuccess(res.user);
      onSwitchView("chat");
    } catch (err: any) {
      setLoginError(err.message || "Invalid email, username, or password.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = refreshTokenInput.trim();
    if (!token) {
      setTokenError("Please enter your refresh token.");
      return;
    }

    setTokenLoading(true);
    setTokenError(null);
    setTokenSuccess(null);
    try {
      const res = await api.updateRefreshToken(token);
      if (res.success && res.user) {
        setTokenSuccess("Authentication successful! Loading...");
        setTimeout(() => {
          onAuthSuccess(res.user!);
          onSwitchView("chat");
        }, 300);
      } else if (res.success) {
        const profile = await api.getMe();
        setTokenSuccess("Authentication successful! Loading...");
        setTimeout(() => {
          onAuthSuccess(profile);
          onSwitchView("chat");
        }, 300);
      } else {
        setTokenError(res.error || "Invalid or expired refresh token.");
      }
    } catch (err: any) {
      setTokenError(err.message || "Failed to authenticate with refresh token.");
    } finally {
      setTokenLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword !== regConfirmPassword) {
      setRegError("Passwords do not match.");
      return;
    }
    if (regPassword.length < 8) {
      setRegError("Password must be at least 8 characters long.");
      return;
    }

    setRegLoading(true);
    setRegError(null);
    try {
      const res = await api.register({
        username: regUsername.trim(),
        email: regEmail.trim(),
        password: regPassword,
        confirm_password: regConfirmPassword,
      });
      onAuthSuccess(res.user);
      onSwitchView("chat");
    } catch (err: any) {
      setRegError(err.message || "Registration failed. Please check your information.");
    } finally {
      setRegLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotError("Please enter your email address.");
      return;
    }

    setForgotLoading(true);
    setForgotError(null);
    try {
      await api.forgotPassword(forgotEmail.trim());
      setForgotSuccess(true);
    } catch (err: any) {
      setForgotError(err.message || "Unable to send password reset email. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeToken.trim()) {
      setResetError("A valid password reset token is required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setResetError("Password must be at least 8 characters long.");
      return;
    }

    setResetLoading(true);
    setResetError(null);
    try {
      await api.resetPassword({
        token: activeToken.trim(),
        password: newPassword,
        confirm_password: confirmPassword,
      });
      setResetSuccess(true);
      setTimeout(() => {
        setResetToken("");
        setManualToken("");
        onSwitchView("login");
      }, 1800);
    } catch (err: any) {
      setResetError(err.message || "Failed to reset password. The link or token may have expired.");
    } finally {
      setResetLoading(false);
    }
  };

  const defaultAvatar = (
    <div className="avatar-wrapper">
      <span className="avatar-ring" aria-hidden="true">
        <img
          className="avatar"
          src="/icon.png"
          alt="Aevora"
          onError={(e) => {
            (e.target as HTMLElement).style.display = "none";
          }}
        />
      </span>
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center p-4 overflow-y-auto select-none">
      {/* ==================== 1. SIGN IN VIEW ==================== */}
      {currentView === "login" && (
        <div className="auth-view my-auto shrink-0 animate-in fade-in duration-200">
          <div className="login-container">
            {defaultAvatar}
            <h1 className="auth-title">Sign in to Aevora</h1>

            <div className="login-card">
              {useTokenMode ? (
                <form onSubmit={handleTokenSubmit} className="flex flex-col gap-3.5">
                  {tokenError && (
                    <div className="auth-alert error" style={{ display: "block" }}>
                      {tokenError}
                    </div>
                  )}
                  {tokenSuccess && (
                    <div className="auth-alert success flex items-center gap-1.5" style={{ display: "flex" }}>
                      <Check size={14} className="text-emerald-400 shrink-0" strokeWidth={2.5} />
                      <span>{tokenSuccess}</span>
                    </div>
                  )}

                  <div className="form-group">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="id_refresh_token">Refresh Token</label>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>JWT token</span>
                    </div>
                    <textarea
                      id="id_refresh_token"
                      placeholder="Paste your Aevora refresh token (ey...)"
                      value={refreshTokenInput}
                      onChange={(e) => setRefreshTokenInput(e.target.value)}
                      rows={4}
                      style={{
                        width: "100%",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: "12px",
                        lineHeight: "1.4",
                        padding: "8px 10px",
                        resize: "vertical",
                        borderRadius: "6px",
                      }}
                      required
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={tokenLoading}
                    className="btn-primary-mockup flex items-center justify-center gap-2"
                    style={{ marginTop: "6px" }}
                  >
                    {tokenLoading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Verifying & Signing in...</span>
                      </>
                    ) : (
                      <>
                        <Key size={14} />
                        <span>Sign in with Token</span>
                      </>
                    )}
                  </button>

                  <div style={{ borderTop: "1px solid var(--border-color, #30363d)", marginTop: "6px", paddingTop: "8px" }}>
                    <button
                      type="button"
                      onClick={() => { setUseTokenMode(false); setTokenError(null); }}
                      className="text-xs text-center text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1 w-full py-1"
                      style={{ background: "transparent", border: "none", cursor: "pointer" }}
                    >
                      ← Return to Username & Password
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {loginError && (
                    <div className="auth-alert error" style={{ display: "block" }}>
                      {loginError}
                    </div>
                  )}

                  <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3.5">
                    <div className="form-group">
                      <label htmlFor="id_username">Username or Email</label>
                      <input
                        type="text"
                        id="id_username"
                        placeholder="Enter your username or email"
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>

                    <div className="form-group">
                      <div className="password-header">
                        <label htmlFor="id_password">Password</label>
                        <a onClick={() => onSwitchView("forgot")}>Forgot password?</a>
                      </div>
                      <div className="password-input-wrap">
                        <input
                          type={showLoginPassword ? "text" : "password"}
                          id="id_password"
                          placeholder="••••••••"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          title={showLoginPassword ? "Hide password" : "Show password"}
                        >
                          {showLoginPassword ? (
                            <EyeOff size={14} className="text-muted-foreground" />
                          ) : (
                            <Eye size={14} className="text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="btn-primary-mockup"
                      style={{ marginTop: "6px" }}
                    >
                      {loginLoading ? "Signing in..." : "Sign in"}
                    </button>

                    <div style={{ borderTop: "1px solid var(--border-color, #30363d)", marginTop: "6px", paddingTop: "8px" }}>
                      <button
                        type="button"
                        onClick={() => { setUseTokenMode(true); setLoginError(null); }}
                        className="text-xs text-center text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5 w-full py-1"
                        style={{ background: "transparent", border: "none", cursor: "pointer" }}
                      >
                        <Key size={12} />
                        <span>Sign in with Refresh Token</span>
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>

            <div className="create-account-box">
              New to Aevora? <a onClick={() => onSwitchView("register")}>Create an account</a>
            </div>

            <p className="tech-tag">Aevora · Production Ready Agent Platform</p>
          </div>
        </div>
      )}

      {/* ==================== 2. REGISTER VIEW ==================== */}
      {currentView === "register" && (
        <div className="auth-view my-auto shrink-0 animate-in fade-in duration-200">
          <div className="login-container">
            {defaultAvatar}
            <h1 className="auth-title">Create your Aevora Account</h1>

            <div className="login-card">
              {regError && (
                <div className="auth-alert error" style={{ display: "block" }}>
                  {regError}
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-3.5">
                <div className="form-group">
                  <label htmlFor="reg_username">Username</label>
                  <input
                    type="text"
                    id="reg_username"
                    placeholder="Choose a username"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reg_email">Email address</label>
                  <input
                    type="email"
                    id="reg_email"
                    placeholder="name@example.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reg_password">Password</label>
                  <div className="password-input-wrap">
                    <input
                      type={showRegPassword ? "text" : "password"}
                      id="reg_password"
                      placeholder="At least 8 characters"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      title={showRegPassword ? "Hide password" : "Show password"}
                    >
                      {showRegPassword ? (
                        <EyeOff size={14} className="text-muted-foreground" />
                      ) : (
                        <Eye size={14} className="text-muted-foreground" />
                      )}
                    </button>
                  </div>

                  {/* Password strength meter */}
                  <div className="password-meter-wrap">
                    <div className="password-meter-bar">
                      <div
                        className="password-meter-fill"
                        style={{
                          width: regPassStrength.width,
                          backgroundColor: regPassStrength.bg,
                        }}
                      />
                    </div>
                    <div className="password-meter-label">
                      <span>Strength</span>
                      <span style={{ fontWeight: 600, color: regPassStrength.color }}>
                        {regPassStrength.label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="reg_confirm_password">Confirm Password</label>
                  <div className="password-input-wrap">
                    <input
                      type={showRegConfirm ? "text" : "password"}
                      id="reg_confirm_password"
                      placeholder="Re-enter password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowRegConfirm(!showRegConfirm)}
                      title={showRegConfirm ? "Hide password" : "Show password"}
                    >
                      {showRegConfirm ? (
                        <EyeOff size={14} className="text-muted-foreground" />
                      ) : (
                        <Eye size={14} className="text-muted-foreground" />
                      )}
                    </button>
                  </div>
                  {regConfirmPassword && (
                    <div
                      className="flex items-center gap-1.5"
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        color:
                          regPassword === regConfirmPassword
                            ? "var(--gh-green-bright)"
                            : "var(--err-text)",
                      }}
                    >
                      {regPassword === regConfirmPassword ? (
                        <>
                          <Check size={12} strokeWidth={2.5} /> Passwords match
                        </>
                      ) : (
                        <>
                          <X size={12} strokeWidth={2.5} /> Passwords do not match
                        </>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={regLoading}
                  className="btn-primary-mockup"
                  style={{ marginTop: "6px" }}
                >
                  {regLoading ? "Creating account..." : "Create account"}
                </button>
              </form>
            </div>

            <div className="create-account-box">
              Already have an account? <a onClick={() => onSwitchView("login")}>Sign in</a>
            </div>

            <p className="tech-tag">Aevora · Production Ready Agent Platform</p>
          </div>
        </div>
      )}

      {/* ==================== 3. FORGOT PASSWORD VIEW ==================== */}
      {currentView === "forgot" && (
        <div className="auth-view my-auto shrink-0 animate-in fade-in duration-200">
          <div className="login-container">
            {defaultAvatar}
            <h1 className="auth-title">Reset your password</h1>

            <div className="login-card">
              {forgotSuccess ? (
                <div className="flex flex-col gap-3">
                  <div className="auth-alert success flex items-center gap-1.5" style={{ display: "flex" }}>
                    <Check size={14} className="text-emerald-400 shrink-0" strokeWidth={2.5} />
                    <span>If this email is registered, a password reset link has been sent to your email.</span>
                  </div>
                  <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                    Please check your inbox and click the reset link in the email, or paste your reset token below to proceed.
                  </p>
                  <button
                    type="button"
                    onClick={() => onSwitchView("reset")}
                    className="btn-primary-mockup"
                    style={{ marginTop: "4px" }}
                  >
                    Enter Reset Token →
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="flex flex-col gap-3.5">
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                    Enter your account's email address below. We'll send you instructions and a secure link to reset your password.
                  </p>

                  {forgotError && (
                    <div className="auth-alert error" style={{ display: "block" }}>
                      {forgotError}
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="forgot_email">Email address</label>
                    <input
                      type="email"
                      id="forgot_email"
                      placeholder="user@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="btn-primary-mockup"
                    style={{ marginTop: "6px" }}
                  >
                    {forgotLoading ? "Sending email..." : "Send password reset email"}
                  </button>
                </form>
              )}
            </div>

            <div className="create-account-box flex items-center justify-between text-xs">
              <a onClick={() => onSwitchView("login")} className="inline-flex items-center gap-1 cursor-pointer">
                <ArrowLeft size={12} /> Back to Sign in
              </a>
              <a onClick={() => onSwitchView("reset")} className="cursor-pointer">Already have a token?</a>
            </div>

            <p className="tech-tag">Aevora · Production Ready Agent Platform</p>
          </div>
        </div>
      )}

      {/* ==================== 4. RESET PASSWORD VIEW ==================== */}
      {currentView === "reset" && (
        <div className="auth-view my-auto shrink-0 animate-in fade-in duration-200">
          <div className="login-container">
            {defaultAvatar}
            <h1 className="auth-title">Choose a new password</h1>

            <div className="login-card">
              {resetSuccess && (
                <div className="auth-alert success flex items-center gap-1.5" style={{ display: "flex" }}>
                  <Check size={14} className="text-emerald-400 shrink-0" strokeWidth={2.5} />
                  <span>Password reset successfully! Redirecting you to sign in...</span>
                </div>
              )}

              {/* If token came from URL/Email, show Verified Token Badge */}
              {resetToken ? (
                <div className="token-verified-card">
                  <div className="token-verified-badge">
                    <span className="token-verified-dot" />
                    <span>Security Token Attached</span>
                  </div>
                  <div className="token-verified-info">
                    Token:{" "}
                    <code>
                      {resetToken.length > 24
                        ? `${resetToken.slice(0, 14)}...${resetToken.slice(-8)}`
                        : resetToken}
                    </code>
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="reset_token">Reset Token</label>
                  <input
                    type="text"
                    id="reset_token"
                    placeholder="Paste token from reset email"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    required
                  />
                </div>
              )}

              <form onSubmit={handleResetSubmit} className="flex flex-col gap-3.5">
                <div className="form-group">
                  <label htmlFor="new_password">New password</label>
                  <div className="password-input-wrap">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      id="new_password"
                      placeholder="At least 8 characters"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      title={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? (
                        <EyeOff size={14} className="text-muted-foreground" />
                      ) : (
                        <Eye size={14} className="text-muted-foreground" />
                      )}
                    </button>
                  </div>

                  {/* Live Password Strength Meter */}
                  <div className="password-meter-wrap">
                    <div className="password-meter-bar">
                      <div
                        className="password-meter-fill"
                        style={{
                          width: resetPassStrength.width,
                          backgroundColor: resetPassStrength.bg,
                        }}
                      />
                    </div>
                    <div className="password-meter-label">
                      <span>Strength</span>
                      <span style={{ fontWeight: 600, color: resetPassStrength.color }}>
                        {resetPassStrength.label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="confirm_password">Confirm new password</label>
                  <div className="password-input-wrap">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirm_password"
                      placeholder="Re-enter password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      title={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={14} className="text-muted-foreground" />
                      ) : (
                        <Eye size={14} className="text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>

                {confirmPassword && (
                  <div
                    className="flex items-center gap-1.5"
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      color:
                        newPassword === confirmPassword
                          ? "var(--gh-green-bright)"
                          : "var(--err-text)",
                    }}
                  >
                    {newPassword === confirmPassword ? (
                      <>
                        <Check size={12} strokeWidth={2.5} /> Passwords match
                      </>
                    ) : (
                      <>
                        <X size={12} strokeWidth={2.5} /> Passwords do not match
                      </>
                    )}
                  </div>
                )}

                {resetError && (
                  <div className="auth-alert error" style={{ display: "block" }}>
                    {resetError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={resetLoading || resetSuccess}
                  className="btn-primary-mockup"
                  style={{ marginTop: "6px" }}
                >
                  {resetLoading ? "Changing password..." : "Change password"}
                </button>
              </form>
            </div>

            <div className="create-account-box">
              Return to <a onClick={() => onSwitchView("login")}>Sign in</a>
            </div>

            <p className="tech-tag">Aevora · Production Ready Agent Platform</p>
          </div>
        </div>
      )}
    </div>
  );
}
