export function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export function hoursFromNow(n: number): Date {
  const d = new Date();
  d.setHours(d.getHours() + n);
  return d;
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < Math.min(n, copy.length); i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

export function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function usernameFromEmail(email: string): string {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  return base || 'creator';
}

export const FIRST_NAMES = [
  'Jordan', 'Sam', 'Taylor', 'Riley', 'Casey', 'Morgan', 'Avery', 'Quinn',
  'Jamie', 'Drew', 'Skyler', 'Reese', 'Blake', 'Cameron', 'Dakota', 'Emery',
  'Finley', 'Harper', 'Jessie', 'Kai', 'Logan', 'Noah', 'Parker', 'River',
];

export const LAST_NAMES = [
  'Lee', 'Kim', 'Patel', 'Nguyen', 'Garcia', 'Brown', 'Wilson', 'Martinez',
  'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Clark', 'Lewis', 'Walker',
];

export function randomName(): { firstName: string; lastName: string } {
  return { firstName: pick(FIRST_NAMES), lastName: pick(LAST_NAMES) };
}

export function randomEmail(firstName: string, lastName: string, domain = 'example.com'): string {
  const n = randInt(1, 99);
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${n}@${domain}`;
}

export const CATEGORIES = [
  'Design & Productivity', 'Fitness', 'Business', 'Photography', 'Music',
  'Writing', 'Marketing', 'Education', 'Wellness', 'Tech',
];

export const PRODUCT_TITLES = [
  'Starter Template Pack', 'Ultimate Planner', 'Launch Playbook', 'Content Calendar Kit',
  'Brand Style Guide', 'Social Media Bundle', 'Email Swipe File', 'Pricing Worksheet',
  'Client Onboarding Kit', 'Weekly Review Template', 'Goal Setting Workbook', 'Pitch Deck Template',
];

export const COURSE_TITLES = [
  'Launch Your First Offer', 'Grow Your Audience', 'Pricing with Confidence',
  'Content That Converts', 'Build a Mini-Course', 'Email List from Zero',
];

export const BOOKING_TITLES = [
  '30-min Strategy Call', '45-min Coaching Session', 'Quick Audit', 'Office Hours',
  'Discovery Call', 'Portfolio Review',
];

export const LANDING_HEADLINES = [
  'Limited-time offer — grab it now', 'Exclusive deal for subscribers',
  'Early access ends soon', 'Bundle & save this week', 'VIP launch pricing',
];

export const THEME_PRESETS = [
  { background: '#faf5ff', accent: '#7c3aed', accent2: '#ec4899', fontPair: 'poppins' },
  { background: '#f0fdf4', accent: '#059669', accent2: '#14b8a6', fontPair: 'inter' },
  { background: '#fff7ed', accent: '#ea580c', accent2: '#f59e0b', fontPair: 'dm-sans' },
  { background: '#eff6ff', accent: '#2563eb', accent2: '#6366f1', fontPair: 'inter' },
  { background: '#fdf2f8', accent: '#db2777', accent2: '#a855f7', fontPair: 'poppins' },
];

/** Mon–Fri, 9am–5pm local — used for demo booking availability. */
export function standardWeeklyWindows(weekdays = [1, 2, 3, 4, 5]) {
  return weekdays.map((weekday) => ({
    weekday,
    startMinute: 9 * 60,
    endMinute: 17 * 60,
  }));
}

export const COVER_IMAGES = [
  'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1434030214721-735b608f0d0f?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=400&fit=crop',
];

export const AVATARS = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop',
];
