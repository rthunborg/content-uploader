const ALLOWED_PATH_ROOTS = [
  "/tasks",
  "/upload",
  "/my-uploads",
  "/profile",
  "/admin",
] as const;

const BASE_URL = "https://continuation.invalid";

export function safeContinuation(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  try {
    const parsed = new URL(value, BASE_URL);

    if (parsed.origin !== BASE_URL) {
      return "/";
    }

    const allowed =
      parsed.pathname === "/" ||
      ALLOWED_PATH_ROOTS.some(
        (root) =>
          parsed.pathname === root || parsed.pathname.startsWith(`${root}/`),
      );

    return allowed
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : "/";
  } catch {
    return "/";
  }
}
