import { randomUUID } from 'node:crypto';

export function makeSession(items, source) {
  if (!Array.isArray(items) || !items.length || items.length > 12) throw Error('Invalid quiz length.');
  const normalize = text => text.replace(/\s+/g, ' ').trim().toLowerCase();
  const notes = normalize(source);
  const questions = items.map(q => {
    if (![q.prompt, q.answer, q.quote, q.explanation].every(s => typeof s === 'string' && s.trim()) ||
      !notes.includes(normalize(q.quote))) throw Error('Question missing supporting evidence.');
    if (!['typed', 'choice'].includes(q.type)) throw Error('Unknown question type.');
    if (q.type === 'choice' && (!Array.isArray(q.options) || q.options.length !== 4 ||
      q.options.some(s => typeof s !== 'string' || !s.trim()) || new Set(q.options.map(normalize)).size !== 4 ||
      !q.options.includes(q.answer))) throw Error('Invalid options.');
    return { ...q, review: false, id: randomUUID() };
  });
  return { questions, index: 0, lives: 3, coins: 0, correct: 0, busy: false, expires: Date.now() + 3600000 };
}

export function view(s) {
  const q = s.questions[s.index];
  return { index: s.index, total: s.questions.length, lives: s.lives, coins: s.coins, correct: s.correct,
    question: q && s.lives ? { id: q.id, review: q.review, prompt: q.prompt, type: q.type, options: q.type === 'choice' ? q.options : [] } : null };
}

export function award(s, correct) {
  const q = s.questions[s.index++];
  if (correct) { s.correct++; s.coins += 10; }
  else {
    s.lives--;
    if (!q.review) s.questions.push({ ...q, id: randomUUID(), review: true });
  }
}
