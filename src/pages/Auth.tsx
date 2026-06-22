import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        toast.success('Добро пожаловать!');
      } else {
        await register(email, password, fullName);
        toast.success('Аккаунт создан!');
      }
      navigate('/');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-4">
            <Icon name="Sparkles" size={26} />
          </div>
          <h1 className="text-2xl font-bold">ЭК5 · Аналитика</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === 'login' ? 'Войдите в личный кабинет' : 'Создайте аккаунт для доступа'}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          {/* Переключатель */}
          <div className="mb-6 flex rounded-xl bg-muted p-1">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${mode === 'login' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              Войти
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${mode === 'register' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              Регистрация
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Имя</Label>
                <Input
                  id="fullName"
                  placeholder="Иван Иванов"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.ru"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                placeholder="Минимум 6 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full gap-2 mt-2" disabled={loading}>
              <Icon name={loading ? 'Loader2' : mode === 'login' ? 'LogIn' : 'UserPlus'} size={16}
                className={loading ? 'animate-spin' : ''} />
              {loading ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
            </Button>
          </form>

          {mode === 'register' && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Регистрируясь, вы соглашаетесь с условиями использования сервиса
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
