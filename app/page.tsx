'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUp,
  Heart,
  History,
  MessageSquare,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  User,
} from 'lucide-react';

import { AuthDialog } from '@/components/auth-dialog';
import { Intro } from '@/components/intro';
import { LibraryPanel } from '@/components/library-panel';
import { WinePage } from '@/components/wine-page';
import type { RankedWine } from '@/lib/catalog/types';
import { useSession } from '@/lib/use-session';
import { cn } from '@/lib/utils';

type Clarify = { question: string; options: string[] };

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  picks: RankedWine[];
  clarify: Clarify | null;
};

const SCENARIOS = [
  'Красное сухое к стейку',
  'Белое к рыбе',
  'Что подарить на день рождения',
  'Крымское розовое',
];

const GREETING =
  'Подберу вино из каталога «Своё Вино». Скажите, к какому блюду или по какому поводу — и я объясню выбор.';

const ease = [0.22, 1, 0.36, 1] as const;
const NAV = [
  { key: 'favorites', label: 'Избранное', icon: Heart },
  { key: 'history', label: 'История', icon: History },
  { key: 'chats', label: 'Чаты', icon: MessageSquare },
  { key: 'taste', label: 'Вкус', icon: SlidersHorizontal },
] as const;

export default function Page() {
  const { user, setUser } = useSession();
  const [messages, setMessages] = useState<Message[]>([
    { id: 'greeting', role: 'assistant', text: GREETING, picks: [], clarify: null },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [picks, setPicks] = useState<RankedWine[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [wineOpen, setWineOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<"favorites" | "history" | "chats" | "taste">("favorites");
  const [pendingTab, setPendingTab] = useState<"favorites" | "history" | "chats" | "taste" | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [sessionDone, setSessionDone] = useState(false);
  const [confirmPick, setConfirmPick] = useState(false);
  const [llmOn, setLlmOn] = useState<boolean | null>(null);

  const [feedback, setFeedback] = useState<Record<string, number>>({});
  const [showIntro, setShowIntro] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const loadFavorites = useCallback(() => {
    fetch('/api/favorites')
      .then((r) => r.json())
      .then((data: { favorites: string[] }) => setFavorites(data.favorites ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) loadFavorites();
    else setFavorites([]);
  }, [user, loadFavorites]);

  async function toggleFavorite(slug: string) {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    const res = await fetch('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    if (res.ok) loadFavorites();
  }

  async function send(text: string) {
    const value = text.trim();
    if (!value || loading) return;

    setInput('');
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text: value, picks: [], clarify: null },
    ]);
    setLoading(true);
    const wire = messages.map((m) => ({ role: m.role, content: m.text, slugs: m.picks.map((p) => p.slug) }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: value, history: wire, conversationId }),
      });
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.text ?? 'Не получилось подобрать.',
          picks: data.picks ?? [],
          clarify: data.clarify ?? null,
        },
      ]);

      if (data.picks?.length) {
        setPicks(data.picks);
        setActiveIndex(0);
        if (new URLSearchParams(window.location.search).get("card") === "1") setWineOpen(true);
      }
      if (data.conversationId) setConversationId(data.conversationId);
      setLlmOn(Boolean(data.llm));
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          text: 'Каталог не отвечает. Попробуйте ещё раз.',
          picks: [],
          clarify: null,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function openPanel(tab: "favorites" | "history" | "chats" | "taste") {
    if (!user) {
      setPendingTab(tab);
      setAuthOpen(true);
      return;
    }
    setLibraryTab(tab);
    setLibraryOpen(true);
  }

  async function sendFeedback(messageId: string, slug: string, value: number) {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setFeedback((prev) => ({ ...prev, [messageId]: value }));
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, value }),
    }).catch(() => {});
  }

  async function openConversation(id: string) {
    const data = await fetch(`/api/conversations/${id}`).then((r) => r.json()).catch(() => null);
    if (!data) return;

    const rows = (data.messages ?? []) as Array<{ role: "user" | "assistant"; content: string; slugs: string[] }>;
    const slugs = [...new Set(rows.flatMap((m) => m.slugs ?? []))];
    const map: Record<string, RankedWine> = {};

    if (slugs.length) {
      const lookup = await fetch(`/api/wines/lookup?slugs=${encodeURIComponent(slugs.join(","))}`)
        .then((r) => r.json())
        .catch(() => null);
      for (const wine of lookup?.wines ?? []) map[wine.slug] = wine;
    }

    setMessages(
      rows.map((m, index) => ({
        id: `h-${index}`,
        role: m.role,
        text: m.content,
        picks: (m.slugs ?? []).map((s) => map[s]).filter(Boolean) as RankedWine[],
        clarify: null,
      })),
    );
    setConversationId(id);
    setSessionDone(false);
    setConfirmPick(false);
  }

  function acceptPick() {
    setConfirmPick(false);
    setSessionDone(true);
    setMessages((prev) => [
      ...prev,
      { id: `f-${Date.now()}`, role: "assistant", text: "Отлично, пусть вечер удастся. Если понадобится ещё вино — начнём новый подбор.", picks: [], clarify: null },
    ]);
  }

  function rejectPick() {
    setConfirmPick(false);
    setSessionDone(false);
    send("не то");
  }

  function resetChat() {
    setMessages([{ id: "greeting", role: "assistant", text: GREETING, picks: [], clarify: null }]);
    setPicks([]);
    setActiveIndex(0);
    setSessionDone(false);
    setConversationId(null);
    setInput("");
  }

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("done") === "1") setSessionDone(true);
    if (new URLSearchParams(window.location.search).get("confirm") === "1") setConfirmPick(true);
    const params = new URLSearchParams(window.location.search);
    if (params.get("panel") === "1") setLibraryOpen(true);

    if (params.get("intro") === "1") setShowIntro(true);
    else if (params.get("intro") !== "0") {
      const seen = localStorage.getItem("vino_seen") === "1";
      if (!seen) setShowIntro(true);
    }

    const directSlug = params.get("slug");
    if (directSlug) {
      fetch(`/api/wines/lookup?slugs=${encodeURIComponent(directSlug)}`)
        .then((r) => r.json())
        .then((data: { wines: RankedWine[] }) => {
          if (data.wines?.length) {
            setPicks(data.wines);
            setActiveIndex(0);
            setWineOpen(true);
          }
        })
        .catch(() => {});
    }
    const presetTab = params.get("tab");
    if (presetTab === "taste" || presetTab === "chats" || presetTab === "history") {
      setLibraryTab(presetTab);
    }
    const preset = new URLSearchParams(window.location.search).get("q");
    if (preset) void send(preset);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const showScenarios = messages.length === 1;

  return (
    <div className="grain relative h-dvh">
      <div className="relative z-10 mx-auto flex h-full w-full max-w-[1200px] justify-center gap-8 px-6">
        <aside className="anim-in hidden w-[200px] shrink-0 flex-col justify-between py-9 xl:flex">
          <div>
            <p className="eyebrow">Каталог</p>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
              Вина российских хозяйств из сети «Своё Вино»: Кубань, Крым, Долина Дона, Нижняя Волга, Самара,
              Дагестан и Северная Осетия.
            </p>
            <p className="mt-3 text-[12px] leading-relaxed text-ink-soft/70">
              Цены и наличие в каталоге не публикуются — карточка ведёт на сайт сети.
            </p>
          </div>
          <dl className="space-y-2 text-[12.5px] text-ink-soft">
            <div className="flex justify-between border-b border-line/70 pb-1.5">
              <dt>вин в каталоге</dt>
              <dd className="text-ink">466</dd>
            </div>
            <div className="flex justify-between border-b border-line/70 pb-1.5">
              <dt>регионов</dt>
              <dd className="text-ink">7</dd>
            </div>
            <div className="flex justify-between">
              <dt>сочетаний с едой</dt>
              <dd className="text-ink">31</dd>
            </div>
          </dl>
        </aside>

        <section className="flex h-full w-full max-w-[720px] flex-col">
        <header className="anim-in flex items-center justify-between border-b border-line pb-4 pt-9">
          <div>
            <p className="serif text-[25px] leading-none text-ink">Свой Сомелье</p>
            <p className="eyebrow mt-2">466 вин российских хозяйств</p>
            {llmOn === false && (
              <p className="mt-1 text-[10.5px] tracking-wide text-ink-soft/70">
                без модели · подбор по правилам каталога
              </p>
            )}
          </div>

          {user ? (
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="flex items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-[12px] text-ink transition hover:bg-line/60"
            >
              <User size={13} strokeWidth={1.7} />
              {user.name}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="rounded-full bg-ink px-4 py-1.5 text-[12px] text-paper-lit transition hover:bg-[#4e1f2b]"
            >
              Войти
            </button>
          )}
        </header>

<nav className="anim-in flex flex-wrap gap-1.5 py-2.5 xl:hidden">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={`m-${item.key}`}
                type="button"
                onClick={() => openPanel(item.key)}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-[12px] text-ink-soft transition hover:bg-line/60 hover:text-ink"
              >
                <Icon size={13} strokeWidth={1.8} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div ref={listRef} className="chat-scroll flex-1 overflow-y-auto">
          <div className="flex min-h-full flex-col justify-end gap-9 pb-8 pt-12">
            {messages.map((message) =>
              message.role === 'user' ? (
                <motion.p
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease }}
                  className="ml-auto max-w-[85%] text-right text-[15.5px] font-light text-[#4e1f2b]"
                >
                  {message.text}
                </motion.p>
              ) : (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease }}
                  className="space-y-4"
                >
                  <p className="text-[17px] font-light leading-relaxed text-ink/85">{message.text}</p>

                  {message.clarify && (
                    <div className="space-y-2">
                      <p className="text-[14px] text-ink-soft">{message.clarify.question}</p>
                      <div className="flex flex-wrap gap-2">
                        {message.clarify.options.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => send(option)}
                            className="anim-in rounded-full bg-line/45 px-3.5 py-1.5 text-[13px] text-ink transition hover:bg-line/80"
                style={{ ["--i" as string]: message.clarify?.options.indexOf(option) ?? 0 }}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {message.picks.length > 0 && (
                    <div className="anim-in flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setPicks(message.picks);
                          setActiveIndex(0);
                          setWineOpen(true);
                        }}
                        className="rounded-full bg-ink px-5 py-2.5 text-[13px] text-paper-lit transition hover:bg-[#4e1f2b]"
                      >
                        Открыть карточку
                      </button>
                      <button
                        type="button"
                        onClick={() => send("не то")}
                        className="rounded-full bg-paper px-4 py-2.5 text-[13px] text-ink-soft transition hover:bg-line/60 hover:text-ink"
                      >
                        Не подходит
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Подошло"
                          onClick={() => sendFeedback(message.id, message.picks[0].slug, 1)}
                          className={`grid h-8 w-8 place-items-center rounded-full transition ${
                            feedback[message.id] === 1 ? "text-[#3d6b58]" : "text-ink-soft/60 hover:text-ink"
                          }`}
                        >
                          <ThumbsUp size={15} strokeWidth={1.7} />
                        </button>
                        <button
                          type="button"
                          aria-label="Не подошло"
                          onClick={() => sendFeedback(message.id, message.picks[0].slug, -1)}
                          className={`grid h-8 w-8 place-items-center rounded-full transition ${
                            feedback[message.id] === -1 ? "text-[#8d2f2f]" : "text-ink-soft/60 hover:text-ink"
                          }`}
                        >
                          <ThumbsDown size={15} strokeWidth={1.7} />
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ),
            )}

            {loading && (
              <div className="flex gap-2" aria-label="Сомелье подбирает вино">
                <span className="dot h-1.5 w-1.5 rounded-full bg-ink-soft" />
                <span className="dot h-1.5 w-1.5 rounded-full bg-ink-soft" style={{ animationDelay: '0.15s' }} />
                <span className="dot h-1.5 w-1.5 rounded-full bg-ink-soft" style={{ animationDelay: '0.3s' }} />
              </div>
            )}
          </div>
        </div>

        <div className="anim-in pb-9 pt-2">
          {confirmPick ? (
            <div className="anim-in rounded-[22px] bg-paper p-4">
              <p className="text-[14px] text-ink">Выбрали это вино?</p>
              <p className="mt-1 text-[12.5px] leading-snug text-ink-soft">
                Можно остановиться на нём или вернуться к поиску — я предложу другие варианты.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={acceptPick}
                  className="rounded-full bg-ink px-4 py-2 text-[13px] text-paper-lit transition hover:bg-[#4e1f2b]"
                >
                  Да, это моё
                </button>
                <button
                  type="button"
                  onClick={rejectPick}
                  className="rounded-full border border-line px-4 py-2 text-[13px] text-ink-soft transition hover:border-ink/40 hover:text-ink"
                >
                  Нет, продолжим поиск
                </button>
              </div>
            </div>
          ) : sessionDone ? (
            <div className="anim-in flex flex-col items-center gap-3 py-4">
              <p className="text-[13px] text-ink-soft">Подбор завершён</p>
              <button
                type="button"
                onClick={resetChat}
                className="rounded-full bg-ink px-6 py-2.5 text-[14px] text-paper-lit transition hover:bg-[#4e1f2b]"
              >
                Начать новый подбор
              </button>
            </div>
          ) : (
            <>

          {showScenarios && !sessionDone && (
            <div className="mb-5 flex flex-wrap gap-2.5">
              {SCENARIOS.map((scenario) => (
                <button
                  key={scenario}
                  type="button"
                  onClick={() => send(scenario)}
                  className="anim-in rounded-full bg-line/45 px-4 py-2 text-[13.5px] font-light text-ink/75 transition hover:bg-line/80 hover:text-ink"
                  style={{ ["--i" as string]: SCENARIOS.indexOf(scenario) }}
                >
                  {scenario}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              send(input);
            }}
            className="flex items-center gap-3 rounded-[26px] bg-[#efe9dd] px-5 py-3 transition focus-within:bg-paper-lit"
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Красное сухое к стейку"
              aria-label="Запрос к сомелье"
              className="max-h-32 min-h-[26px] flex-1 resize-none bg-transparent py-0 text-[16px] leading-[26px] font-light text-ink outline-none placeholder:text-ink-soft/60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Отправить"
              className={cn(
                'grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-paper-lit transition hover:bg-[#4e1f2b] disabled:opacity-25',
              )}
            >
              <ArrowUp size={18} strokeWidth={2} />
            </button>
          </form>
            </>
          )}
        </div>
        </section>

        <aside className="anim-in hidden w-[200px] shrink-0 flex-col justify-center gap-1 py-9 xl:flex">
          <p className="eyebrow mb-2">Кабинет</p>
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={`rail-${item.key}`}
                type="button"
                onClick={() => openPanel(item.key)}
                className="flex items-center gap-2.5 rounded-full py-1.5 text-left text-[13px] text-ink-soft transition hover:text-ink"
              >
                <Icon size={14} strokeWidth={1.7} />
                {item.label}
              </button>
            );
          })}

        </aside>

      </div>

      <AnimatePresence>
        {wineOpen && picks[activeIndex] && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.42, ease }}
            className="fixed inset-0 z-40"
          >
            <WinePage
              wine={picks[activeIndex]}
              wines={picks}
              activeIndex={activeIndex}
              onSelect={setActiveIndex}
              onClose={() => {
                setWineOpen(false);
                setConfirmPick(true);
              }}
              isFavorite={favorites.includes(picks[activeIndex].slug)}
              onToggleFavorite={toggleFavorite}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {showIntro && (
        <Intro onDone={() => setShowIntro(false)} />
      )}

      <AuthDialog
        open={authOpen}
        onClose={() => {
          setAuthOpen(false);
          setPendingTab(null);
        }}
        onAuthed={(next) => {
          setUser(next);
          if (pendingTab) {
            setLibraryTab(pendingTab);
            setLibraryOpen(true);
            setPendingTab(null);
          }
        }}
      />
      <LibraryPanel
        open={libraryOpen}
        initialTab={libraryTab}
        onClose={() => setLibraryOpen(false)}
        onOpenWine={(wine) => {
          setPicks([wine]);
          setActiveIndex(0);
          setWineOpen(true);
        }}
        onOpenConversation={openConversation}
      />
    </div>
  );
}
