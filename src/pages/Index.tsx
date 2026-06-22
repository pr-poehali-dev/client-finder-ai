import { useState, useMemo, useRef } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { parseClientsFile, type Client, type Status } from '@/lib/parseClients';
import { toast } from 'sonner';

const DEMO_CLIENTS: Client[] = [
  { id: 'ЭК5-0291', name: 'ООО «Стройград»', inn: '7710294831', startDate: '2026-04-18', months: 2, status: 'Новый', ordersPerMonth: 12, amount: 480000 },
  { id: 'ЭК5-0314', name: 'ИП Морозов А.В.', inn: '503812749301', startDate: '2026-05-02', months: 1, status: 'Новый', ordersPerMonth: 4, amount: 125000 },
  { id: 'ЭК5-0188', name: 'АО «ТехноЛайн»', inn: '7726110054', startDate: '2026-03-28', months: 3, status: 'Активный', ordersPerMonth: 28, amount: 1340000 },
  { id: 'ЭК5-0407', name: 'ООО «ВестаТорг»', inn: '7811302945', startDate: '2026-04-09', months: 2, status: 'Активный', ordersPerMonth: 18, amount: 920000 },
  { id: 'ЭК5-0422', name: 'ООО «Аркада»', inn: '6671298430', startDate: '2026-05-21', months: 1, status: 'Новый', ordersPerMonth: 6, amount: 310000 },
  { id: 'ЭК5-0099', name: 'ИП Сафонова Е.К.', inn: '770341829100', startDate: '2026-03-15', months: 3, status: 'На паузе', ordersPerMonth: 9, amount: 670000 },
  { id: 'ЭК5-0356', name: 'ООО «ПромСервис»', inn: '5024118273', startDate: '2026-04-30', months: 1, status: 'Активный', ordersPerMonth: 22, amount: 1080000 },
];

const STATUS_FILTERS: (Status | 'Все')[] = ['Все', 'Новый', 'Активный', 'На паузе'];
const AMOUNT_RANGES = [
  { label: 'Любая', min: 0, max: Infinity },
  { label: 'до 500 тыс', min: 0, max: 500000 },
  { label: '500 тыс – 1 млн', min: 500000, max: 1000000 },
  { label: 'от 1 млн', min: 1000000, max: Infinity },
];

const statusColor: Record<Status, string> = {
  'Новый': 'bg-primary/10 text-primary',
  'Активный': 'bg-emerald-50 text-emerald-700',
  'На паузе': 'bg-amber-50 text-amber-700',
};

const fmt = (n: number) => n.toLocaleString('ru-RU');

