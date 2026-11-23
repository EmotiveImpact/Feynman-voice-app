// Node (req, res) adapter around the handlers, used by the deployed functions
// and the local dev server. Streams the response body, so live turns arrive
// sentence by sentence.
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleLiveTurn } from "./live";
import { handleAnalyse, handleShowMe } from "./review";
import { handleTurn } from "./turn";
import { handleLesson } from "./lesson";
import { handleSpeak } from "./speak";
import { handleLook } from "./look";
import { handleReadPage } from "./readPage";

const ROUTES: Record<string, (req: Request) => Promise<Response>> = {
  "/api/turn": (r) => handleTurn(r),
  "/api/live-turn": (r) => handleLiveTurn(r),
  "/api/lesson": (r) => handleLesson(r),
  "/api/speak": (r) => handleSpeak(r),
  "/api/look": (r) => handleLook(r),
  "/api/read-page": (r) => handleReadPage(r),
  "/api/analyse": (r) => handleAnalyse(r),
  "/api/show-me": (r) => handleShowMe(r),
};

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = (req.url ?? "/api/turn").split("?")[0];
  const route = ROUTES[path];
  if (!route) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  const request = new Request(`https://local${req.url}`, {
    method: req.method,
    headers,
    body: req.method === "POST" ? Buffer.concat(chunks) : undefined,
  });
  try {
    const response = await route(request);
    res.writeHead(response.status, { "content-type": response.headers.get("content-type") ?? "application/json" });
    if (!response.body) {
      res.end();
      return;
    }
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Server error" }));
  }
}
