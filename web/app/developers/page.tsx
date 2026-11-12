// Stage 19: the API docs, made on the server from the API's own OpenAPI document (/api/openapi.json).
// No docs library: one Server Component, so the page needs no JavaScript in the browser.

import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { apiFetch } from "@/lib/api/client";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "API docs", description: "Every endpoint of Nook's API: what it does, who can use it, and what it accepts." };
export const dynamic = "force-dynamic"; // the API isn't running while the site is built

type Schema = {
  type?: string | string[];
  enum?: unknown[];
  properties?: Record<string, Schema>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  default?: unknown;
  items?: Schema;
  anyOf?: Schema[];
};
type Param = { name: string; in: string; required: boolean; schema: Schema };
type Operation = {
  tags: string[];
  summary: string;
  description?: string;
  security?: Record<string, string[]>[];
  parameters: Param[];
  requestBody?: { content: Record<string, { schema: Schema }> };
};
type Doc = { info: { title: string; description: string }; tags: { name: string }[]; paths: Record<string, Record<string, Operation>> };

const METHOD_TONE: Record<string, string> = {
  get: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  post: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  put: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  patch: "bg-violet-500/15 text-violet-800 dark:text-violet-200",
  delete: "bg-rose-500/15 text-rose-800 dark:text-rose-200",
};

// A short description of a JSON Schema: "string, up to 40", "one of week | all", "number 1–7, default 7"
function describe(s: Schema | undefined): string {
  if (!s) return "";
  if (s.anyOf) return s.anyOf.map(describe).join(" or ");
  if (s.enum) return `one of ${s.enum.join(" | ")}`;
  const type = Array.isArray(s.type) ? s.type.join(" or ") : (s.type ?? "any");
  const range =
    s.minimum !== undefined || s.maximum !== undefined ? ` ${s.minimum ?? ""}–${s.maximum ?? ""}` : s.maxLength !== undefined ? `, up to ${s.maxLength}` : "";
  const items = s.type === "array" && s.items ? ` of ${describe(s.items)}` : "";
  const def = s.default !== undefined ? `, default ${JSON.stringify(s.default)}` : "";
  return `${type}${range}${items}${def}`;
}

function Fields({ schema }: { schema: Schema }) {
  const props = Object.entries(schema.properties ?? {});
  if (!props.length) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1 text-sm">
      {props.map(([name, s]) => (
        <li key={name} className="flex flex-wrap gap-x-2">
          <code className="font-semibold">{name}</code>
          {!schema.required?.includes(name) && <span className="text-muted">(optional)</span>}
          <span className="text-muted">{describe(s)}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function DevelopersPage() {
  let doc: Doc | null = null;
  try {
    doc = await apiFetch<Doc>("/api/openapi.json", { cache: "no-store" });
  } catch {
    doc = null;
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">API docs</h1>
        <p className="mt-2 text-muted">
          Everything the website does goes through this API, so you can use it too: from a script, an app, or tools like Bruno or Postman. The same list in a
          standard format (OpenAPI 3.1) is at{" "}
          <a href="/api/openapi.json" className="font-semibold text-primary underline">
            /api/openapi.json
          </a>
          .
        </p>
        <p className="mt-2 text-sm text-muted">
          Who can call what: <strong className="text-text">anyone</strong> on your network; a <strong className="text-text">guest</strong> sends a random id in
          the <code>X-Client-Id</code> header; a <strong className="text-text">name</strong> means the <code>nook_session</code> cookie you get from{" "}
          <code>POST /api/me</code>. Writes must come from Nook&apos;s own pages or send JSON (that blocks other sites from acting as you).
        </p>
      </div>

      {!doc ? (
        <Card>
          <p className="text-muted">Couldn&apos;t reach the API right now. Try again in a moment.</p>
        </Card>
      ) : (
        <>
          <nav aria-label="Sections" className="flex flex-wrap gap-2">
            {doc.tags.map((t) => (
              <Link key={t.name} href={`#${slug(t.name)}`} className="rounded-full border border-border bg-surface-strong px-3 py-1 text-sm font-semibold">
                {t.name}
              </Link>
            ))}
          </nav>
          {doc.tags.map((t) => {
            const ops = Object.entries(doc.paths).flatMap(([path, methods]) =>
              Object.entries(methods)
                .filter(([, op]) => op.tags.includes(t.name))
                .map(([method, op]) => ({ path, method, op })),
            );
            return (
              <section key={t.name} id={slug(t.name)} className="flex scroll-mt-20 flex-col gap-3">
                <h2 className="text-xl font-bold">{t.name}</h2>
                {ops.map(({ path, method, op }) => {
                  const body = op.requestBody && Object.entries(op.requestBody.content)[0];
                  const query = op.parameters.filter((p) => p.in === "query");
                  const who = op.security ? (op.security.some((s) => "guest" in s) ? "guest or name" : "name") : "anyone";
                  return (
                    <Card key={method + path} className="p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-md px-2 py-0.5 font-mono text-xs font-bold uppercase", METHOD_TONE[method])}>{method}</span>
                        <code className="font-semibold break-all">{path}</code>
                        <span className="ml-auto rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-muted">{who}</span>
                      </div>
                      <p className="mt-2">{op.summary}</p>
                      {query.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Query</p>
                          <Fields
                            schema={{
                              properties: Object.fromEntries(query.map((q) => [q.name, q.schema])),
                              required: query.filter((q) => q.required).map((q) => q.name),
                            }}
                          />
                        </div>
                      )}
                      {body && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Body ({body[0] === "application/json" ? "JSON" : "form"})</p>
                          <Fields schema={body[1].schema} />
                        </div>
                      )}
                    </Card>
                  );
                })}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
