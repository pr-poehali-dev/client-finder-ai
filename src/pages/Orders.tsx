import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { parseOrdersFile, buildSenderSummary, type OrderRow } from '@/lib/parseOrders';
import { useClients } from '@/context/ClientsContext';

const fmt = (n: number) => n.toLocaleString('ru-RU');

const STATUS_COLORS: Record<string, string> = {
  'Доставлен':  'bg-emerald-50 text-emerald-700',
  'Вручен':     'bg-emerald-50 text-emerald-700',
  'Не вручен':  'bg-red-50 text-red-700',
  'В пути':     'bg-blue-50 text-blue-700',
  'Отменен':    'bg-gray-100 text-gray-500',
};

// Нормализация имени для нечёткого сравнения
const normName = (s: string) =>
  s.toLowerCase().replace(/[«»"'.,\-_]/g, '').replace(/\s+/g, ' ').trim();

export default function Orders() {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const { clients, isDemo } = useClients();

  const [allOrders, setAllOrders] = useState<OrderRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [minOrders, setMinOrders] = useState(2);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Все');
  const [inBaseFilter, setInBaseFilter] = useState<'all' | 'in' | 'out'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setLoading(true);
    try {
      const rows = await parseOrdersFile(file);
      if (rows.length === 0) { toast.error('Не удалось прочитать файл — проверьте заголовки'); return; }
      setAllOrders(rows);
      setFileName(file.name);
      toast.success(`Загружено ${fmt(rows.length)} накладных`);
    } catch {
      toast.error('Ошибка чтения файла');
    } finally {
      setLoading(false);
    }
  };

  // Множество нормализованных имён контрагентов для быстрого поиска
  const clientNamesSet = useMemo(() => {
    if (isDemo || clients.length === 0) return new Set<string>();
    return new Set(clients.map((c) => normName(c.name)));
  }, [clients, isDemo]);

  const hasClientBase = !isDemo && clients.length > 0;

  const isInBase = (sender: string) => clientNamesSet.has(normName(sender));

  // Уникальные статусы
  const allStatuses = useMemo(() => {
    const s = new Set(allOrders.map((o) => o.status).filter(Boolean));
    return ['Все', ...Array.from(s)];
  }, [allOrders]);

  // Фильтрованные заказы по статусу
  const filteredOrders = useMemo(() => {
    if (statusFilter === 'Все') return allOrders;
    return allOrders.filter((o) => o.status === statusFilter);
  }, [allOrders, statusFilter]);

  // Сводка по отправителям + фильтры
  const senders = useMemo(() => {
    const result = buildSenderSummary(filteredOrders, minOrders);
    return result.filter((s) => {
      if (search.trim() && !s.sender.toLowerCase().includes(search.toLowerCase())) return false;
      if (inBaseFilter === 'in' && !isInBase(s.sender)) return false;
      if (inBaseFilter === 'out' && isInBase(s.sender)) return false;
      return true;
    });
  }, [filteredOrders, minOrders, search, inBaseFilter, clientNamesSet]);

  const inBaseCount = useMemo(() => senders.filter((s) => isInBase(s.sender)).length, [senders, clientNamesSet]);
  const totalOrders = senders.reduce((s, r) => s + r.count, 0);

  const exportXlsx = () => {
    if (!senders.length) { toast.error('Нет данных для выгрузки'); return; }
    const rows = senders.map((s) => ({
      'Отправитель': s.sender,
      'В базе контрагентов': isInBase(s.sender) ? 'Да' : 'Нет',
      'Кол-во заказов': s.count,
      'Города получателей': s.cities.join(', '),
      'Статусы': Object.entries(s.statuses).map(([k, v]) => `${k}: ${v}`).join('; '),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [40, 18, 16, 40, 50].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Отправители');
    XLSX.writeFile(wb, `накладные_отправители_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Файл скачан');
  };

  const toggleExpand = (sender: string) => setExpanded(expanded === sender ? null : sender);
  const isEmpty = allOrders.length === 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Браузерная шапка */}
      <div className="border-b border-border bg-card">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
          </div>
          <div className="ml-3 flex flex-1 items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground font-mono">
            <Icon name="Lock" size={12} />
            ek5.local/orders/analysis
          </div>
        </div>
      </div>

      <div className="grid-bg">
        <div className="mx-auto max-w-6xl px-6 py-10">

          {/* Заголовок */}
          <header className="mb-10 flex flex-wrap items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card hover:bg-accent transition-colors">
                <Icon name="ChevronLeft" size={18} />
              </button>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Icon name="PackageSearch" size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">ЭК5 · Анализ накладных</h1>
                <p className="text-sm text-muted-foreground">Отправители с двумя и более заказами</p>
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
              <Button variant="outline" className="gap-2" disabled={loading} onClick={() => fileInput.current?.click()}>
                <Icon name={loading ? 'Loader2' : 'Upload'} size={16} className={loading ? 'animate-spin' : ''} />
                {loading ? 'Загрузка…' : 'Загрузить накладные'}
              </Button>
              {!isEmpty && (
                <Button className="gap-2" onClick={exportXlsx}>
                  <Icon name="Download" size={16} />
                  Выгрузить xlsx
                </Button>
              )}
            </div>
          </header>

          {/* Баннер: база контрагентов не загружена */}
          {!hasClientBase && !isEmpty && (
            <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 animate-fade-in">
              <div className="flex items-center gap-3">
                <Icon name="Info" size={18} className="text-amber-600 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-amber-900">База контрагентов не загружена</div>
                  <div className="text-xs text-amber-700">Загрузите файл контрагентов на главной странице, чтобы видеть совпадения с отправителями</div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100" onClick={() => navigate('/')}>
                <Icon name="ArrowLeft" size={14} />
                На главную
              </Button>
            </div>
          )}

          {/* Статистика по совпадениям */}
          {hasClientBase && !isEmpty && (
            <div className="mb-6 flex flex-wrap gap-3 animate-fade-in">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">В базе контрагентов:</span>
                <span className="font-semibold text-emerald-700">{inBaseCount}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm">
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground" />
                <span className="text-muted-foreground">Нет в базе:</span>
                <span className="font-semibold">{senders.length - inBaseCount}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
                <Icon name="Users" size={14} />
                База: {fmt(clients.length)} контрагентов
              </div>
            </div>
          )}

          {/* Заглушка если файл не загружен */}
          {isEmpty ? (
            <div
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card py-24 text-center cursor-pointer hover:border-primary/40 hover:bg-accent/30 transition-colors animate-fade-in"
              onClick={() => fileInput.current?.click()}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                <Icon name="PackageSearch" size={30} className="text-muted-foreground" />
              </div>
              <div className="text-lg font-semibold mb-1">Загрузите файл накладных из ЭК5</div>
              <div className="text-sm text-muted-foreground max-w-xs">
                Поддерживаются .xlsx, .xls и .csv — система автоматически найдёт отправителей с повторными заказами
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                {['Номер заказа', 'Отправитель', 'Статус заказа', 'Город получателя'].map((col) => (
                  <span key={col} className="rounded-full bg-muted px-3 py-1">{col}</span>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Фильтры */}
              <section className="mb-6 rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in">
                <div className="grid gap-6 md:grid-cols-4">
                  {/* Мин. заказов */}
                  <div>
                    <label className="mb-2 block text-xs font-medium text-muted-foreground">Мин. кол-во заказов</label>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="font-mono text-2xl font-semibold text-primary">≥ {minOrders}</span>
                      <span className="text-sm text-muted-foreground">шт</span>
                    </div>
                    <input type="range" min={1} max={50} value={minOrders}
                      onChange={(e) => setMinOrders(Number(e.target.value))}
                      className="w-full accent-primary" />
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                      <span>1</span><span>50</span>
                    </div>
                  </div>

                  {/* Статус */}
                  <div>
                    <label className="mb-2 block text-xs font-medium text-muted-foreground">Статус заказа</label>
                    <div className="flex flex-wrap gap-1.5">
                      {allStatuses.map((s) => (
                        <button key={s} onClick={() => setStatusFilter(s)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* В базе */}
                  {hasClientBase && (
                    <div>
                      <label className="mb-2 block text-xs font-medium text-muted-foreground">В базе контрагентов</label>
                      <div className="flex flex-wrap gap-1.5">
                        {(['all', 'in', 'out'] as const).map((v) => (
                          <button key={v} onClick={() => setInBaseFilter(v)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${inBaseFilter === v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                            {v === 'all' ? 'Все' : v === 'in' ? 'Есть в базе' : 'Нет в базе'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Поиск */}
                  <div>
                    <label className="mb-2 block text-xs font-medium text-muted-foreground">Поиск по отправителю</label>
                    <div className="relative">
                      <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input placeholder="Введите название…" value={search}
                        onChange={(e) => setSearch(e.target.value)} className="pl-8" />
                    </div>
                  </div>
                </div>
              </section>

              {/* Итого */}
              <div className="mb-4 flex flex-wrap items-center gap-6 animate-fade-in">
                <div className="text-sm text-muted-foreground">
                  Найдено <span className="font-semibold text-foreground">{fmt(senders.length)}</span> отправителей
                  · <span className="font-semibold text-foreground">{fmt(totalOrders)}</span> заказов
                </div>
              </div>

              {/* Таблица */}
              {senders.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-16 text-center animate-fade-in">
                  <Icon name="SearchX" size={32} className="text-muted-foreground mb-3" />
                  <div className="font-medium">Нет отправителей по заданным критериям</div>
                  <div className="text-sm text-muted-foreground mt-1">Уменьшите минимальное число заказов или смените фильтр</div>
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden animate-fade-in">
                  {/* Шапка */}
                  <div className={`grid gap-4 border-b border-border bg-muted/40 px-5 py-3 text-xs font-medium text-muted-foreground ${hasClientBase ? 'grid-cols-[2fr_90px_80px_1fr_1fr]' : 'grid-cols-[2fr_80px_1fr_1fr]'}`}>
                    <span>Отправитель</span>
                    {hasClientBase && <span className="text-center">В базе</span>}
                    <span className="text-center">Заказов</span>
                    <span>Города получателей</span>
                    <span>Статусы</span>
                  </div>

                  {senders.map((s) => {
                    const inBase = isInBase(s.sender);
                    return (
                      <div key={s.sender} className="border-b border-border last:border-0">
                        <button
                          onClick={() => toggleExpand(s.sender)}
                          className={`grid gap-4 w-full px-5 py-3.5 text-left hover:bg-accent/40 transition-colors items-start ${hasClientBase ? 'grid-cols-[2fr_90px_80px_1fr_1fr]' : 'grid-cols-[2fr_80px_1fr_1fr]'}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon name={expanded === s.sender ? 'ChevronDown' : 'ChevronRight'} size={14} className="text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium truncate">{s.sender}</span>
                          </div>
                          {hasClientBase && (
                            <div className="flex justify-center">
                              {inBase ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                  <Icon name="Check" size={11} />Есть
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                  <Icon name="Minus" size={11} />Нет
                                </span>
                              )}
                            </div>
                          )}
                          <div className="text-center">
                            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold px-1.5">
                              {s.count}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {s.cities.slice(0, 3).join(', ')}{s.cities.length > 3 ? ` +${s.cities.length - 3}` : ''}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(s.statuses).slice(0, 2).map(([status, cnt]) => (
                              <span key={status} className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-muted text-muted-foreground'}`}>
                                {status} {cnt > 1 ? `(${cnt})` : ''}
                              </span>
                            ))}
                          </div>
                        </button>

                        {/* Раскрытые заказы */}
                        {expanded === s.sender && (
                          <div className="border-t border-border/60 bg-muted/20 px-5 pb-3 pt-2">
                            {hasClientBase && (
                              <div className={`mb-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${inBase ? 'bg-emerald-50 text-emerald-800' : 'bg-muted text-muted-foreground'}`}>
                                <Icon name={inBase ? 'CheckCircle' : 'XCircle'} size={13} />
                                {inBase ? 'Контрагент найден в базе ЭК5' : 'Контрагент не найден в базе ЭК5'}
                              </div>
                            )}
                            <div className="text-xs font-medium text-muted-foreground mb-2 mt-1">Список заказов</div>
                            <div className="space-y-1.5 max-h-64 overflow-y-auto">
                              {s.orders.map((o, i) => (
                                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-3 rounded-lg bg-card px-3 py-2 text-xs border border-border/60">
                                  <span className="font-mono text-foreground">{o.orderNumber || '—'}</span>
                                  <span className="text-muted-foreground">{o.createdAt || '—'}</span>
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[o.status] ?? 'bg-muted text-muted-foreground'}`}>
                                    {o.status || '—'}
                                  </span>
                                  <span className="text-muted-foreground">{o.cityTo || '—'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
