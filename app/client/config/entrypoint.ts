const isBrowser = typeof window !== "undefined";

export const ENTRYPOINT = isBrowser
  ? (process.env.NEXT_PUBLIC_ENTRYPOINT ?? "http://localhost:8080") + "/api"
  : (process.env.API_ENTRYPOINT ?? "http://nginx/api");
