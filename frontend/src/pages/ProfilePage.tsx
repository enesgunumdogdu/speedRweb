import { useEffect, useState, type FormEvent } from "react";
import { getProfile, updateProfile, changePassword, type UserProfile } from "../api/userApi";
import { useAuth } from "../context/AuthContext";
import { extractApiError } from "../utils";

export default function ProfilePage() {
  const { updateUser } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");

  useEffect(() => {
    getProfile()
      .then((p) => {
        setProfile(p);
        setDisplayName(p.displayName);
      })
      .catch(() => setError("Failed to load profile."))
      .finally(() => setLoading(false));
  }, []);

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setProfileMsg("");
    setProfileError("");
    setProfileSaving(true);

    try {
      const updated = await updateProfile({ displayName });
      setProfile(updated);
      updateUser({ userId: updated.userId, email: updated.email, displayName: updated.displayName });
      setProfileMsg("Profile updated successfully.");
    } catch (err: unknown) {
      setProfileError(extractApiError(err, "Failed to update profile."));
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPwMsg("");
    setPwError("");

    if (newPassword.length < 6) {
      setPwError("New password must be at least 6 characters.");
      return;
    }

    setPwSaving(true);

    try {
      await changePassword({ currentPassword, newPassword });
      setPwMsg("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: unknown) {
      setPwError(extractApiError(err, "Failed to change password."));
    } finally {
      setPwSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page text-center mt-4">
        <div className="spinner" />
        <p className="mt-2" style={{ color: "var(--text-muted)" }}>Loading profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="page text-center mt-4">
        <p className="error-text mb-2">{error}</p>
        <button className="btn btn-ghost" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  const nameChanged = displayName !== profile.displayName;

  return (
    <div className="page" style={{ maxWidth: 520 }}>
      <h1 style={{ marginBottom: "1.5rem" }}>Profile</h1>

      <div className="card mb-3">
        <h2 style={{ marginBottom: "1.25rem" }}>Profile Information</h2>

        <div className="profile-info-row">
          <span className="profile-info-label">Email</span>
          <span className="profile-info-value">{profile.email}</span>
        </div>

        <div className="profile-info-row">
          <span className="profile-info-label">Member since</span>
          <span className="profile-info-value">{new Date(profile.createdAt).toLocaleDateString()}</span>
        </div>

        <div className="profile-info-row" style={{ marginBottom: "1.25rem" }}>
          <span className="profile-info-label">Total analyses</span>
          <span className="profile-info-value">{profile.totalAnalyses}</span>
        </div>

        <form onSubmit={handleProfileSubmit}>
          <div className="mb-2">
            <label>Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>

          {profileError && <p className="error-text mb-2">{profileError}</p>}
          {profileMsg && <p className="success-text mb-2">{profileMsg}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={!nameChanged || profileSaving}
          >
            {profileSaving ? "Saving..." : "Save"}
          </button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: "1.25rem" }}>Change Password</h2>

        <form onSubmit={handlePasswordSubmit}>
          <div className="mb-2">
            <label>Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              required
            />
          </div>

          <div className="mb-2">
            <label>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              minLength={6}
            />
          </div>

          {pwError && <p className="error-text mb-2">{pwError}</p>}
          {pwMsg && <p className="success-text mb-2">{pwMsg}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={pwSaving || !currentPassword || !newPassword}
          >
            {pwSaving ? "Changing..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
