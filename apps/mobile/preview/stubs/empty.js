// Web preview only: stands in for phone-only modules.
const noop = () => {};
const handler = { get: (_, k) => (k === "__esModule" ? false : k === "default" ? proxy : typeof k === "symbol" ? undefined : proxy), apply: () => proxy, construct: () => proxy };
const proxy = new Proxy(noop, handler);
module.exports = proxy;
