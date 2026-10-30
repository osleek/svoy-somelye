'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Heart } from 'lucide-react';


import type { RankedWine } from '@/lib/catalog/types';
import { accentFor, onColor } from '@/lib/wine-color';
import { cn } from '@/lib/utils';

const ease = [0.22, 1, 0.36, 1] as const;

function BuyButton({ wine, large = false }: { wine: RankedWine; large?: boolean }) {
  return (
    <a
      href={wine.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group inline-flex flex-1 items-center justify-center gap-3 font-medium transition',
        large
          ? 'w-full rounded-full bg-ink px-6 py-4 text-[17px] text-paper-lit hover:bg-[#4e1f2b]'
          : 'bg-paper px-6 py-3.5 text-[13.5px] text-ink hover:bg-ink hover:text-paper-lit',
      )}
    >
      Открыть в каталоге
      <ArrowRight size={large ? 18 : 16} strokeWidth={1.5} className="transition group-hover:translate-x-1" />
    </a>
  );
}

function FavoriteButton({
  active,
  onClick,
  size = 21,
}: {
  active: boolean;
  onClick: () => void;
  size?: number;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={active ? 'Убрать из избранного' : 'Сохранить в избранное'}
      aria-pressed={active}
      whileTap={{ scale: 0.86 }}
      className="grid h-11 w-11 place-items-center rounded-full transition"
    >
      <motion.span
        key={active ? 'on' : 'off'}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.28, ease }}
        className="grid place-items-center"
      >
        <Heart
          size={size}
          strokeWidth={1.6}
          className={active ? 'fill-[#4e1f2b] text-[#4e1f2b]' : 'text-ink'}
        />
      </motion.span>
    </motion.button>
  );
}

