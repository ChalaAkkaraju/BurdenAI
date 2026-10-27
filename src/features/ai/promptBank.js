// promptBank.js — suggested questions for Ask Burden AI, grouped by area.
// The area for the page you are on comes first. Each area maps to an agent.

export const AREAS = [
  {
    id: "utilization",
    label: "Utilization & absorption",
    agent: "utilization",
    prompts: (c) => [
      "Which cost centers are most under-absorbed this year, and why?",
      "Which cost centers are furthest below their utilization target?",
      c.country && `How is ${c.country} doing against plan this year?`,
      "Which cost centers have the biggest cost variance against plan?",
      "Which cost centers are beating their utilization target?",
      c.department && `How is ${c.department} doing against plan this year?`,
      c.country2 && `How is ${c.country2} doing against plan this year?`,
      "Which cost centers have the highest burden rate this year?",
    ],
  },
  {
    id: "burden",
    label: "Burden cost",
    agent: "burden",
    prompts: (c) => [
      "How has burden cost changed over the last 12 months?",
      "Burden cost by country this month — which grew most vs last year?",
      c.country && `How has the burden rate moved in ${c.country} over the last 24 months?`,
      "Which country has the highest burden rate this month?",
      c.country2 && `How has burden cost changed in ${c.country2} over the last 12 months?`,
      "How has headcount moved over the last 12 months?",
    ],
  },
  {
    id: "forecast",
    label: "Forecast",
    agent: "forecast",
    needsForecast: true,
    prompts: () => [
      "What does next year's forecast look like across the scenarios?",
      "How far apart are the Base scenario and the learned forecast?",
      "What is the range of the learned forecast for next year?",
      "Which scenario forecasts the highest burden cost next year?",
    ],
  },
  {
    id: "anomalies",
    label: "Anomalies",
    agent: "anomalies",
    prompts: (c) => [
      "Anything unusual this month?",
      "Which cost centers have unfavourable anomalies this month?",
      c.country && `Is anything unusual in ${c.country} this month?`,
      "Are there unusual utilization moves this month?",
    ],
  },
];

// Which area each page puts first.
const PAGE_AREA = {
  planvsactual: "utilization",
  dashboard: "utilization",
  burdencost: "burden",
  reports: "burden",
  roster: "burden",
  rawdata: "burden",
  import: "burden",
  benefits: "burden",
  allocation: "burden",
  calculations: "burden",
  forecast: "forecast",
};

// Areas in display order for this page, each with its full prompt list.
export function areasFor(page, ctx, hasForecast) {
  const first = PAGE_AREA[page] || "utilization";
  const fill = {
    country: ctx.countries[0]?.name,
    country2: ctx.countries[1]?.name,
    department: ctx.departments.find((d) => /engineering|logistics/i.test(d)) || ctx.departments[0],
  };
  return AREAS
    .filter((a) => !a.needsForecast || hasForecast)
    .map((a) => ({ ...a, list: a.prompts(fill).filter(Boolean) }))
    .sort((a, b) => (a.id === first ? -1 : b.id === first ? 1 : 0));
}

// The prompts to show for "round" n: the first area gets 3, the next two get 1 each.
export function pickPrompts(areas, round) {
  return areas.slice(0, 3).map((a, i) => {
    const count = i === 0 ? 3 : 1;
    const out = [];
    for (let k = 0; k < count; k++) out.push(a.list[(round * count + k) % a.list.length]);
    return { ...a, shown: [...new Set(out)] };
  });
}
