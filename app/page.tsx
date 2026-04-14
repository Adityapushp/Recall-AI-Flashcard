'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Flashcard, Deck, sm2Update, getDueCards, getDeckStats, createCard } from '@/lib/sm2';

// ─── Types ──────────────────────────────────────────────────────────────────
type View = 'home' | 'study' | 'deck';
type StudyPhase = 'question' | 'answer' | 'complete';

// ─── Storage helpers ─────────────────────────────────────────────────────────
const STORAGE_KEY = 'recall_decks';

function loadDecks(): Deck[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveDecks(decks: Deck[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

// ─── Small components ─────────────────────────────────────────────────────────

function MasteryDot({ mastery }: { mastery: Flashcard['mastery'] }) {
  const colors: Record<string, string> = {
    new: '#7a7a8a',
    learning: '#f0a832',
    review: '#5dbd7a',
    mastered: '#5dbd7a',
  };
  return (
    <span style={{
      width: 8, height: 8, borderRadius: '50%',
      background: colors[mastery], display: 'inline-block', flexShrink: 0,
    }} />
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '10px 16px', textAlign: 'center', flex: 1,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'DM Mono' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
    </div>
  );
}

// ─── Upload Panel ──────────────────────────────────────────────────────────────
function UploadPanel({ onDeckCreated }: { onDeckCreated: (deck: Deck) => void }) {
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'generating' | 'done'>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function processFile(file: File) {
    if (!file.name.endsWith('.pdf') && file.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
      return;
    }
    setError('');
    setPhase('uploading');
    setProgress('Extracting text from PDF…');

    try {
      // Step 1: Extract PDF text
      const fd = new FormData();
      fd.append('file', file);
      const extractRes = await fetch('/api/extract-pdf', { method: 'POST', body: fd });
      const extracted = await extractRes.json();
      if (!extractRes.ok) throw new Error(extracted.error || 'PDF extraction failed');

      const text: string = extracted.text;
      if (text.length < 100) throw new Error('PDF appears empty or unreadable');

      setPhase('generating');
      setProgress(`Generating flashcards from ${extracted.pages} page(s)…`);

      // Step 2: Generate cards
      const title = file.name.replace('.pdf', '').replace(/_/g, ' ');
      const genRes = await fetch('/api/generate-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, title }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.error || 'Card generation failed');

      const rawCards: { front: string; back: string; category: string }[] = genData.cards;
      const cards: Flashcard[] = rawCards.map(c => createCard(c.front, c.back, c.category));

      const deck: Deck = {
        id: Date.now().toString(36),
        title,
        description: `${cards.length} cards · Generated from ${file.name}`,
        createdAt: Date.now(),
        lastStudied: null,
        cards,
        totalStudySessions: 0,
      };

      setPhase('done');
      onDeckCreated(deck);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
      setPhase('idle');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      {/* Hero text */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(232,197,71,0.1)', border: '1px solid rgba(232,197,71,0.2)',
          borderRadius: 999, padding: '4px 14px', marginBottom: 20,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} className="pulse-dot" />
          <span style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'DM Mono', letterSpacing: '0.5px' }}>
            POWERED BY SPACED REPETITION
          </span>
        </div>
        <h1 style={{ fontSize: 48, fontWeight: 900, margin: '0 0 16px', lineHeight: 1.1 }}>
          Drop a PDF.<br />
          <em style={{ color: 'var(--accent)' }}>Start remembering.</em>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 17, margin: 0, lineHeight: 1.6 }}>
          Claude reads your study material and creates smart flashcards.<br />
          The SM-2 algorithm shows you the right card at the right time.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={`drop-zone${dragOver ? ' drag-over' : ''}`}
        style={{ borderRadius: 16, padding: '48px 32px', textAlign: 'center', cursor: 'pointer', position: 'relative' }}
        onClick={() => phase === 'idle' && fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }}
          onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} />

        {phase === 'idle' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📄</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Drop your PDF here</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>or click to browse · any subject, any length</div>
          </>
        )}

        {(phase === 'uploading' || phase === 'generating') && (
          <div>
            <div style={{ fontSize: 32, marginBottom: 16 }}>
              {phase === 'uploading' ? '📖' : '✨'}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{progress}</div>
            <div style={{ width: '60%', margin: '16px auto 0' }}>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: phase === 'uploading' ? '30%' : '75%' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          marginTop: 16, padding: '12px 16px', borderRadius: 10,
          background: 'rgba(224,85,85,0.1)', border: '1px solid rgba(224,85,85,0.3)',
          color: '#e05555', fontSize: 14,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Feature row */}
      <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
        {[
          { icon: '🧠', label: 'Smart cards', desc: 'Teacher-quality questions, not scraped text' },
          { icon: '📅', label: 'SM-2 scheduling', desc: 'See hard cards more, easy cards less' },
          { icon: '📊', label: 'Track mastery', desc: 'Know exactly what you know' },
        ].map(f => (
          <div key={f.label} style={{
            flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '16px 14px',
          }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{f.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{f.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Study Session ──────────────────────────────────────────────────────────────
function StudySession({ deck, onUpdate, onBack }: {
  deck: Deck;
  onUpdate: (deck: Deck) => void;
  onBack: () => void;
}) {
  const [dueCards] = useState<Flashcard[]>(() => getDueCards(deck));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [phase, setPhase] = useState<StudyPhase>('question');
  const [isFlipped, setIsFlipped] = useState(false);
  const [updatedCards, setUpdatedCards] = useState<Map<string, Flashcard>>(new Map());
  const [sessionStats, setSessionStats] = useState({ correct: 0, again: 0 });
  const cardHeight = useRef<number>(0);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  const currentCard = currentIdx < dueCards.length
    ? (updatedCards.get(dueCards[currentIdx].id) || dueCards[currentIdx])
    : null;

  const progress = Math.round((currentIdx / dueCards.length) * 100);

  useEffect(() => {
    // Measure tallest side to set container height
    if (frontRef.current && backRef.current) {
      cardHeight.current = Math.max(frontRef.current.scrollHeight, backRef.current.scrollHeight);
    }
  });

  function flip() {
    setIsFlipped(true);
    setPhase('answer');
  }

  function rate(quality: 0 | 3 | 4 | 5) {
    if (!currentCard) return;
    const updated = sm2Update(currentCard, quality);
    const newMap = new Map(updatedCards);
    newMap.set(currentCard.id, updated);
    setUpdatedCards(newMap);

    setSessionStats(s => ({
      correct: quality >= 3 ? s.correct + 1 : s.correct,
      again: quality < 3 ? s.again + 1 : s.again,
    }));

    if (currentIdx + 1 >= dueCards.length) {
      // Save all updated cards
      const newCards = deck.cards.map(c => newMap.get(c.id) || c);
      const updatedDeck: Deck = {
        ...deck,
        cards: newCards,
        lastStudied: Date.now(),
        totalStudySessions: deck.totalStudySessions + 1,
      };
      onUpdate(updatedDeck);
      setPhase('complete');
    } else {
      setCurrentIdx(i => i + 1);
      setIsFlipped(false);
      setPhase('question');
    }
  }

  if (phase === 'complete') {
    const acc = Math.round((sessionStats.correct / dueCards.length) * 100);
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }} className="fade-up">
        <div style={{ fontSize: 56, marginBottom: 16 }}>
          {acc >= 80 ? '🎉' : acc >= 50 ? '💪' : '🔄'}
        </div>
        <h2 style={{ fontSize: 32, margin: '0 0 8px' }}>Session complete</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>
          You reviewed {dueCards.length} cards
        </p>
        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          <StatPill label="Correct" value={sessionStats.correct} color="var(--success)" />
          <StatPill label="Again" value={sessionStats.again} color="var(--danger)" />
          <StatPill label="Accuracy" value={acc} color="var(--accent)" />
        </div>
        <button className="btn-primary" onClick={onBack} style={{ width: '100%', justifyContent: 'center' }}>
          ← Back to decks
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <button className="btn-secondary" onClick={onBack}>← Exit</button>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>
          {currentIdx + 1} / {dueCards.length}
        </div>
        <span className={`badge badge-${currentCard?.mastery || 'new'}`}>{currentCard?.mastery}</span>
      </div>

      {/* Progress bar */}
      <div className="progress-bar" style={{ marginBottom: 32 }}>
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Card */}
      {currentCard && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono', marginBottom: 12, letterSpacing: '0.5px' }}>
            {currentCard.category.toUpperCase()}
          </div>
          <div className="card-scene" style={{ height: Math.max(220, cardHeight.current || 220) }}>
            <div className={`card-flipper${isFlipped ? ' flipped' : ''}`} style={{ height: '100%' }}>
              {/* Front */}
              <div ref={frontRef} className="card-face" style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 16, padding: '36px 32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: 220, height: '100%',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'DM Mono', letterSpacing: '0.5px', marginBottom: 16 }}>QUESTION</div>
                  <p style={{ fontSize: 20, lineHeight: 1.5, margin: 0, fontFamily: 'Playfair Display' }}>{currentCard.front}</p>
                </div>
              </div>
              {/* Back */}
              <div ref={backRef} className="card-face card-back" style={{
                background: 'var(--surface)', border: '1px solid rgba(232,197,71,0.3)',
                borderRadius: 16, padding: '36px 32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: 220, height: '100%',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--success)', fontFamily: 'DM Mono', letterSpacing: '0.5px', marginBottom: 16 }}>ANSWER</div>
                  <p style={{ fontSize: 17, lineHeight: 1.65, margin: 0, color: 'var(--text)' }}>{currentCard.back}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      {phase === 'question' && (
        <button className="btn-primary" onClick={flip} style={{ width: '100%', justifyContent: 'center', fontSize: 16, padding: '16px' }}>
          Reveal answer ↓
        </button>
      )}

      {phase === 'answer' && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 14 }}>
            How well did you know this?
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: '🔁 Again', sub: '<1d', quality: 0 as const, color: 'var(--danger)' },
              { label: '😓 Hard', sub: '', quality: 3 as const, color: 'var(--warning)' },
              { label: '✓ Good', sub: '', quality: 4 as const, color: 'var(--success)' },
              { label: '⚡ Easy', sub: '', quality: 5 as const, color: 'var(--accent)' },
            ].map(btn => (
              <button
                key={btn.label}
                onClick={() => rate(btn.quality)}
                style={{
                  background: 'var(--surface2)', border: `1px solid var(--border)`,
                  borderRadius: 10, padding: '12px 8px', cursor: 'pointer',
                  color: btn.color, fontWeight: 600, fontSize: 13,
                  fontFamily: 'DM Sans', transition: 'all 0.15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = btn.color)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Deck View ────────────────────────────────────────────────────────────────
function DeckView({ deck, onStudy, onBack, onDelete }: {
  deck: Deck;
  onStudy: () => void;
  onBack: () => void;
  onDelete: () => void;
}) {
  const stats = getDeckStats(deck);
  const [showAll, setShowAll] = useState(false);
  const cards = showAll ? deck.cards : deck.cards.slice(0, 8);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }} className="fade-up">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <button className="btn-secondary" onClick={onBack}>← All decks</button>
        <button onClick={onDelete} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 13, padding: '8px 12px',
        }}>Delete deck</button>
      </div>

      <h2 style={{ fontSize: 32, margin: '20px 0 4px' }}>{deck.title}</h2>
      <p style={{ color: 'var(--text-muted)', margin: '0 0 24px' }}>{deck.description}</p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <StatPill label="Total" value={stats.total} color="var(--text)" />
        <StatPill label="Due" value={stats.due} color="var(--accent)" />
        <StatPill label="Learning" value={stats.learning} color="var(--warning)" />
        <StatPill label="Mastered" value={stats.mastered} color="var(--success)" />
      </div>

      {/* Mastery bar */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Overall mastery</span>
          <span style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'DM Mono' }}>
            {stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0}%
          </span>
        </div>
        <div className="progress-bar" style={{ height: 8 }}>
          <div className="progress-fill" style={{ width: `${stats.total > 0 ? (stats.mastered / stats.total) * 100 : 0}%` }} />
        </div>
      </div>

      <button
        className="btn-primary"
        onClick={onStudy}
        disabled={stats.due === 0}
        style={{ width: '100%', justifyContent: 'center', fontSize: 16, padding: '15px', marginBottom: 32 }}
      >
        {stats.due === 0 ? '✓ All caught up! Come back tomorrow' : `Study ${stats.due} due card${stats.due !== 1 ? 's' : ''} →`}
      </button>

      {/* Card list */}
      <h3 style={{ fontSize: 16, margin: '0 0 14px', color: 'var(--text-muted)' }}>All cards</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {cards.map(card => (
          <div key={card.id} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '14px 16px',
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <MasteryDot mastery={card.mastery} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{card.front}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>{card.back}</div>
            </div>
            <span className={`badge badge-${card.mastery}`}>{card.mastery}</span>
          </div>
        ))}
      </div>
      {deck.cards.length > 8 && (
        <button className="btn-secondary" onClick={() => setShowAll(s => !s)}
          style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}>
          {showAll ? 'Show less' : `Show all ${deck.cards.length} cards`}
        </button>
      )}
    </div>
  );
}

// ─── Home / Deck List ─────────────────────────────────────────────────────────
function DeckList({ decks, onSelect, onCreated }: {
  decks: Deck[];
  onSelect: (deck: Deck) => void;
  onCreated: (deck: Deck) => void;
}) {
  if (decks.length === 0) {
    return <UploadPanel onDeckCreated={onCreated} />;
  }

  const stats = decks.map(d => getDeckStats(d));
  const totalDue = stats.reduce((s, st) => s + st.due, 0);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 36, margin: '0 0 4px' }}>Your decks</h1>
        {totalDue > 0 && (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            {totalDue} card{totalDue !== 1 ? 's' : ''} due for review across {decks.length} deck{decks.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {decks.map((deck, i) => {
          const st = stats[i];
          const mastery = st.total > 0 ? Math.round((st.mastered / st.total) * 100) : 0;
          return (
            <div
              key={deck.id}
              onClick={() => onSelect(deck)}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 14, padding: '20px 22px', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,197,71,0.4)';
                (e.currentTarget as HTMLElement).style.background = 'var(--surface2)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 4 }}>{deck.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {st.total} cards · {mastery}% mastered
                    {deck.lastStudied && ` · Last studied ${new Date(deck.lastStudied).toLocaleDateString()}`}
                  </div>
                </div>
                {st.due > 0 && (
                  <div style={{
                    background: 'var(--accent)', color: '#0d0d0f',
                    borderRadius: 999, padding: '3px 11px', fontSize: 12, fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {st.due} due
                  </div>
                )}
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${mastery}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Add another deck */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24 }}>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>Add another deck</p>
        <UploadPanel onDeckCreated={onCreated} />
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [view, setView] = useState<View>('home');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDecks(loadDecks());
    setMounted(true);
  }, []);

  const saveDeck = useCallback((deck: Deck) => {
    setDecks(prev => {
      const exists = prev.find(d => d.id === deck.id);
      const updated = exists ? prev.map(d => d.id === deck.id ? deck : d) : [deck, ...prev];
      saveDecks(updated);
      return updated;
    });
    setSelectedDeck(deck);
  }, []);

  const deleteDeck = useCallback((id: string) => {
    setDecks(prev => {
      const updated = prev.filter(d => d.id !== id);
      saveDecks(updated);
      return updated;
    });
    setSelectedDeck(null);
    setView('home');
  }, []);

  if (!mounted) return null;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{
        borderBottom: '1px solid var(--border)', padding: '0 32px',
        display: 'flex', alignItems: 'center', height: 60,
        background: 'rgba(13,13,15,0.8)', backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <button
          onClick={() => { setView('home'); setSelectedDeck(null); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <span style={{ fontSize: 20 }}>🧠</span>
          <span style={{ fontFamily: 'Playfair Display', fontWeight: 700, fontSize: 20, color: 'var(--text)' }}>Recall</span>
        </button>
        <div style={{ flex: 1 }} />
        {decks.length > 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'DM Mono' }}>
            {decks.length} deck{decks.length !== 1 ? 's' : ''}
          </div>
        )}
      </nav>

      {/* Main */}
      <main style={{ flex: 1, padding: '48px 24px' }}>
        {view === 'home' && (
          <DeckList
            decks={decks}
            onSelect={deck => { setSelectedDeck(deck); setView('deck'); }}
            onCreated={deck => { saveDeck(deck); setSelectedDeck(deck); setView('deck'); }}
          />
        )}

        {view === 'deck' && selectedDeck && (
          <DeckView
            deck={selectedDeck}
            onStudy={() => setView('study')}
            onBack={() => { setView('home'); setSelectedDeck(null); }}
            onDelete={() => deleteDeck(selectedDeck.id)}
          />
        )}

        {view === 'study' && selectedDeck && (
          <StudySession
            deck={selectedDeck}
            onUpdate={deck => { saveDeck(deck); }}
            onBack={() => setView('deck')}
          />
        )}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)', padding: '16px 32px',
        display: 'flex', justifyContent: 'center',
        fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Mono',
      }}>
        RECALL · AI FLASHCARD ENGINE · SM-2 SPACED REPETITION
      </footer>
    </div>
  );
}