export function WinePage({
  wine,
  wines,
  activeIndex,
  onSelect,
  onClose,
  isFavorite,
  onToggleFavorite,
}: {
  wine: RankedWine;
  wines: RankedWine[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: (slug: string) => void;
}) {
  const [descOpen, setDescOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("desc") === "1";
  });
  const descRef = useRef<HTMLDivElement>(null);
  const [descLines, setDescLines] = useState(6);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setDescOpen(false);
  }, [wine.slug]);

  useEffect(() => {
    const compute = () => {
      const available = window.innerHeight - 620;
      setDescLines(Math.max(3, Math.min(9, Math.floor(available / 22))));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [wine.slug]);

  const accent = accentFor(wine.type);
  const ink = onColor(accent);
  const place = [wine.manufacturer, wine.region].filter(Boolean).join(', ');
  const words = wine.name.split(/\s+/).filter(Boolean).slice(0, 4);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [titlePx, setTitlePx] = useState<number | null>(null);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const longest = words.reduce((max, word) => Math.max(max, word.length), 0);
    const fit = () => {
      const width = el.clientWidth || 200;
      const size = Math.max(15, Math.min(44, Math.floor(width / (Math.max(longest, 4) * 0.8))));
      setTitlePx(size);
    };
    fit();
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(fit).catch(() => {});
    }
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [wine.slug, words.join(" ")]);

  const facts = [
    wine.type && ['Цвет', wine.type],
    wine.sweetness && ['Сладость', wine.sweetness],
    wine.alcohol && ['Крепость', wine.alcohol],
    wine.grapes.length > 0 && ['Сорта', wine.grapes.join(', ')],
    wine.dishes.length > 0 && ['Сочетание', wine.dishes.slice(0, 3).join(', ')],
  ].filter(Boolean) as Array<[string, string]>;

  return (
    <div className="fixed inset-0 z-40 h-dvh w-full overflow-hidden bg-paper-lit">
      <div className="wine-page lg:hidden">
        <motion.div
          key={`tint-${wine.slug}`}
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: 0.16, scaleY: 1 }}
          transition={{ duration: 0.75, ease, opacity: { duration: 0.5 } }}
          style={{
            background: `linear-gradient(to bottom, ${accent} 0%, ${accent} 45%, transparent 100%)`,
            transformOrigin: 'top center',
          }}
          className="pointer-events-none absolute inset-x-0 top-0 h-[72%]"
        />

        <header className="wine-head">
          <button type="button" onClick={onClose} aria-label="Назад к чату">
            <ArrowLeft size={23} strokeWidth={1.6} />
          </button>
          <FavoriteButton active={isFavorite} onClick={() => onToggleFavorite(wine.slug)} />
        </header>

        <main className="wine-main">
          <motion.div
            key={`info-${wine.slug}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease }}
            className="wine-info"
          >
            <h2 ref={titleRef} className="wine-title" style={titlePx ? { fontSize: `${titlePx}px` } : undefined}>
              {words.map((word, index) => (
                <span key={`${word}-${index}`} className="block">
                  {word}
                </span>
              ))}
            </h2>
            <p className="wine-place">{place}</p>

            <dl className="wine-facts">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </motion.div>

          <div className="wine-figure">
            {wine.image && (
              <motion.img
                key={`img-${wine.slug}`}
                onError={(event) => {
                  event.currentTarget.style.visibility = "hidden";
                }}
                src={wine.image}
                alt={wine.name}
                initial={{ opacity: 0, y: 48 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease, delay: 0.12 }}
              />
            )}
          </div>
        </main>

        <section className="wine-desc" ref={descRef}>
          <p className="text-[12px] text-ink-soft">Описание</p>
          <p style={{ ["--desc-lines" as string]: descLines }}>{wine.description}</p>
          {wine.description && wine.description.length > 200 && (
            <button type="button" className="wine-desc__more" onClick={() => setDescOpen(true)}>
              Показать полностью
            </button>
          )}
        </section>

        <footer className="wine-foot">
          {wines.length > 1 && (
            <div className="wine-alt">
              {wines.map((item, index) => (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => onSelect(index)}
                  aria-label={item.name}
                  aria-current={index === activeIndex}
                >
                  {item.image && <img src={item.image} alt="" />}
                  <span>{item.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          )}

          <BuyButton wine={wine} large />
        </footer>
      </div>

      {descOpen && (
        <>
          <button
            type="button"
            aria-label="Закрыть описание"
            onClick={() => setDescOpen(false)}
            className="fixed inset-0 z-[59] bg-ink/35 lg:hidden"
          />
          <div className="desc-sheet lg:hidden">
            <div className="desc-sheet__handle" />
            <div className="desc-sheet__head">
              <p className="text-[12px] uppercase tracking-[0.18em] text-ink-soft">Описание</p>
              <button type="button" onClick={() => setDescOpen(false)} aria-label="Закрыть" className="text-[13px] text-ink-soft">
                Закрыть
              </button>
            </div>
            <div className="desc-sheet__body">{wine.description}</div>
          </div>
        </>
      )}

      <div className="hidden h-full lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="relative flex h-full flex-col overflow-y-auto px-14 py-12"
        >
          <button
            type="button"
            onClick={onClose}
            className="mb-7 inline-flex items-center gap-2 self-start text-[12.5px] text-ink-soft transition hover:text-ink"
          >
            <ArrowLeft size={16} strokeWidth={1.6} />
            К чату
          </button>

          <p className="eyebrow">Своё вино</p>
          <h2 className="serif mt-3 text-[clamp(34px,3.4vw,58px)] leading-[1.0] text-ink">{wine.name}</h2>
          <p className="mt-3 text-[15px] font-light text-ink-soft">{place}</p>

          {wine.description && (
            <p className="serif mt-6 max-w-[52ch] text-[16.5px] leading-[1.6] text-ink/80">{wine.description}</p>
          )}

          <dl className="mt-8 max-w-[52ch]">
            {facts.map(([label, value]) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-8 border-b border-line/80 py-2.5"
              >
                <dt className="shrink-0 text-[13px] font-light text-ink-soft">{label}</dt>
                <dd className="text-right text-[14.5px] text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-auto flex items-center gap-3 pt-9">
            <BuyButton wine={wine} />
            <FavoriteButton active={isFavorite} onClick={() => onToggleFavorite(wine.slug)} size={17} />
          </div>
        </motion.div>

        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          transition={{ duration: 0.85, ease }}
          className="relative flex h-full flex-col items-center justify-center overflow-hidden"
          style={{ backgroundColor: accent }}
        >
          {wine.image && (
            <motion.img
              key={`d-${wine.slug}`}
              onError={(event) => {
                event.currentTarget.style.visibility = "hidden";
              }}
              src={wine.image}
              alt={wine.name}
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease, delay: 0.2 }}
              className="relative h-[62%] w-auto object-contain drop-shadow-[0_30px_44px_rgba(0,0,0,0.5)]"
            />
          )}

          {wines.length > 1 && (
            <div className="absolute inset-x-6 bottom-6 flex gap-2">
              {wines.map((item, index) => (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => onSelect(index)}
                  aria-label={item.name}
                  aria-current={index === activeIndex}
                  className={cn(
                    'flex flex-1 items-center gap-2 border px-2 py-1.5 text-left transition',
                    index === activeIndex
                      ? 'border-white/70 bg-white/10'
                      : 'border-white/20 hover:border-white/40',
                  )}
                >
                  <span className="h-9 w-6 shrink-0">
                    {item.image && (
                      <img
                        src={item.image}
                        alt=""
                        className="h-full w-full object-contain"
                        onError={(event) => {
                          event.currentTarget.style.visibility = "hidden";
                        }}
                      />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] text-white/90">{item.name}</span>
                    <span className="block truncate text-[10px] text-white/55">
                      {[item.region, item.sweetness].filter(Boolean).join(', ')}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
