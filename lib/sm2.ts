export interface Flashcard {
  id: string;
  front: string;
  back: string;
  category: string;
  // SM-2 fields
  repetitions: number;
  easeFactor: number;
  interval: number; // days
  nextReview: number; // timestamp
  lastReview: number | null;
  mastery: 'new' | 'learning' | 'review' | 'mastered';
  streak: number;
}

export interface Deck {
  id: string;
  title: string;
  description: string;
  createdAt: number;
  lastStudied: number | null;
  cards: Flashcard[];
  totalStudySessions: number;
}

// Quality: 0-5 scale
// 0-2: Failed (again), 3: Hard, 4: Good, 5: Easy
export function sm2Update(card: Flashcard, quality: 0 | 1 | 2 | 3 | 4 | 5): Flashcard {
  const now = Date.now();
  let { repetitions, easeFactor, interval } = card;

  if (quality >= 3) {
    // Correct response
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else {
    // Incorrect — reset
    repetitions = 0;
    interval = 1;
  }

  // Update ease factor
  easeFactor = Math.max(
    1.3,
    easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  );

  const nextReview = now + interval * 24 * 60 * 60 * 1000;

let mastery: Flashcard['mastery'] = 'learning';
if (repetitions === 0) mastery = 'new';
else if (repetitions === 1) mastery = 'learning';
else if (repetitions === 2) mastery = 'review';
else mastery = 'mastered';

  const streak = quality >= 3 ? card.streak + 1 : 0;

  return {
    ...card,
    repetitions,
    easeFactor,
    interval,
    nextReview,
    lastReview: now,
    mastery,
    streak,
  };
}

export function getDueCards(deck: Deck): Flashcard[] {
  const now = Date.now();
  return deck.cards.filter(
    (c) => c.nextReview <= now || c.mastery === 'new'
  );
}

export function getDeckStats(deck: Deck) {
  const total = deck.cards.length;
  const mastered = deck.cards.filter((c) => c.mastery === 'mastered').length;
  const learning = deck.cards.filter((c) => c.mastery === 'learning').length;
  const review = deck.cards.filter((c) => c.mastery === 'review').length;
  const newCards = deck.cards.filter((c) => c.mastery === 'new').length;
  const due = getDueCards(deck).length;

  return { total, mastered, learning, review, newCards, due };
}

export function createCard(front: string, back: string, category: string = 'General'): Flashcard {
  return {
    id: Math.random().toString(36).slice(2),
    front,
    back,
    category,
    repetitions: 0,
    easeFactor: 2.5,
    interval: 0,
    nextReview: Date.now(),
    lastReview: null,
    mastery: 'new',
    streak: 0,
  };
}
