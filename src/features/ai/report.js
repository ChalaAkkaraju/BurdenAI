// report.js — turns an Ask conversation or an explanation into a print-ready
// report and opens the browser's "Save as PDF" dialog. Uses Aptos (installed
// with Microsoft 365) with Segoe UI / Calibri as fallbacks.

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const CSS = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Aptos, "Segoe UI", Calibri, Arial, sans-serif; color: #0f172a; font-size: 10pt; line-height: 1.5; margin: 0; background: #fff; }

  /* Repeating top/bottom space on every printed page (margin is 0 so the browser adds no header/footer). */
  table.frame { width: 100%; border-collapse: collapse; }
  table.frame > thead td { height: 12mm; padding: 0; }
  table.frame > tfoot td { height: 16mm; padding: 0; }
  table.frame > tbody > tr > td { padding: 0 15mm; }

  .band { background: #0f172a; color: #fff; padding: 9mm 15mm 8mm; display: flex; align-items: center; justify-content: space-between; }
  .brand { display: flex; align-items: center; gap: 11px; }
  .mark { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #fbbf24, #f97316); display: flex; align-items: center; justify-content: center; }
  .brand .name { font-size: 15pt; font-weight: 700; letter-spacing: -.01em; line-height: 1.1; }
  .brand .tag { font-size: 8.5pt; color: #cbd5e1; }
  .kind { text-align: right; }
  .kind .k { font-size: 8pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #fbbf24; }
  .kind .d { font-size: 8.5pt; color: #cbd5e1; margin-top: 2px; }

  h1 { font-size: 18pt; line-height: 1.25; margin: 8mm 0 1mm; letter-spacing: -.01em; }
  .subtitle { color: #475569; font-size: 10pt; margin: 0 0 5mm; }
  .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm 6mm; padding: 4mm 0; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; margin-bottom: 7mm; }
  .meta .l { font-size: 7.5pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #64748b; }
  .meta .v { font-size: 9.5pt; color: #0f172a; }

  .item { margin: 0 0 9mm; }
  .item + .item { border-top: 1px dashed #cbd5e1; padding-top: 7mm; }
  .qhead { display: flex; align-items: baseline; gap: 8px; margin: 0 0 1mm; break-after: avoid; }
  .qn { font-size: 8pt; font-weight: 700; color: #fff; background: #0f172a; border-radius: 5px; padding: 1px 6px; }
  .q { font-size: 12.5pt; font-weight: 700; margin: 0; }
  .route { font-size: 8.5pt; color: #64748b; margin: 0 0 3mm; }
  .route b { color: #b45309; font-weight: 600; }

  .label { font-size: 7.5pt; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #64748b; margin: 4mm 0 1.5mm; break-after: avoid; }
  .answer { background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 3.5mm 4.5mm; font-size: 11pt; line-height: 1.5; break-inside: avoid; }
  .answer p { margin: 0; }
  .answer p + p { margin-top: 2mm; }
  .point { margin: 0 0 2.5mm; }
  .point b { color: #0f172a; }
  ul.checks { margin: 0; padding-left: 5mm; }
  ul.checks li { margin: 0 0 1mm; }
  .note { background: #fff7ed; border-left: 4px solid #fb923c; border-radius: 4px; padding: 2.5mm 4mm; font-size: 9pt; color: #7c2d12; margin: 3mm 0; }

  .tcap { font-size: 9.5pt; font-weight: 600; color: #334155; margin: 0 0 1.5mm; }
  table.data { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 9pt; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
  table.data thead { display: table-header-group; }
  table.data th { background: #0f172a; color: #fff; font-weight: 600; text-align: right; padding: 2.2mm 2.4mm; white-space: nowrap; }
  table.data td { text-align: right; padding: 1.8mm 2.4mm; white-space: nowrap; border-top: 1px solid #eef2f6; font-variant-numeric: tabular-nums; }
  table.data tbody tr:nth-child(even) td { background: #f8fafc; }
  table.data tr { break-inside: avoid; }
  .how { font-size: 8.5pt; color: #64748b; margin: 2mm 0 0; }
  .how b { color: #475569; }

  .foot { position: fixed; bottom: 0; left: 0; right: 0; height: 12mm; padding: 0 15mm; display: flex; align-items: center; justify-content: space-between; gap: 8mm; font-size: 7.5pt; color: #64748b; border-top: 1px solid #e2e8f0; background: #fff; }
  .foot .brandline { font-weight: 700; color: #0f172a; }

  @media screen {
    body { background: #e2e8f0; }
    .sheet { max-width: 210mm; margin: 8mm auto 20mm; background: #fff; box-shadow: 0 10px 30px rgba(15,23,42,.15); }
    .foot { position: static; }
  }
  .tools { position: fixed; top: 12px; right: 16px; z-index: 5; }
  .tools button { font: inherit; font-size: 9.5pt; font-weight: 600; background: #f59e0b; color: #0f172a; border: 0; border-radius: 8px; padding: 8px 15px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,.2); }
  @media print { .tools { display: none; } }
`;

const SPARK = `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2z" fill="#fff"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" fill="#fff" opacity=".7"/></svg>`;

const NUMERIC = /^[−+\-]?[$€£¥₹]?\d|^range |^—$/;

function table(columns, rows, caption) {
  const num = columns.map((_, j) => rows.length > 0 && rows.every((r) => NUMERIC.test(String(r[j] ?? ""))));
  const al = (j) => (num[j] ? "" : ' style="text-align:left"');
  return `${caption ? `<p class="tcap">${esc(caption)}</p>` : ""}<table class="data"><thead><tr>${columns.map((c, j) => `<th${al(j)}>${esc(c)}</th>`).join("")}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.map((v, j) => `<td${al(j)}>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function page({ kind, title, subtitle, meta, body, print = true }) {
  const stamp = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>
  <div class="sheet">
  <div class="band">
    <div class="brand"><div class="mark">${SPARK}</div><div><div class="name">Burden AI</div><div class="tag">Burden cost &amp; rate platform</div></div></div>
    <div class="kind"><div class="k">${esc(kind)}</div><div class="d">${esc(stamp)}</div></div>
  </div>
  <table class="frame"><thead><tr><td></td></tr></thead><tfoot><tr><td></td></tr></tfoot><tbody><tr><td>
    <h1>${esc(title)}</h1>
    ${subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ""}
    <div class="meta">${meta.map(([k, v]) => `<div><div class="l">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join("")}</div>
    ${body}
  </td></tr></tbody></table>
  <div class="foot"><span><span class="brandline">Burden AI</span> · Figures come from Burden AI's own calculations; AI-written text is checked against them. Totals only — never employee names or pay.</span><span style="white-space:nowrap">${esc(stamp)}</span></div>
  </div>
  ${print ? `<script>window.addEventListener("load", () => setTimeout(() => window.print(), 300));</script>` : `<div class="tools"><button onclick="window.print()">Save as PDF</button></div>`}
  </body></html>`;
}

function openReport(html, features) {
  const w = window.open("", "_blank", features);
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}

export function askReport({ entries, user, scope, pageLabel, model, asOf, popOut = false }) {
  const done = entries.filter((e) => e.status === "done");
  const one = done.length === 1;
  const body = done.map((e, i) => `
    <section class="item">
      ${one ? "" : `<div class="qhead"><span class="qn">Q${i + 1}</span><h2 class="q">${esc(e.question)}</h2></div>`}
      <div class="route">${e.routedTo ? `Routed by the orchestrator to the <b>${esc(e.routedTo)}</b>` : `Answered by the <b>${esc(e.agentLabel || "assistant")}</b>`}</div>
      ${e.answer ? `<div class="label">Answer</div><div class="answer"><p>${esc(e.answer)}</p></div>` : ""}
      ${e.note ? `<div class="note">${esc(e.note)}</div>` : ""}
      ${e.result ? `<div class="label">The figures</div>${table(e.result.columns, e.result.rows, e.result.title)}` : ""}
      ${e.result?.how ? `<p class="how"><b>How this was produced:</b> ${esc(e.result.how)}</p>` : ""}
    </section>`).join("");
  return openReport(page({
    kind: one ? "Assistant answer" : "Assistant report",
    title: one ? done[0].question : "Questions and answers",
    subtitle: one ? null : `${done.length} questions asked of Ask Burden AI`,
    print: !popOut,
    meta: [["Prepared by", `${user?.name || ""} · ${user?.role || ""}`], ["Data scope", scope], ["Data as of", asOf], ["Asked from", pageLabel || "—"], ["Answers written by", model || "—"], ["Number check", done.every((e) => e.answer && !e.note) ? "Passed — every figure matches" : "Some answers shown as figures only"]],
    body,
  }), popOut ? "popup,width=920,height=960" : undefined);
}

export function explainReport({ subject, shown, aiWritten, model, table: rows, extraFacts, user }) {
  const body = `
    <section class="item">
      <div class="label">In short</div>
      <div class="answer"><p><b>${esc(shown.headline)}</b></p></div>
      <div class="label">Why</div>
      ${shown.points.map((p) => `<p class="point"><b>${esc(p.title)}</b> ${esc(p.text)}</p>`).join("")}
      <div class="label">What to check next</div>
      <ul class="checks">${shown.checks.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
      <div class="label">The figures (Burden AI calculation)</div>
      ${table(["Measure", "Plan", "Actual"], rows.map((r) => [r.label, r.plan, r.actual]))}
      ${(extraFacts || []).map((f) => `<p class="how">${esc(f)}</p>`).join("")}
    </section>`;
  return openReport(page({
    kind: "Variance explanation",
    title: subject.name,
    subtitle: `${subject.scope} · ${subject.periodLabel}`,
    meta: [["Prepared by", `${user?.name || ""} · ${user?.role || ""}`], ["Period", subject.periodLabel], ["Written by", aiWritten ? model : "Burden AI rules (no AI)"]],
    body,
  }));
}
