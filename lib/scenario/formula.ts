/** Evaluate a ledger formula over id → number values (prototype evalFormula). */
export function evalFormula(src: string, vals: Record<string, number>): number {
  const s = String(src);
  const toks =
    s.match(/[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[-+*/()]/g) || [];
  if (toks.join("") !== s.replace(/\s+/g, "")) {
    throw new Error(
      "uses characters other than ids, numbers and + - * / ( )",
    );
  }
  let i = 0;
  const peek = () => toks[i];
  const next = () => toks[i++];

  function expr(): number {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const o = next();
      const r = term();
      v = o === "+" ? v + r : v - r;
    }
    return v;
  }

  function term(): number {
    let v = fac();
    while (peek() === "*" || peek() === "/") {
      const o = next();
      const r = fac();
      v = o === "*" ? v * r : v / r;
    }
    return v;
  }

  function fac(): number {
    const t = next();
    if (t === "(") {
      const v = expr();
      if (next() !== ")") throw new Error("missing )");
      return v;
    }
    if (t === "-") return -fac();
    if (t === undefined) throw new Error("ends early");
    if (/^\d/.test(t)) return parseFloat(t);
    if (Object.prototype.hasOwnProperty.call(vals, t)) return vals[t]!;
    throw new Error("refers to unknown id " + t);
  }

  const v = expr();
  if (i < toks.length) throw new Error("has extra symbols");
  return v;
}
