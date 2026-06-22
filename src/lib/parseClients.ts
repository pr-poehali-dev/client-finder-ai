import * as XLSX from 'xlsx';

export interface Client {
  name: string;
  payerType: string;
  inn: string;
  contractNumber: string;
  contractType: string;
  office: string;
  officeCode: string;
  territory: string;
  representative: string;
  representativeType: string;
  orders: number;
  weight: number;
  revenue: number;
  deliveryCost: number;
  extraServicesCost: number;
  margin1: number;
  margin2: number;
  commercialMargin1: number;
  commercialMargin2: number;
}

// Точное соответствие колонкам из файла ЭК5
const COLUMN_MAP: Record<string, string> = {
  name:               'Контрагент плательщик',
  payerType:          'Тип плательщика',
  inn:                'ИНН плательщика',
  contractNumber:     'Номер договора',
  contractType:       'Тип договора',
  office:             'Офис ВВ',
  officeCode:         'Код офиса ВВ',
  territory:          'Территория ВВ',
  representative:     'Представитель ВВ',
  representativeType: 'Тип представителя ВВ',
  orders:             'Кол-во заказов, шт',
  weight:             'Расчетный вес, кг',
  revenue:            'Выручка ДД, руб',
  deliveryCost:       'Стоимость доставки, руб',
  extraServicesCost:  'Стоимость доп.услуг, руб',
  margin1:            'Маржинальность продаж 1, %',
  margin2:            'Маржинальность продаж 2, %',
  commercialMargin1:  'Коммерческая маржинальность 1, %',
  commercialMargin2:  'Коммерческая маржинальность 2, %',
};

const parseNum = (v: unknown): number => {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const parseStr = (v: unknown): string => String(v ?? '').trim();

export async function parseClientsFile(file: File): Promise<Client[]> {
  const buffer = await file.arrayBuffer();
  const isCsv = file.name.toLowerCase().endsWith('.csv');
  const wb = isCsv
    ? XLSX.read(new TextDecoder('utf-8').decode(buffer), { type: 'string' })
    : XLSX.read(buffer, { type: 'array' });

  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (rows.length === 0) return [];

  // Нормализуем заголовки: убираем лишние пробелы
  const normalized = rows.map((row) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      clean[k.trim()] = v;
    }
    return clean;
  });

  return normalized
    .map((row) => {
      const g = (key: string) => row[COLUMN_MAP[key]];
      const name = parseStr(g('name'));
      if (!name) return null;
      return {
        name,
        payerType:          parseStr(g('payerType')),
        inn:                parseStr(g('inn')) || '—',
        contractNumber:     parseStr(g('contractNumber')),
        contractType:       parseStr(g('contractType')),
        office:             parseStr(g('office')),
        officeCode:         parseStr(g('officeCode')),
        territory:          parseStr(g('territory')),
        representative:     parseStr(g('representative')),
        representativeType: parseStr(g('representativeType')),
        orders:             parseNum(g('orders')),
        weight:             parseNum(g('weight')),
        revenue:            parseNum(g('revenue')),
        deliveryCost:       parseNum(g('deliveryCost')),
        extraServicesCost:  parseNum(g('extraServicesCost')),
        margin1:            parseNum(g('margin1')),
        margin2:            parseNum(g('margin2')),
        commercialMargin1:  parseNum(g('commercialMargin1')),
        commercialMargin2:  parseNum(g('commercialMargin2')),
      } as Client;
    })
    .filter((c): c is Client => c !== null);
}
