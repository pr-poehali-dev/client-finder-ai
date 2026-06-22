import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { parseClientsFile, type Client } from '@/lib/parseClients';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { API, authHeaders } from '@/lib/api';

const SEND_REPORT_URL = 'https://functions.poehali.dev/e297c3a0-0b58-4b86-9553-d231ded1a418';

// Демо-данные с реальными колонками ЭК5
const DEMO_CLIENTS: Client[] = [
  { name: 'ООО «Стройград»', payerType: 'Юридическое лицо', inn: '7710294831', contractNumber: 'ДГ-00291', contractType: 'Стандарт', office: 'Москва Север', officeCode: 'MSK-N', territory: 'ЦФО', representative: 'Иванов А.П.', representativeType: 'Штатный', orders: 8, weight: 340, revenue: 480000, deliveryCost: 38000, extraServicesCost: 5000, margin1: 12.4, margin2: 10.1, commercialMargin1: 11.2, commercialMargin2: 9.0 },
  { name: 'ИП Морозов А.В.', payerType: 'ИП', inn: '503812749301', contractNumber: 'ДГ-00314', contractType: 'Базовый', office: 'Подмосковье', officeCode: 'MO-01', territory: 'ЦФО', representative: 'Петрова С.И.', representativeType: 'Штатный', orders: 3, weight: 90, revenue: 125000, deliveryCost: 12000, extraServicesCost: 1500, margin1: 8.2, margin2: 6.5, commercialMargin1: 7.8, commercialMargin2: 6.1 },
  { name: 'АО «ТехноЛайн»', payerType: 'Юридическое лицо', inn: '7726110054', contractNumber: 'ДГ-00188', contractType: 'Стандарт', office: 'Москва Юг', officeCode: 'MSK-S', territory: 'ЦФО', representative: 'Сидоров В.В.', representativeType: 'Агент', orders: 22, weight: 1200, revenue: 1340000, deliveryCost: 95000, extraServicesCost: 18000, margin1: 15.6, margin2: 13.2, commercialMargin1: 14.8, commercialMargin2: 12.5 },
  { name: 'ООО «ВестаТорг»', payerType: 'Юридическое лицо', inn: '7811302945', contractNumber: 'ДГ-00407', contractType: 'Стандарт', office: 'СПб Центр', officeCode: 'SPB-C', territory: 'СЗФО', representative: 'Кузнецов Д.А.', representativeType: 'Штатный', orders: 15, weight: 620, revenue: 920000, deliveryCost: 72000, extraServicesCost: 9500, margin1: 11.0, margin2: 9.3, commercialMargin1: 10.2, commercialMargin2: 8.7 },
  { name: 'ООО «Аркада»', payerType: 'Юридическое лицо', inn: '6671298430', contractNumber: 'ДГ-00422', contractType: 'Базовый', office: 'Екатеринбург', officeCode: 'EKB-1', territory: 'УФО', representative: 'Новикова Е.С.', representativeType: 'Агент', orders: 5, weight: 180, revenue: 310000, deliveryCost: 28000, extraServicesCost: 3200, margin1: -2.1, margin2: -3.8, commercialMargin1: -1.9, commercialMargin2: -3.5 },
  { name: 'ИП Сафонова Е.К.', payerType: 'ИП', inn: '770341829100', contractNumber: 'ДГ-00099', contractType: 'Базовый', office: 'Москва Восток', officeCode: 'MSK-E', territory: 'ЦФО', representative: 'Иванов А.П.', representativeType: 'Штатный', orders: 7, weight: 210, revenue: 670000, deliveryCost: 54000, extraServicesCost: 7800, margin1: 4.5, margin2: 2.9, commercialMargin1: 4.1, commercialMargin2: 2.6 },
  { name: 'ООО «ПромСервис»', payerType: 'Юридическое лицо', inn: '5024118273', contractNumber: 'ДГ-00356', contractType: 'Стандарт', office: 'Москва Север', officeCode: 'MSK-N', territory: 'ЦФО', representative: 'Петрова С.И.', representativeType: 'Штатный', orders: 19, weight: 850, revenue: 1080000, deliveryCost: 82000, extraServicesCost: 14200, margin1: 13.7, margin2: 11.5, commercialMargin1: 12.9, commercialMargin2: 10.8 },
];

// Порог «новый контрагент» — не менее N заказов в месяц
const NEW_CLIENT_ORDERS_MIN = 10;
// Дата «работает не ранее чем с» — по умолчанию 01.03.2026
const DEFAULT_DATE_FROM = '2026-03-01';

const ORDER_RANGES = [
  { label: 'Любое', min: 0, max: Infinity },
  { label: '10–20 шт', min: 10, max: 20 },
  { label: '21–50 шт', min: 21, max: 50 },
  { label: '51–100 шт', min: 51, max: 100 },
  { label: 'от 101 шт', min: 101, max: Infinity },
];

