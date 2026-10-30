'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

import type { SessionUser } from '@/lib/use-session';

export function AuthDialog({
  open,
  onClose,
  onAuthed,
}: {
  open: boolean;
  onClose: () => void;
  onAuthed: (user: SessionUser) => void;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const url = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json();

    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? 'Не получилось');
      return;
    }
    onAuthed(data.user);
    onClose();
    setEmail('');
    setPassword('');
    setName('');
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            aria-label="Закрыть"
            onClick={onClose}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
          />

          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 1.01 }}
            transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-[400px] rounded-[26px] bg-paper-lit p-7 shadow-[0_40px_90px_-40px_rgba(34,29,25,0.6)]"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-ink-soft transition hover:text-ink"
            >
              <X size={17} strokeWidth={1.6} />
            </button>

            <h2 className="serif text-[26px] leading-tight text-ink">
              {mode === 'login' ? 'Вход' : 'Создать аккаунт'}
            </h2>
            <p className="mt-2 text-[13px] text-ink-soft">
              Чтобы сохранять вина в избранное и видеть историю подборов.
            </p>

            <div className="mt-6 space-y-3">
              {mode === 'register' && (
                <label className="block">
                  <span className="text-[12px] text-ink-soft">Имя</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-paper px-4 py-3 text-[15px] text-ink outline-none focus:bg-[#efe9dd]"
                    placeholder="Как к вам обращаться"
                  />
                </label>
              )}

              <label className="block">
                <span className="text-[12px] text-ink-soft">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-paper px-4 py-3 text-[15px] text-ink outline-none focus:bg-[#efe9dd]"
                  placeholder="you@example.com"
                />
              </label>

              <label className="block">
                <span className="text-[12px] text-ink-soft">Пароль</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-paper px-4 py-3 text-[15px] text-ink outline-none focus:bg-[#efe9dd]"
                  placeholder="Не короче 6 символов"
                />
              </label>
            </div>

            {error && <p className="mt-3 text-[13px] text-[#8d2f2f]">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="mt-6 w-full rounded-full bg-ink py-3.5 text-[15px] font-medium text-paper-lit transition hover:bg-[#4e1f2b] disabled:opacity-50"
            >
              {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError(null);
              }}
              className="mt-3 w-full text-center text-[13px] text-ink-soft underline decoration-line underline-offset-4 transition hover:text-ink"
            >
              {mode === 'login' ? 'У меня нет аккаунта' : 'У меня уже есть аккаунт'}
            </button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
