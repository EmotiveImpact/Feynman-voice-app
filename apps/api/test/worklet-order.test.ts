// The app's drawing code runs as "worklets" on the UI thread. The worklet
// build captures each function's helpers at the point where the function is
// written, so a helper written lower down the file is missing on the phone:
// the picture throws and the panel stays blank. This test keeps every worklet
// file in dependency order (each function after the helpers it uses).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../../mobile/src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx?$/.test(n) ? [p] : [];
  });
}

/** A function, or a const holding one, whose body starts with "worklet". */
function isWorklet(s: ts.Statement): boolean {
  const starts = (body: ts.Node | undefined) =>
    !!body && ts.isBlock(body) && body.statements.length > 0 && ts.isExpressionStatement(body.statements[0]) && ts.isStringLiteral(body.statements[0].expression) && body.statements[0].expression.text === "worklet";
  if (ts.isFunctionDeclaration(s)) return starts(s.body);
  if (ts.isVariableStatement(s))
    return s.declarationList.declarations.some((d) => !!d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) && starts(d.initializer.body));
  return false;
}

/** Names used by a top-level worklet that are only defined further down. */
function lateUses(path: string): string[] {
  const src = readFileSync(path, "utf8");
  const sf = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true, path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const owner = new Map<string, number>();
  sf.statements.forEach((s, i) => {
    if (ts.isFunctionDeclaration(s) && s.name) owner.set(s.name.text, i);
    if (ts.isVariableStatement(s)) s.declarationList.declarations.forEach((d) => ts.isIdentifier(d.name) && owner.set(d.name.text, i));
  });
  const out: string[] = [];
  sf.statements.forEach((s, i) => {
    // Only top-level worklets: other code runs later, once the file has loaded.
    if (!isWorklet(s)) return;
    const name = ts.isFunctionDeclaration(s) && s.name ? s.name.text : ts.isVariableStatement(s) ? s.declarationList.declarations.map((d) => d.name.getText()).join("/") : `line ${sf.getLineAndCharacterOfPosition(s.getStart()).line + 1}`;
    const visit = (node: ts.Node) => {
      if (ts.isTypeNode(node)) return;
      // A property name (spring.smooth, { smooth: 1 }) is not a use.
      if ((ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) || (ts.isPropertyAssignment(node.parent) && node.parent.name === node)) return;
      if (ts.isIdentifier(node) && (owner.get(node.text) ?? -1) > i) out.push(`${name} uses ${node.text}`);
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(s, visit);
  });
  return [...new Set(out)];
}

const worklets = files(ROOT).filter((p) => /["']worklet["']/.test(readFileSync(p, "utf8")));

describe("worklet files are in dependency order", () => {
  it("finds the drawing code", () => {
    expect(worklets.some((p) => p.endsWith(join("teach", "scene", "draw.ts")))).toBe(true);
  });
  for (const p of worklets) {
    it(relative(ROOT, p), () => {
      expect(lateUses(p)).toEqual([]);
    });
  }
});
