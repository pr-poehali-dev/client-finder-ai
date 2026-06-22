import * as XLSX from 'xlsx';

export type Status = 'Активный' | 'На паузе' | 'Новый';

export interface Client {
  id: string;
  name: string;
  inn: string;
  startDate: string;
  months: number;
  status: Status;
  ordersPerMonth: number;
  amount: number;
}

const COLUMN_ALIASES: Record<string, string[]> = {
  name: ['название', 'наименование', 'клиент', 'компания', 'организация'],
  inn: ['инн'],
  startDate: ['дата начала', 'начало работы', 'дата', 'начало'],
  status: ['статус'],
  amount: ['сумма контрактов', 'сумма', 'контракты', 'оборот'],
  ordersPerMonth: ['кол-во заказов', 'количество заказов', 'заказов в месяц', 'заказы'],
};

const normalize = (s: string) => String(s ?? '').toLowerCase().trim();

const matchKey = (header: string): string | null => {
  const h = normalize(header);
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some((a) => h.includes(a))) return key;
  }
  return null;
};

const parseAmount = (v: unknown): number => {
  if (typeof v === 'number') return v;
  const cleaned = String(v ?? '').replace(/[^\d.,-]/g, '').replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

const parseDateValue = (v: unknown): Date | null => {
  if (v instanceof Date) return v;
  if (typeof v === 'number') {
    const d = XLSX.SSF?.parse_date_code?.(v);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  const s = String(v ?? '').trim();
  const ru = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/);
  if (ru) {
    const year = ru[3].length === 2 ? 2000 + Number(ru[3]) : Number(ru[3]);
    return new Date(year, Number(ru[2]) - 1, Number(ru[1]));
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const monthsBetween = (start: Date, now = new Date()): number => {
  const m = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return Math.max(0, m);
};

const normalizeStatus = (v: unknown): Status => {
  const s = normalize(v);
  if (s.includes('пауз') || s.includes('заморож')) return 'На паузе';
  if (s.includes('нов')) return 'Новый';
  return 'Активный';
};

function rowsToClients(rows: Record<string, unknown>[], headerMap: Record<string, string>): Client[] {
  return rows
    .map((row, i) => {
      const get = (key: string) => {
        const col = headerMap[key];
        return col !== undefined ? row[col] : undefined;
      };
      const start = parseDateValue(get('startDate'));
      const name = String(get('name') ?? '').trim();
      if (!name) return null;
      return {
        id: `ЭК5-${String(i + 1).padStart(4, '0')}`,
        name,
        inn: String(get('inn') ?? '—').trim(),
        startDate: start ? start.toISOString().slice(0, 10) : '',
        months: start ? monthsBetween(start) : 0,
        status: normalizeStatus(get('status')),
        ordersPerMonth: Math.round(parseAmount(get('ordersPerMonth'))),
        amount: parseAmount(get('amount')),
      } as Client;
    })
    .filter((c): c is Client => c !== null);
}

function buildHeaderMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  headers.forEach((h) => {
    const key = matchKey(h);
    if (key && !map[key]) map[key] = h;
  });
  return map;
}

export async function parseClientsFile(file: File): Promise<Client[]> {
  const buffer = await file.arrayBuffer();
  const isCsv = file.name.toLowerCase().endsWith('.csv');
  const wb = isCsv
    ? XLSX.read(new TextDecoder('utf-8').decode(buffer), { type: 'string' })
    : XLSX.read(buffer, { type: 'array', cellDates: true });

  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (json.length === 0) return [];

  const headers = Object.keys(json[0]);
  const headerMap = buildHeaderMap(headers);
  return rowsToClients(json, headerMap);
}
