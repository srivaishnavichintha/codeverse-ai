import { api } from "../services/apiClient.js";

export const getDiscussions = () =>
  api.get("/discussions");

export const getDiscussion = (id) =>
  api.get(`/discussions/${id}`);

export const createDiscussion = (payload) =>
  api.post("/discussions", payload);

export const deleteDiscussion = (id) =>
  api.delete(`/discussions/${id}`);

export const voteDiscussion = (id) =>
  api.post(`/discussions/${id}/vote`);

export const getComments = (id) =>
  api.get(`/discussions/${id}/comments`);

export const getTrending = () =>
  api.get("/discussions/stats/trending");

export const getTopContributors = () =>
  api.get("/discussions/stats/contributors");

export const addComment = (id, payload) =>
  api.post(
    `/discussions/${id}/comments`,
    payload
  );

export const voteComment = (id) =>
  api.post(`/comments/${id}/vote`);

export const pinDiscussion = (id) =>
  api.post(`/discussions/${id}/pin`);