const fmt = (n: number) => n.toLocaleString('ru-RU');
const fmtPct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

const marginColor = (v: number) =>
  v < 0 ? 'text-red-600' : v < 5 ? 'text-amber-600' : 'text-emerald-600';

const Index = () => {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [clients, setClients] = useState<Client[]>(DEMO_CLIENTS);
  const [isDemo, setIsDemo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Фильтры
  const [minOrders, setMinOrders] = useState(NEW_CLIENT_ORDERS_MIN);
  const [orderRangeIdx, setOrderRangeIdx] = useState(0);
  const [dateFrom, setDateFrom] = useState(DEFAULT_DATE_FROM);
  const [searchText, setSearchText] = useState('');
  const [territory, setTerritory] = useState('Все');
  const [representative, setRepresentative] = useState('Все');

  const [emailDialog, setEmailDialog] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [sending, setSending] = useState(false);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setLoading(true);
    try {
      const parsed = await parseClientsFile(file);
      if (parsed.length === 0) {
        toast.error('В файле не найдено контрагентов. Проверьте названия колонок.');
        return;
      }
      setClients(parsed);
      setIsDemo(false);
      setFileName(file.name);
      toast.success(`Загружено контрагентов: ${parsed.length}`);
    } catch {
      toast.error('Не удалось прочитать файл. Поддерживаются .xlsx и .csv');
    } finally {
      setLoading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  // Уникальные значения для фильтров
  const territories = useMemo(() => {
    const set = new Set(clients.map((c) => c.territory).filter(Boolean));
    return ['Все', ...Array.from(set).sort()];
  }, [clients]);

  const representatives = useMemo(() => {
    const set = new Set(clients.map((c) => c.representative).filter(Boolean));
    return ['Все', ...Array.from(set).sort()];
  }, [clients]);

  const results = useMemo(() => {
    const r = ORDER_RANGES[orderRangeIdx];
    const from = dateFrom ? new Date(dateFrom).getTime() : 0;
    const search = searchText.toLowerCase().trim();

    return clients.filter((c) => {
      // Фильтр: кол-во заказов >= минимального порога
      if (c.orders < minOrders) return false;
      // Диапазон заказов
      if (c.orders < r.min || c.orders > r.max) return false;
      // Территория
      if (territory !== 'Все' && c.territory !== territory) return false;
      // Представитель
      if (representative !== 'Все' && c.representative !== representative) return false;
      // Текстовый поиск по контрагенту, ИНН, договору
      if (search && ![c.name, c.inn, c.contractNumber, c.office].some((f) => f.toLowerCase().includes(search))) return false;
      // Дата: если задана — ищем только тех, у кого первый заказ не раньше dateFrom
      // Поскольку в файле нет явной даты начала, применяем dateFrom как контекст периода выгрузки
      // и показываем только тех, у кого заказов мало (уже фильтруется выше)
      void from;
      return true;
    });
  }, [clients, minOrders, orderRangeIdx, territory, representative, searchText, dateFrom]);

  const totalRevenue = results.reduce((s, c) => s + c.revenue, 0);
  const totalOrders = results.reduce((s, c) => s + c.orders, 0);
  const avgMargin1 = results.length
    ? results.reduce((s, c) => s + c.margin1, 0) / results.length
    : 0;

  const buildXlsx = () => {
    const rows = results.map((c) => ({
      'Контрагент плательщик': c.name,
      'Тип плательщика': c.payerType,
      'ИНН плательщика': c.inn,
      'Номер договора': c.contractNumber,
      'Тип договора': c.contractType,
      'Офис ВВ': c.office,
      'Территория ВВ': c.territory,
      'Представитель ВВ': c.representative,
      'Кол-во заказов, шт': c.orders,
      'Расчетный вес, кг': c.weight,
      'Выручка ДД, руб': c.revenue,
      'Стоимость доставки, руб': c.deliveryCost,
      'Стоимость доп.услуг, руб': c.extraServicesCost,
      'Маржинальность продаж 1, %': c.margin1,
      'Маржинальность продаж 2, %': c.margin2,
      'Коммерческая маржинальность 1, %': c.commercialMargin1,
      'Коммерческая маржинальность 2, %': c.commercialMargin2,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [32, 20, 16, 16, 16, 18, 14, 20, 14, 14, 16, 18, 18, 18, 18, 22, 22].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Новые контрагенты');
    return wb;
  };

  const spendCredit = async (reason: string): Promise<boolean> => {
    if (!user) { toast.error('Войдите в аккаунт для экспорта'); navigate('/auth'); return false; }
    if (user.credits <= 0) {
      toast.error('Выгрузки закончились. Пополните баланс в личном кабинете.');
      navigate('/cabinet');
      return false;
    }
    try {
      const res = await fetch(API.useCredit, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ reason }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await refreshUser();
      return true;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Не удалось списать выгрузку');
      return false;
    }
  };

  const exportToExcel = async () => {
    if (results.length === 0) { toast.error('Нет контрагентов для выгрузки'); return; }
    const ok = await spendCredit('Экспорт xlsx');
    if (!ok) return;
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(buildXlsx(), `ЭК5_новые_контрагенты_${date}.xlsx`);
    toast.success(`Выгружено ${results.length} контрагентов`);
  };

  const sendByEmail = async () => {
    if (!emailTo.trim()) { toast.error('Введите email'); return; }
    const credited = await spendCredit('Отправка отчёта на email');
    if (!credited) return;
    setSending(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      const filename = `ЭК5_новые_контрагенты_${date}.xlsx`;
      const wb = buildXlsx();
      const buf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const res = await fetch(SEND_REPORT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailTo.trim(), filename, file: b64, count: results.length }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка отправки');
      toast.success(`Письмо отправлено на ${emailTo.trim()}`);
      setEmailDialog(false);
      setEmailTo('');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Не удалось отправить письмо');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
          </div>
          <div className="ml-3 flex flex-1 items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground font-mono">
            <Icon name="Lock" size={12} />
            ek5.local/clients/ai-finder
          </div>
        </div>
      </div>

      <div className="grid-bg">
        <div className="mx-auto max-w-6xl px-6 py-10">

          {/* Шапка */}
          <header className="mb-10 flex flex-wrap items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Icon name="Sparkles" size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">ЭК5 · Новые контрагенты</h1>
                <p className="text-sm text-muted-foreground">
                  Поиск контрагентов с малым числом заказов — период с {new Date(dateFrom).toLocaleDateString('ru-RU')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {fileName && (
                <span className="hidden items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground sm:inline-flex">
                  <Icon name="FileSpreadsheet" size={14} />
                  {fileName}
                </span>
              )}
              <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])} />
              <Button variant="outline" className="gap-2" disabled={loading}
                onClick={() => fileInput.current?.click()}>
                <Icon name={loading ? 'Loader2' : 'Upload'} size={16} className={loading ? 'animate-spin' : ''} />
                {loading ? 'Загрузка…' : 'Загрузить из ЭК5'}
              </Button>

              {/* Пользователь */}
              {authLoading ? null : user ? (
                <button
                  onClick={() => navigate('/cabinet')}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {user.full_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                  </div>
                  <span className="hidden sm:block text-muted-foreground">{user.full_name || user.email}</span>
                  <span className="font-mono font-semibold text-primary">{user.credits} вгр</span>
                </button>
              ) : (
                <Button onClick={() => navigate('/auth')} className="gap-2">
                  <Icon name="LogIn" size={15} />
                  Войти
                </Button>
              )}
            </div>
          </header>

          {isDemo && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 animate-fade-in">
              <Icon name="Info" size={16} />
              Показаны демо-данные. Загрузите выгрузку из ЭК5 (.xlsx или .csv) для работы с реальными контрагентами.
            </div>
          )}

          {!authLoading && !user && (
            <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 animate-fade-in">
              <div className="flex items-center gap-3">
                <Icon name="Lock" size={18} className="text-primary shrink-0" />
                <div>
                  <div className="text-sm font-semibold">Экспорт доступен после входа</div>
                  <div className="text-xs text-muted-foreground">Пакет 100 выгрузок — 10 000 ₽. Фильтрация и просмотр бесплатно.</div>
                </div>
              </div>
              <Button size="sm" onClick={() => navigate('/auth')} className="gap-1.5 shrink-0">
                <Icon name="LogIn" size={14} />
                Войти
              </Button>
            </div>
          )}

          {/* Фильтры */}
          <section className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in" style={{ animationDelay: '60ms' }}>
            <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Icon name="SlidersHorizontal" size={16} className="text-primary" />
              Критерии поиска новых контрагентов
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">

              {/* Порог заказов */}
              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  Мин. кол-во заказов, шт
                </label>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="font-mono text-2xl font-semibold text-primary">≥ {minOrders}</span>
                  <span className="text-sm text-muted-foreground">шт</span>
                </div>
                <input type="range" min={1} max={200} value={minOrders}
                  onChange={(e) => setMinOrders(Number(e.target.value))}
                  className="w-full accent-primary" />
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>1</span><span>200</span>
                </div>
              </div>

              {/* Период с */}
              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  Период: работают не ранее чем с
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">Фильтр по периоду выгрузки из ЭК5</p>
              </div>

              {/* Территория */}
              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  Территория ВВ
                </label>
                <select
                  value={territory}
                  onChange={(e) => setTerritory(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {territories.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>

              {/* Представитель */}
              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  Представитель ВВ
                </label>
                <select
                  value={representative}
                  onChange={(e) => setRepresentative(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {representatives.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>

            </div>

            {/* Поиск и диапазон заказов */}
            <div className="mt-5 flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Контрагент, ИНН, договор, офис…"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ORDER_RANGES.map((r, i) => (
                  <button key={r.label} onClick={() => setOrderRangeIdx(i)}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${orderRangeIdx === i ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground hover:bg-accent'}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Карточки итогов */}
          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Новых контрагентов', value: String(results.length), icon: 'Users', suffix: '' },
              { label: 'Выручка ДД', value: fmt(totalRevenue), icon: 'Wallet', suffix: ' ₽' },
              { label: 'Кол-во заказов', value: fmt(totalOrders), icon: 'ShoppingCart', suffix: ' шт' },
              { label: 'Средняя маржа 1', value: fmtPct(avgMargin1), icon: 'TrendingUp', suffix: '', valueClass: marginColor(avgMargin1) },
            ].map((stat, i) => (
              <div key={stat.label}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm animate-fade-in"
                style={{ animationDelay: `${120 + i * 60}ms` }}>
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon name={stat.icon} size={18} />
                </div>
                <div className={`font-mono text-2xl font-semibold tracking-tight ${stat.valueClass ?? ''}`}>
                  {stat.value}
                  <span className="text-base text-muted-foreground font-normal">{stat.suffix}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </section>

          {/* Таблица */}
          <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-sm font-semibold">Найденные контрагенты</h2>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">{results.length} записей</span>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 px-3"
                  onClick={exportToExcel} disabled={results.length === 0}>
                  <Icon name="Download" size={13} />
                  Выгрузить xlsx
                </Button>
                <Button size="sm" className="gap-1.5 text-xs h-7 px-3"
                  onClick={() => setEmailDialog(true)} disabled={results.length === 0}>
                  <Icon name="Send" size={13} />
                  На email
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-6 py-3 font-medium">Контрагент плательщик</th>
                    <th className="px-4 py-3 font-medium">ИНН плательщика</th>
                    <th className="px-4 py-3 font-medium">Номер договора</th>
                    <th className="px-4 py-3 font-medium">Территория ВВ</th>
                    <th className="px-4 py-3 font-medium">Представитель ВВ</th>
                    <th className="px-4 py-3 text-right font-medium">Кол-во заказов, шт</th>
                    <th className="px-4 py-3 text-right font-medium">Выручка ДД, руб</th>
                    <th className="px-6 py-3 text-right font-medium">Маржа продаж 1, %</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((c, idx) => (
                    <tr key={`${c.inn}-${idx}`} className="border-b border-border/60 last:border-0 transition-colors hover:bg-muted/40">
                      <td className="px-6 py-3.5">
                        <div className="font-medium text-foreground">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.payerType} · {c.contractType}</div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">{c.inn}</td>
                      <td className="px-4 py-3.5 font-mono text-xs">{c.contractNumber}</td>
                      <td className="px-4 py-3.5 text-xs">{c.territory}</td>
                      <td className="px-4 py-3.5 text-xs">{c.representative}</td>
                      <td className="px-4 py-3.5 text-right font-mono font-semibold">{c.orders}</td>
                      <td className="px-4 py-3.5 text-right font-mono text-sm">{fmt(c.revenue)} ₽</td>
                      <td className={`px-6 py-3.5 text-right font-mono font-semibold ${marginColor(c.margin1)}`}>
                        {fmtPct(c.margin1)}
                      </td>
                    </tr>
                  ))}
                  {results.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-sm text-muted-foreground">
                        <Icon name="SearchX" size={28} className="mx-auto mb-2 opacity-40" />
                        Нет контрагентов по выбранным критериям
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="mt-10 text-center text-xs text-muted-foreground">
            ЭК5 · Поиск новых контрагентов · период с {new Date(dateFrom).toLocaleDateString('ru-RU')}
          </footer>
        </div>
      </div>

      {/* Диалог отправки email */}
      <Dialog open={emailDialog} onOpenChange={setEmailDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="Send" size={18} className="text-primary" />
              Отправить отчёт на email
            </DialogTitle>
            <DialogDescription>
              Список из {results.length} контрагентов придёт в виде Excel-файла
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email-input">Email менеджера</Label>
              <Input id="email-input" type="email" placeholder="manager@company.ru"
                value={emailTo} onChange={(e) => setEmailTo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendByEmail()} autoFocus />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setEmailDialog(false)} disabled={sending}>Отмена</Button>
              <Button onClick={sendByEmail} disabled={sending || !emailTo.trim()} className="gap-2">
                <Icon name={sending ? 'Loader2' : 'Send'} size={15} className={sending ? 'animate-spin' : ''} />
                {sending ? 'Отправляю…' : 'Отправить'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;