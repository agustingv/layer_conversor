import isomorphicFetch from "isomorphic-unfetch";
import { ENTRYPOINT } from "../config/entrypoint";

export interface LoginResponse {
  token: string;
}

export const loginUser = async (email: string, password: string): Promise<LoginResponse> => {
  const resp = await isomorphicFetch(`${ENTRYPOINT}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!resp.ok) {
    const json = await resp.json().catch(() => ({}));
    throw new Error(json.message || "Invalid credentials.");
  }

  return resp.json();
};

export const registerUser = async (email: string, password: string): Promise<void> => {
  const resp = await isomorphicFetch(`${ENTRYPOINT}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/ld+json" },
    body: JSON.stringify({ email, plainPassword: password }),
  });

  if (!resp.ok) {
    const json = await resp.json().catch(() => ({}));
    const message =
      json["hydra:description"] ||
      json.detail ||
      (json.violations as { message: string }[])?.[0]?.message ||
      "Registration failed.";
    throw new Error(message);
  }
};

export const getStoredToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("jwt_token");
};
