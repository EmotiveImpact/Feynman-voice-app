// Web preview only: files kept in localStorage so a profile can be seeded.
const key = (p) => "fs:" + p;
export const Paths = { document: "doc", cache: "cache" };
export class File {
  constructor(...parts) { this.uri = parts.map((p) => (p && p.uri) || p).join("/"); this.name = String(parts[parts.length - 1]); }
  get exists() { return localStorage.getItem(key(this.uri)) != null; }
  textSync() { return localStorage.getItem(key(this.uri)) ?? ""; }
  async text() { return this.textSync(); }
  write(s) { try { localStorage.setItem(key(this.uri), typeof s === "string" ? s : ""); } catch {} }
  create() {}
  delete() { localStorage.removeItem(key(this.uri)); }
  copy() {} move() {}
  async base64() { return ""; }
  base64Sync() { return ""; }
  bytesSync() { return new Uint8Array(); }
  async bytes() { return new Uint8Array(); }
  get size() { return 0; }
}
export class Directory {
  constructor(...parts) { this.uri = parts.map((p) => (p && p.uri) || p).join("/"); }
  get exists() { return true; }
  create() {} delete() {} list() { return []; }
}
export default { File, Paths, Directory };
