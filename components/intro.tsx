'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

type Phase = 'age' | 'denied' | 'splash';

const KEY_AGE = 'vino_age';
const KEY_SEEN = 'vino_seen';

export function Intro({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('age');
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const ageOk =
      typeof window !== 'undefined' &&
      (localStorage.getItem(KEY_AGE) === 'ok' || params?.get('age') === 'ok');
    setPhase(ageOk ? 'splash' : 'age');
    setReady(true);
  }, []);

  const finish = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => {
      localStorage.setItem(KEY_SEEN, '1');
      onDone();
    }, 430);
  }, [onDone]);

  useEffect(() => {
    if (phase !== 'splash') return;
    const timer = window.setTimeout(finish, 5200);
    return () => window.clearTimeout(timer);
  }, [phase, finish]);

  if (!ready) return null;

  return (
    <div className="intro">
      <AnimatePresence mode="wait">
        {phase === 'age' && (
          <motion.div
            key="age"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="intro__age"
          >
            <p className="eyebrow">Свой Сомелье</p>
            <h1 className="intro__age-title">Вам есть 18 лет?</h1>
            <p className="intro__age-text">
              Сайт рассказывает о вине и содержит информацию об алкоголе. Подтвердите, что вы совершеннолетний.
            </p>

            <div className="intro__age-actions">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(KEY_AGE, 'ok');
                  setPhase('splash');
                }}
                className="intro__btn intro__btn--primary"
              >
                Да, мне есть 18
              </button>
              <button type="button" onClick={() => setPhase('denied')} className="intro__btn">
                Нет
              </button>
            </div>
          </motion.div>
        )}

        {phase === 'denied' && (
          <motion.div
            key="denied"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="intro__age"
          >
            <p className="eyebrow">Свой Сомелье</p>
            <h1 className="intro__age-title">Тогда нам придётся подождать</h1>
            <p className="intro__age-text">
              Информация о вине предназначена для совершеннолетних. Возвращайтесь, когда вам исполнится 18.
            </p>
            <button type="button" onClick={() => setPhase('age')} className="intro__btn">
              Я ошибся, мне есть 18
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === 'splash' && (
        <div className={leaving ? "intro__splash intro__splash--leaving" : "intro__splash"}>
          <div className="intro__liquid">
            <svg className="intro__wave" viewBox="0 0 1200 90" preserveAspectRatio="none" aria-hidden>
              <path
                d="M0,45 C150,10 300,80 450,45 C600,10 750,80 900,45 C1050,10 1150,60 1200,45 L1200,90 L0,90 Z"
                fill="#7a2233"
              />
            </svg>
          </div>

          <div className="intro__content">
            <p className="intro__eyebrow">российское вино</p>
            <h1 className="intro__title">
              Свой
              <br />
              Сомелье
            </h1>
            <p className="intro__caption">Подберу вино по блюду, вкусу и поводу</p>

            <button type="button" onClick={finish} className="intro__skip">
              Перейти
              <ArrowRight size={15} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
