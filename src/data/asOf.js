// asOf.js
// The sample data always runs up to the LAST COMPLETED MONTH, so demos look
// current without anyone regenerating data. On 27 Oct 2026 the data runs to
// 2026-09; from 1 Nov 2026 it runs to 2026-10, and so on.
//
// Earlier months never change when a new month is added: the generator walks
// periods oldest-first, so new months only append.

export function lastCompletedPeriod(today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-based current month = 1-based previous month
  return m === 0 ? `${y - 1}-12` : `${y}-${String(m).padStart(2, '0')}`;
}

export const DATA_AS_OF = lastCompletedPeriod();

const [AS_OF_YEAR, AS_OF_MONTH] = DATA_AS_OF.split('-').map(Number);
export { AS_OF_YEAR, AS_OF_MONTH };

// A Date `offsetDays` from the 1st of the month after DATA_AS_OF — i.e. "now"
// in the sample data's world (month-end close has just finished).
export function asOfDate(offsetDays = 0, hour = 9, minute = 0) {
  return new Date(Date.UTC(AS_OF_YEAR, AS_OF_MONTH, 1 + offsetDays, hour, minute));
}

export const isoDay = (d) => d.toISOString().slice(0, 10);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// "September 2026" for DATA_AS_OF shifted back `back` months.
export function asOfMonthName(back = 0) {
  const d = new Date(Date.UTC(AS_OF_YEAR, AS_OF_MONTH - 1 - back, 1));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Calendar quarter label of DATA_AS_OF, e.g. "Q3 2026".
export function asOfQuarter() {
  return `Q${Math.ceil(AS_OF_MONTH / 3)} ${AS_OF_YEAR}`;
}

// Fiscal year (Apr–Mar, named by the year it ends) of DATA_AS_OF, e.g. "FY2027".
export function asOfFiscalYear() {
  return `FY${AS_OF_MONTH >= 4 ? AS_OF_YEAR + 1 : AS_OF_YEAR}`;
}
