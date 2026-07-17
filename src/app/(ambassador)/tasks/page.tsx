import { requireUserOrRedirect } from "@/lib/auth";
import { CONSENT_COPY } from "@/features/consent/copy";

export default async function TasksPage() {
  await requireUserOrRedirect("/tasks");
  return <main className="mx-auto min-h-screen w-full max-w-xl px-4 py-8"><h1>{CONSENT_COPY.tasksTitle}</h1><p className="intro">{CONSENT_COPY.tasksEmpty}</p></main>;
}
