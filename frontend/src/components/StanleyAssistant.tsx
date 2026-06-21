'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/cn';
import { IconX, IconSparkles, IconSend, IconArrowRight, IconCheck, IconChart, IconBox, IconUsers, IconBolt } from '@/components/icons';

interface Action { type: 'navigate'; href: string; label: string }
interface Msg { role: 'user' | 'assistant'; content: string; action?: Action }
interface SetupTask { key: string; label: string; done: boolean; href: string }

const QUICK: { label: string; text: string; icon: (p: { size?: number }) => React.ReactNode }[] = [
  { label: "Store overview", text: "How's my store doing?", icon: IconChart },
  { label: 'Create a product', text: 'Help me create a product', icon: IconBox },
  { label: 'My analytics', text: 'Show my analytics', icon: IconBolt },
  { label: 'My products', text: 'List my products', icon: IconUsers },
];

function Dot({ delay = 0 }: { delay?: number }) {
  return <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-300" style={{ animationDelay: `${delay}ms` }} />;
}

export function StanleyAssistant() {
  const { authedRequest } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<{ tasks: SetupTask[]; completed: number; total: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadSetup = useCallback(() => {
    authedRequest<{ tasks: SetupTask[]; completed: number; total: number }>('/api/assistant/setup')
      .then(setSetup).catch(() => {});
  }, [authedRequest]);
  useEffect(() => { loadSetup(); }, [loadSetup]);
  useEffect(() => { if (open) loadSetup(); }, [open, loadSetup]);
  // Allow other UI (e.g. the "Ask Stanley" home card) to open the assistant.
  useEffect(() => {
    const openIt = () => setOpen(true);
    window.addEventListener('cs:open-stanley', openIt);
    return () => window.removeEventListener('cs:open-stanley', openIt);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy, open]);

  const pending = setup ? setup.total - setup.completed : 0;

  function go(href: string) { setOpen(false); router.push(href); }

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content: t }];
    setMsgs(next);
    setInput('');
    setBusy(true);
    try {
      const res = await authedRequest<{ reply: string; action?: Action }>('/api/assistant/chat', {
        method: 'POST',
        body: { messages: next.map((m) => ({ role: m.role, content: m.content })) },
      });
      setMsgs((m) => [...m, { role: 'assistant', content: res.reply, action: res.action }]);
      loadSetup();
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: 'Sorry, I hit an error. Please try again in a moment.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Ask Stanley"
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-brand-gradient px-5 py-3.5 text-sm font-bold text-white shadow-glow transition hover:brightness-105 active:translate-y-px"
        >
          <IconSparkles size={18} /> Ask Stanley
          {pending > 0 && (
            <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-white px-1 text-xs font-extrabold text-brand-600">{pending}</span>
          )}
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[640px] max-h-[calc(100dvh-2.5rem)] w-[400px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-lift">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 bg-brand-gradient px-5 py-4 text-white">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20"><IconSparkles size={18} /></span>
              <div>
                <div className="text-sm font-bold leading-tight">Ask Stanley</div>
                <div className="text-xs text-white/75">Your AI creator coach</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-full p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"><IconX size={18} /></button>
          </div>

          {/* Body */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-surface-subtle p-4">
            {msgs.length === 0 ? (
              <>
                {/* Setup checklist */}
                {setup && setup.completed < setup.total && (
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-[#1a1c3a]">Finish setting up your store</span>
                      <span className="text-xs font-bold text-brand-600">{setup.completed}/{setup.total}</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(setup.completed / setup.total) * 100}%` }} />
                    </div>
                    <div className="mt-3 space-y-0.5">
                      {setup.tasks.map((t) => (
                        <button
                          key={t.key}
                          disabled={t.done}
                          onClick={() => go(t.href)}
                          className={cn('flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm transition', t.done ? 'cursor-default text-neutral-400' : 'text-[#1a1c3a] hover:bg-surface-subtle')}
                        >
                          <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full', t.done ? 'bg-success-500 text-white' : 'border-2 border-brand-300')}>
                            {t.done && <IconCheck size={12} />}
                          </span>
                          <span className={cn('flex-1', t.done && 'line-through')}>{t.label}</span>
                          {!t.done && <IconArrowRight size={14} className="text-neutral-300" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {setup && setup.completed === setup.total && (
                  <div className="flex items-center gap-2 rounded-2xl bg-success-50 p-4 text-sm font-semibold text-success-700">
                    <IconCheck size={16} /> Your store is fully set up — nice work! 🎉
                  </div>
                )}

                {/* Greeting + quick actions */}
                <div className="px-1 pt-1 text-center">
                  <h3 className="text-base font-bold text-[#1a1c3a]">How can I help?</h3>
                  <p className="mx-auto mt-1 max-w-[280px] text-sm text-neutral-500">Ask me anything, or tap a shortcut to get going fast.</p>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {QUICK.map((q) => {
                    const Icon = q.icon;
                    return (
                      <button key={q.label} onClick={() => send(q.text)} className="flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-3 text-left text-sm font-semibold text-[#1a1c3a] transition hover:border-brand-300 hover:bg-brand-50/40">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon size={16} /></span>
                        {q.label}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              msgs.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed', m.role === 'user' ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-white text-[#1a1c3a] shadow-sm')}>
                    {m.content}
                    {m.action && (
                      <button onClick={() => go(m.action!.href)} className="mt-2 flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-600 transition hover:bg-brand-100">
                        {m.action.label} <IconArrowRight size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm"><span className="flex gap-1"><Dot /><Dot delay={150} /><Dot delay={300} /></span></div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex items-end gap-2 border-t border-line bg-white p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); } }}
              rows={1}
              placeholder="Ask Stanley anything…"
              className="max-h-28 flex-1 resize-none rounded-2xl border border-line-strong bg-surface-subtle px-4 py-2.5 text-sm outline-none transition focus:border-brand-500"
            />
            <button type="submit" disabled={busy || !input.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-40"><IconSend size={18} /></button>
          </form>
        </div>
      )}
    </>
  );
}
