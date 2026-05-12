// frontend/src/services/profileService.js
import api from './api';

export async function fetchFullProfile(username) {
  const { data } = await api.get(`/users/${encodeURIComponent(username)}`);
  return data;
}

export async function updateMyProfile(patch) {
  const { data } = await api.patch('/users/me', patch);
  return data;
}
