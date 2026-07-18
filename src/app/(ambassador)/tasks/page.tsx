import { requireUserOrRedirect } from "@/lib/auth";
import { CONSENT_COPY } from "@/features/consent/copy";

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  }
  await requireUserOrRedirect(`/tasks${query.size ? `?${query.toString()}` : ""}`);
  return <main className="mx-auto min-h-screen w-full max-w-xl px-4 py-8"><h1>{CONSENT_COPY.tasksTitle}</h1><p className="intro">{CONSENT_COPY.tasksEmpty}</p></main>;
}
