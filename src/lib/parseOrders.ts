import * as XLSX from 'xlsx';

export interface OrderRow {
  orderNumber: string;
  createdAt: string;
  status: string;
  deleted: string;
  sender: string;
  nonDeliveryReason: string;
  placeNumber: string;
  imOrderNumber: string;
  deliveryDate: string;
  cityFrom: string;
  cityTo: string;
}

export interface SenderSummary {
  sender: string;
  count: number;
  cities: string[];
  statuses: Record<string, number>;
  orders: OrderRow[];
}

const COLUMN_MAP: Record<keyof OrderRow, string> = {
  orderNumber:       'Номер заказа',
  createdAt:         'Дата создания заказа',
  status:            'Статуса заказа',
  deleted:           'Удаленный заказ',
  sender:            'Отправитель',
  nonDeliveryReason: 'Причина невручения',
  placeNumber:       'Номер места',
  imOrderNumber:     'Номер отправления ИМ',
  deliveryDate:      'Дата доставки',
  cityFrom:          'Город отправитель',
  cityTo:            'Город получателя',
};

const parseStr = (v: unknown): string => String(v ?? '').trim();

export async function parseOrdersFile(file: File): Promise<OrderRow[]> {
  const buffer = await file.arrayBuffer();
  const isCsv = file.name.toLowerCase().endsWith('.csv');
  const wb = isCsv
    ? XLSX.read(new TextDecoder('utf-8').decode(buffer), { type: 'string' })
    : XLSX.read(buffer, { type: 'array' });

  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (rows.length === 0) return [];

  const normalized = rows.map((row) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) clean[k.trim()] = v;
    return clean;
  });

  return normalized
    .map((row) => {
      const g = (key: keyof OrderRow) => row[COLUMN_MAP[key]];
      const sender = parseStr(g('sender'));
      if (!sender) return null;
      return {
        orderNumber:       parseStr(g('orderNumber')),
        createdAt:         parseStr(g('createdAt')),
        status:            parseStr(g('status')),
        deleted:           parseStr(g('deleted')),
        sender,
        nonDeliveryReason: parseStr(g('nonDeliveryReason')),
        placeNumber:       parseStr(g('placeNumber')),
        imOrderNumber:     parseStr(g('imOrderNumber')),
        deliveryDate:      parseStr(g('deliveryDate')),
        cityFrom:          parseStr(g('cityFrom')),
        cityTo:            parseStr(g('cityTo')),
      } as OrderRow;
    })
    .filter((r): r is OrderRow => r !== null);
}

export function buildSenderSummary(orders: OrderRow[], minOrders = 2): SenderSummary[] {
  const map = new Map<string, SenderSummary>();

  for (const o of orders) {
    if (!map.has(o.sender)) {
      map.set(o.sender, { sender: o.sender, count: 0, cities: [], statuses: {}, orders: [] });
    }
    const s = map.get(o.sender)!;
    s.count++;
    s.orders.push(o);
    if (o.cityTo && !s.cities.includes(o.cityTo)) s.cities.push(o.cityTo);
    s.statuses[o.status] = (s.statuses[o.status] || 0) + 1;
  }

  return Array.from(map.values())
    .filter((s) => s.count >= minOrders)
    .sort((a, b) => b.count - a.count);
}
