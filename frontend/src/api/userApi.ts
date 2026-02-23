import api from "./axios";

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  createdAt: string;
  totalAnalyses: number;
}

export interface UpdateProfileRequest {
  displayName: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export async function getProfile(): Promise<UserProfile> {
  const res = await api.get<UserProfile>("/user/me");
  return res.data;
}

export async function updateProfile(data: UpdateProfileRequest): Promise<UserProfile> {
  const res = await api.put<UserProfile>("/user/me", data);
  return res.data;
}

export async function changePassword(data: ChangePasswordRequest): Promise<void> {
  await api.put("/user/me/password", data);
}
