import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { handleReadFile, kindOf, readDocx, readPptx, titleFrom } from "../src/readFile";

const docx = () =>
  zipSync({
    "word/document.xml": strToU8(
      `<w:document><w:body><w:p><w:r><w:t>Enzyme kinetics</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Km is the </w:t></w:r><w:r><w:t>substrate level at half Vmax &amp; more</w:t></w:r></w:p></w:body></w:document>`,
    ),
  });
const pptx = () =>
  zipSync({
    "ppt/slides/slide2.xml": strToU8(`<p:sld><a:p><a:r><a:t>Second slide</a:t></a:r></a:p></p:sld>`),
    "ppt/slides/slide10.xml": strToU8(`<p:sld><a:p><a:r><a:t>Tenth slide</a:t></a:r></a:p></p:sld>`),
    "ppt/slides/slide1.xml": strToU8(`<p:sld><a:p><a:r><a:t>The Krebs cycle</a:t></a:r></a:p><a:p><a:r><a:t>Happens in the mitochondria</a:t></a:r></a:p></p:sld>`),
  });

const post = (body: object) => new Request("http://x/api/read-file", { method: "POST", body: JSON.stringify(body) });
const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");

describe("read-file", () => {
  it("reads Word paragraphs in order, joining runs", () => {
    expect(readDocx(docx()).text).toBe("Enzyme kinetics\nKm is the substrate level at half Vmax & more");
  });
  it("reads slides in number order", () => {
    const r = readPptx(pptx());
    expect(r.pages).toBe(3);
    expect(r.text.indexOf("Krebs")).toBeLessThan(r.text.indexOf("Second"));
    expect(r.text.indexOf("Second")).toBeLessThan(r.text.indexOf("Tenth"));
  });
  it("names notes from their first real line", () => {
    expect(titleFrom("# Slide 1\nThe Krebs cycle\nmore", "x")).toBe("The Krebs cycle");
    expect(titleFrom("", "Lecture 3")).toBe("Lecture 3");
  });
  it("knows which files it can read", () => {
    expect(kindOf("a.PDF")).toBe("pdf");
    expect(kindOf("a.key")).toBeNull();
  });
  it("answers a Word file without calling a model", async () => {
    const res = await handleReadFile(post({ name: "Enzymes.docx", data: b64(docx()) }), {});
    const j = (await res.json()) as { title: string; text: string; readable: boolean };
    expect(res.status).toBe(200);
    expect(j.title).toBe("Enzyme kinetics");
    expect(j.readable).toBe(true);
  });
  it("turns away Keynote with a way forward", async () => {
    const res = await handleReadFile(post({ name: "talk.key", data: "AAAA" }), {});
    expect(res.status).toBe(415);
    expect(((await res.json()) as { error: string }).error).toMatch(/PDF/);
  });
});
