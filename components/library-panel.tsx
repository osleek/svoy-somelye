'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Heart, History, MessageSquare, SlidersHorizontal, X } from 'lucide-react';
import { AXIS_LABELS, DEFAULT_TASTE, type TasteAxes } from '@/lib/taste';

import type { RankedWine } from '@/lib/catalog/types';

type Tab = 'favorites' | 'history' | 'chats' | 'taste';
type ConversationRow = { id: string; title: string; updatedAt: string; count: number };
type HistoryRow = { slug: string; query: string; createdAt: string };

export function LibraryPanel({
  open,
  initialTab,
  onClose,
  onOpenWine,
  onOpenConversation,
}: {
  open: boolean;
  initialTab?: Tab;
  onClose: () => void;
  onOpenWine: (wine: RankedWine) => void;
  onOpenConversation: (id: string) => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab ?? 'favorites');

  useEffect(() => {
    if (open) setTab(initialTab ?? 'favorites');
  }, [open, initialTab]);
  const [wines, setWines] = useState<Record<string, RankedWine>>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [taste, setTaste] = useState<TasteAxes>(DEFAULT_TASTE);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);

    Promise.all([
      fetch('/api/favorites').then((r) => r.json()),
      fetch('/api/history').then((r) => r.json()),
      fetch('/api/conversations').then((r) => r.json()),
    ])
      .then(async ([fav, hist, chats]: [{ favorites: string[] }, { history: HistoryRow[] }, { conversations: ConversationRow[] }]) => {
        if (!alive) return;
        setFavorites(fav.favorites ?? []);
        setHistory(hist.history ?? []);
        setConversations(chats.conversations ?? []);

        const slugs = [...new Set([...(fav.favorites ?? []), ...(hist.history ?? []).map((h) => h.slug)])];
        if (slugs.length) {
          const data = await fetch(`/api/wines/lookup?slugs=${encodeURIComponent(slugs.join(','))}`).then((r) =>
            r.json(),
          );
          const map: Record<string, RankedWine> = {};
          for (const wine of data.wines ?? []) map[wine.slug] = wine;
          if (alive) setWines(map);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data: { taste: TasteAxes | null }) => {
        if (data.taste) setTaste(data.taste);
      })
      .catch(() => {});
  }, [open]);

  async function saveTaste() {
    setSaving(true);
    setSaved(false);
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taste),
    }).catch(() => null);
    setSaving(false);
    if (res?.ok) setSaved(true);
  }

  const rows = tab === 'favorites' ? favorites.map((slug) => ({ slug, label: '' })) : history;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[55]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.button
            type="button"
            aria-label="Закрыть"
            onClick={onClose}
            className="absolute inset-0 hidden bg-ink/35 backdrop-blur-[2px] lg:block"
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="absolute right-0 top-0 flex h-full w-full flex-col overflow-x-hidden bg-paper-lit lg:max-w-[420px] lg:border-l lg:border-line"
          >
            <header className="flex items-center justify-between px-6 pt-6">
              <h2 className="serif text-[24px] text-ink">Кабинет</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть"
                className="grid h-10 w-10 place-items-center rounded-full text-ink-soft transition hover:text-ink"
              >
                <X size={18} strokeWidth={1.6} />
              </button>
            </header>

            <div className="mt-5 flex items-center justify-between gap-0.5 px-5 pb-1">
              {(
                [
                  ['favorites', 'Избранное', Heart],
                  ['history', 'История', History],
                  ['chats', 'Чаты', MessageSquare],
                  ['taste', 'Вкус', SlidersHorizontal],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2.5 py-2 text-[11.5px] transition ${
                    tab === key ? 'bg-ink text-paper-lit' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  <Icon size={12} strokeWidth={1.8} />
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex-1 overflow-y-auto px-6 pb-10">
              <div key={tab} className="anim-in">
              {loading && <p className="text-[13px] text-ink-soft">Загружаю…</p>}

              {!loading && (tab === 'favorites' || tab === 'history') && rows.length === 0 && (
                <p className="mt-6 text-[14px] leading-relaxed text-ink-soft">
                  {tab === 'favorites'
                    ? 'Пока пусто. Откройте вино и нажмите на сердечко — оно появится здесь.'
                    : 'Здесь появятся ваши подборы.'}
                </p>
              )}

              {tab === 'taste' && (
                <div className="space-y-6 pt-1">
                  <p className="text-[13px] leading-relaxed text-ink-soft">
                    Отметьте, какое вино вам ближе. Профиль подмешивается в подбор: совпавшие вина поднимаются выше.
                  </p>

                  {AXIS_LABELS.map((axis) => (
                    <label key={axis.key} className="block">
                      <span className="flex items-baseline justify-between">
                        <span className="text-[13px] text-ink">{axis.label}</span>
                        <span className="text-[12px] text-ink-soft">{taste[axis.key]}</span>
                      </span>
                      <input
                        type="range"
                        min={1}
                        max={5}
                        step={1}
                        value={taste[axis.key]}
                        onChange={(event) =>
                          setTaste((prev) => ({ ...prev, [axis.key]: Number(event.target.value) }))
                        }
                        className="taste-range mt-2 w-full"
                      />
                      <span className="mt-1 flex justify-between text-[11px] text-ink-soft/70">
                        <span>{axis.left}</span>
                        <span>{axis.right}</span>
                      </span>
                    </label>
                  ))}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={saveTaste}
                      disabled={saving}
                      className="rounded-full bg-ink px-5 py-2.5 text-[13px] text-paper-lit transition hover:bg-[#4e1f2b] disabled:opacity-50"
                    >
                      {saving ? 'Сохраняю…' : 'Сохранить профиль'}
                    </button>
                    {saved && <span className="text-[12px] text-[#3d6b58]">учтётся в подборе</span>}
                  </div>
                </div>
              )}

              {tab === 'chats' && (
                <div className="space-y-2">
                  {conversations.length === 0 && (
                    <p className="mt-6 text-[14px] leading-relaxed text-ink-soft">
                      Пока нет сохранённых диалогов.
                    </p>
                  )}
                  {conversations.map((chat) => (
                    <button
                      key={chat.id}
                      type="button"
                      onClick={() => {
                        onOpenConversation(chat.id);
                        onClose();
                      }}
                      className="anim-in flex w-full items-center justify-between gap-3 rounded-2xl bg-paper px-4 py-3 text-left transition hover:bg-line/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] text-ink">{chat.title}</span>
                        <span className="block text-[11.5px] text-ink-soft">
                          {new Date(chat.updatedAt).toLocaleString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {' · '}
                          {chat.count} сообщ.
                        </span>
                      </span>
                      <ArrowRight size={14} strokeWidth={1.6} className="shrink-0 text-ink-soft" />
                    </button>
                  ))}
                </div>
              )}

              <div className={tab === 'chats' || tab === 'taste' ? 'hidden' : 'space-y-2'}>
                {rows.map((row) => {
                  const wine = wines[row.slug];
                  if (!wine) return null;
                  return (
                    <button
                      key={`${row.slug}-${'query' in row ? row.query : ''}`}
                      type="button"
                      onClick={() => {
                        onOpenWine(wine);
                        onClose();
                      }}
                      className="anim-in flex w-full items-center gap-3 rounded-2xl bg-paper px-3 py-2.5 text-left transition hover:bg-line/50"
                    >
                      <span className="h-12 w-8 shrink-0">
                        {wine.image && (
                          <img src={wine.image} alt="" className="h-full w-full object-contain" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="serif block truncate text-[15px] text-ink">{wine.name}</span>
                        <span className="block truncate text-[11.5px] text-ink-soft">
                          {'query' in row && row.query ? row.query : [wine.region, wine.sweetness].filter(Boolean).join(', ')}
                        </span>
                      </span>
                      <ArrowRight size={14} strokeWidth={1.6} className="shrink-0 text-ink-soft" />
                    </button>
                  );
                })}
              </div>
              </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