const Index = () => {
  const [maxMonths, setMaxMonths] = useState(3);
  const [status, setStatus] = useState<Status | 'Все'>('Все');
  const [rangeIdx, setRangeIdx] = useState(0);
  const [scanned, setScanned] = useState(false);
  const [clients, setClients] = useState<Client[]>(DEMO_CLIENTS);
  const [isDemo, setIsDemo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setLoading(true);
    try {
      const parsed = await parseClientsFile(file);
      if (parsed.length === 0) {
        toast.error('В файле не найдено клиентов. Проверьте названия колонок.');
        return;
      }
      setClients(parsed);
      setIsDemo(false);
      setFileName(file.name);
      setScanned(true);
      toast.success(`Загружено клиентов: ${parsed.length}`);
    } catch {
      toast.error('Не удалось прочитать файл. Поддерживаются .xlsx и .csv');
    } finally {
      setLoading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const results = useMemo(() => {
    const r = AMOUNT_RANGES[rangeIdx];
    return clients.filter(
      (c) =>
        c.months <= maxMonths &&
        (status === 'Все' || c.status === status) &&
        c.amount >= r.min &&
        c.amount < r.max
    );
  }, [clients, maxMonths, status, rangeIdx]);

  const totalAmount = results.reduce((s, c) => s + c.amount, 0);
  const totalOrders = results.reduce((s, c) => s + c.ordersPerMonth, 0);
  const maxAmount = clients.length ? Math.max(...clients.map((c) => c.amount)) : 0;

  const byMonth = [1, 2, 3].map((m) => ({
    m,
    count: results.filter((c) => c.months === m).length,
  }));
  const maxCount = Math.max(1, ...byMonth.map((b) => b.count));
  const avgMonths = results.length
    ? (results.reduce((s, c) => s + c.months, 0) / results.length).toFixed(1)
    : '0';

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
          <header className="mb-10 flex flex-wrap items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Icon name="Sparkles" size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">ЭК5 · Поиск клиентов</h1>
                <p className="text-sm text-muted-foreground">
                  ИИ находит клиентов со стажем работы до 3 месяцев
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
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <Button
                variant="outline"
                className="gap-2"
                disabled={loading}
                onClick={() => fileInput.current?.click()}
              >
                <Icon name={loading ? 'Loader2' : 'Upload'} size={16} className={loading ? 'animate-spin' : ''} />
                {loading ? 'Загрузка…' : 'Загрузить из ЭК5'}
              </Button>
            </div>
          </header>

          {isDemo && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 animate-fade-in">
              <Icon name="Info" size={16} />
              Показаны демо-данные. Загрузите выгрузку из ЭК5 (.xlsx или .csv) для работы с реальными клиентами.
            </div>
          )}

          <section
            className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in"
            style={{ animationDelay: '60ms' }}
          >
            <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Icon name="SlidersHorizontal" size={16} className="text-primary" />
              Фильтры поиска
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  Стаж работы с компанией
                </label>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono-data text-2xl font-semibold text-primary">≤ {maxMonths}</span>
                  <span className="text-sm text-muted-foreground">мес.</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={3}
                  value={maxMonths}
                  onChange={(e) => setMaxMonths(Number(e.target.value))}
                  className="mt-2 w-full accent-primary"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  Статус клиента
                </label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_FILTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        status === s
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-muted-foreground">
                  Сумма контрактов
                </label>
                <div className="flex flex-wrap gap-2">
                  {AMOUNT_RANGES.map((r, i) => (
                    <button
                      key={r.label}
                      onClick={() => setRangeIdx(i)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        rangeIdx === i
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button onClick={() => setScanned(true)} className="mt-6 gap-2" size="lg">
              <Icon name="ScanSearch" size={18} />
              Запустить ИИ-поиск
            </Button>
          </section>

          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Найдено клиентов', value: String(results.length), icon: 'Users', suffix: '' },
              { label: 'Сумма контрактов', value: fmt(totalAmount), icon: 'Wallet', suffix: ' ₽' },
              { label: 'Заказов в месяц', value: String(totalOrders), icon: 'ShoppingCart', suffix: '' },
              { label: 'Средний стаж', value: avgMonths, icon: 'Clock', suffix: ' мес.' },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm animate-fade-in"
                style={{ animationDelay: `${120 + i * 60}ms` }}
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon name={stat.icon} size={18} />
                </div>
                <div className="font-mono-data text-2xl font-semibold tracking-tight">
                  {stat.value}
                  <span className="text-base text-muted-foreground">{stat.suffix}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </section>

          <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
            <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="text-sm font-semibold">Найденные клиенты</h2>
                <span className="font-mono-data text-xs text-muted-foreground">
                  {results.length} записей
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-6 py-3 font-medium">Клиент</th>
                      <th className="px-4 py-3 font-medium">Начало</th>
                      <th className="px-4 py-3 font-medium">Стаж</th>
                      <th className="px-4 py-3 font-medium">Заказов/мес</th>
                      <th className="px-4 py-3 font-medium">Статус</th>
                      <th className="px-6 py-3 text-right font-medium">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((c) => (
                      <tr key={c.id} className="border-b border-border/60 last:border-0 transition-colors hover:bg-muted/40">
                        <td className="px-6 py-3.5">
                          <div className="font-medium text-foreground">{c.name}</div>
                          <div className="font-mono-data text-xs text-muted-foreground">
                            {c.id} · ИНН {c.inn}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-mono-data text-xs text-muted-foreground">
                          {c.startDate ? new Date(c.startDate).toLocaleDateString('ru-RU') : '—'}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-mono-data text-sm font-medium">{c.months}</span>
                          <span className="text-xs text-muted-foreground"> мес</span>
                        </td>
                        <td className="px-4 py-3.5 font-mono-data text-sm font-medium">
                          {c.ordersPerMonth}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColor[c.status]}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono-data font-medium">
                          {fmt(c.amount)} ₽
                        </td>
                      </tr>
                    ))}
                    {results.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">
                          <Icon name="SearchX" size={28} className="mx-auto mb-2 opacity-40" />
                          Нет клиентов по выбранным фильтрам
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm h-fit">
              <h2 className="mb-1 text-sm font-semibold">Распределение по стажу</h2>
              <p className="mb-6 text-xs text-muted-foreground">кол-во клиентов по месяцам</p>
              <div className="flex items-end justify-around gap-3 h-40">
                {byMonth.map((b) => (
                  <div key={b.m} className="flex flex-1 flex-col items-center gap-2 h-full justify-end">
                    <span className="font-mono-data text-sm font-semibold text-foreground">{b.count}</span>
                    <div
                      className="w-full origin-bottom rounded-t-lg bg-primary animate-grow-bar"
                      style={{ height: `${(b.count / maxCount) * 100}%`, minHeight: '4px' }}
                    />
                    <span className="text-xs text-muted-foreground">{b.m} мес</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 border-t border-border pt-4">
                <div className="mb-2 text-xs text-muted-foreground">Макс. контракт в базе</div>
                <div className="font-mono-data text-lg font-semibold">{fmt(maxAmount)} ₽</div>
              </div>
            </section>
          </div>

          <footer className="mt-10 text-center text-xs text-muted-foreground">
            ЭК5 · ИИ-аналитика клиентской базы {scanned && '· поиск выполнен'}
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Index;