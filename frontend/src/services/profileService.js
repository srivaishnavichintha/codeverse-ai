// frontend/src/services/profileService.js
import api from './api';

export async function fetchFullProfile(username) {
  const { data } = await api.get(`/profile/${encodeURIComponent(username)}/full`);
  return data;
}

export async function updateMyProfile(patch) {
  const { data } = await api.patch('/profile/me', patch);
  return data;
}
