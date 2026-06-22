import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { API, authHeaders } from '@/lib/api';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

interface HistoryItem { delta: number; reason: string; created_at: string; }
interface Payment { amount: number; credits: number; status: string; created_at: string; }
interface ProfileData { user: { id: number; email: string; full_name: string; credits: number }; history: HistoryItem[]; payments: Payment[]; }

const statusLabel: Record<string, { label: string; cls: string }> = {
  succeeded: { label: 'Оплачен', cls: 'bg-emerald-50 text-emerald-700' },
  pending:   { label: 'Ожидает', cls: 'bg-amber-50 text-amber-700' },
  canceled:  { label: 'Отменён', cls: 'bg-red-50 text-red-700' },
};

const fmtDate = (s: string) => new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function Cabinet() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [payLoading, setPayLoading] = useState(false);
  const [pendingPayId, setPendingPayId] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    fetch(API.profile, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setProfile)
      .finally(() => setLoadingProfile(false));
  }, [user, navigate]);

  // Периодически проверяем статус платежа
  useEffect(() => {
    if (!pendingPayId) return;
    const iv = setInterval(async () => {
      const res = await fetch(API.pay, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'check', payment_id: pendingPayId }),
      });
      const data = await res.json();
      if (data.status === 'succeeded') {
        clearInterval(iv);
        setPendingPayId(null);
        toast.success(`Баланс пополнен на ${data.credits_added} выгрузок!`);
        await refreshUser();
        // Обновить профиль
        const r2 = await fetch(API.profile, { headers: authHeaders() });
        setProfile(await r2.json());
      }
    }, 4000);
    return () => clearInterval(iv);
  }, [pendingPayId, refreshUser]);

  const handlePay = async () => {
    setPayLoading(true);
    try {
      const res = await fetch(API.pay, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ action: 'create' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка создания платежа');
      setPendingPayId(data.payment_id);
      window.open(data.sbp_url, '_blank');
      toast.info('Откроется страница оплаты. После оплаты баланс обновится автоматически.');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setPayLoading(false);
    }
  };

  const credits = profile?.user?.credits ?? user?.credits ?? 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Шапка */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
            <Icon name="ChevronLeft" size={16} />
            Назад к поиску
          </button>
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { logout(); navigate('/auth'); }}>
            <Icon name="LogOut" size={14} />
            Выйти
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        {/* Карточка баланса */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Добрый день,</p>
              <h1 className="text-2xl font-bold">{user?.full_name || user?.email}</h1>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-5xl font-mono font-bold text-primary">{credits}</span>
                <span className="text-lg text-muted-foreground">выгрузок осталось</span>
              </div>
            </div>
            <div className="rounded-2xl bg-primary/5 border border-primary/20 p-6 min-w-[240px]">
              <div className="text-sm font-medium text-foreground mb-1">Пакет выгрузок</div>
              <div className="text-3xl font-bold text-foreground">100 шт</div>
              <div className="text-xl font-semibold text-muted-foreground mt-0.5">10 000 ₽</div>
              <Button
                className="w-full mt-4 gap-2"
                onClick={handlePay}
                disabled={payLoading || !!pendingPayId}
              >
                {pendingPayId ? (
                  <><Icon name="Loader2" size={16} className="animate-spin" /> Ожидаем оплату…</>
                ) : payLoading ? (
                  <><Icon name="Loader2" size={16} className="animate-spin" /> Создаём платёж…</>
                ) : (
                  <><Icon name="Smartphone" size={16} /> Оплатить через СБП</>
                )}
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">Оплата через ЮКассу · СБП</p>
            </div>
          </div>
        </div>

        {loadingProfile ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Icon name="Loader2" size={20} className="animate-spin" /> Загрузка…
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2">
            {/* История платежей */}
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border px-6 py-4">
                <h2 className="text-sm font-semibold">История платежей</h2>
              </div>
              {profile?.payments?.length ? (
                <div className="divide-y divide-border">
                  {profile.payments.map((p, i) => (
                    <div key={i} className="flex items-center justify-between px-6 py-3">
                      <div>
                        <div className="text-sm font-medium">+{p.credits} выгрузок</div>
                        <div className="text-xs text-muted-foreground">{fmtDate(p.created_at)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{Number(p.amount).toLocaleString('ru-RU')} ₽</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${(statusLabel[p.status] || { cls: 'bg-muted text-muted-foreground' }).cls}`}>
                          {(statusLabel[p.status] || { label: p.status }).label}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                  <Icon name="CreditCard" size={28} className="mx-auto mb-2 opacity-30" />
                  Платежей пока нет
                </div>
              )}
            </div>

            {/* История списаний */}
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="border-b border-border px-6 py-4">
                <h2 className="text-sm font-semibold">Использование выгрузок</h2>
              </div>
              {profile?.history?.length ? (
                <div className="divide-y divide-border max-h-72 overflow-y-auto">
                  {profile.history.map((h, i) => (
                    <div key={i} className="flex items-center justify-between px-6 py-3">
                      <div>
                        <div className="text-sm">{h.reason}</div>
                        <div className="text-xs text-muted-foreground">{fmtDate(h.created_at)}</div>
                      </div>
                      <span className={`font-mono text-sm font-semibold ${h.delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {h.delta > 0 ? '+' : ''}{h.delta}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                  <Icon name="History" size={28} className="mx-auto mb-2 opacity-30" />
                  Выгрузок ещё не было
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
