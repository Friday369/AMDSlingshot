/**
 * NutriFlow — Smart Food Ordering Web App
 * =========================================
 * Backend : Node.js + Express 5 + better-sqlite3 + Nunjucks
 * Algorithm: NutriScore™ (0-100) — weighted multi-factor health scoring
 * Background Engine: setInterval-based daemon that recalculates scores every 60s
 */

'use strict';

const express  = require('express');
const nunjucks = require('nunjucks');
const Database = require('better-sqlite3');
const path     = require('path');

// ---------------------------------------------------------------------------
// App Setup
// ---------------------------------------------------------------------------
const app = express();
const db  = new Database(path.join(__dirname, 'nutriflow.db'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Nunjucks templating (Jinja2-compatible syntax)
nunjucks.configure(path.join(__dirname, 'templates'), {
  autoescape: true,
  express:    app,
  watch:      false,
});
app.set('view engine', 'html');

// ---------------------------------------------------------------------------
// Database Bootstrap
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS food_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    emoji      TEXT    DEFAULT '🍽️',
    calories   REAL    NOT NULL,
    protein    REAL    NOT NULL,
    sugar      REAL    NOT NULL,
    fiber      REAL    NOT NULL,
    nutriscore REAL    DEFAULT 0,
    category   TEXT    DEFAULT 'General',
    goal_tags  TEXT    DEFAULT ''
  );
`);

// ---------------------------------------------------------------------------
// Seed Data — 10 Food Items
// ---------------------------------------------------------------------------
const FOOD_DATA = [
  { name: 'Grilled Salmon',          emoji: '🐟', calories: 367, protein: 40,  sugar: 0,   fiber: 0,    category: 'Protein',      goal_tags: 'Weight Loss,Energy Boost' },
  { name: 'Quinoa Bowl',             emoji: '🥗', calories: 222, protein: 8,   sugar: 3.5, fiber: 5,    category: 'Grain',        goal_tags: 'Weight Loss,Energy Boost,Balanced Diet' },
  { name: 'Avocado Toast',           emoji: '🥑', calories: 290, protein: 6.5, sugar: 1.2, fiber: 7,    category: 'Healthy Fat',  goal_tags: 'Weight Loss,Balanced Diet' },
  { name: 'Greek Yogurt Parfait',    emoji: '🍨', calories: 180, protein: 15,  sugar: 12,  fiber: 2,    category: 'Dairy',        goal_tags: 'Energy Boost,Balanced Diet' },
  { name: 'Chicken & Veggie Stir-Fry', emoji: '🍳', calories: 310, protein: 32, sugar: 4, fiber: 4.5,  category: 'Protein',      goal_tags: 'Weight Loss,Energy Boost' },
  { name: 'Lentil Soup',             emoji: '🍲', calories: 230, protein: 18,  sugar: 2,   fiber: 15.5, category: 'Legume',       goal_tags: 'Weight Loss,Balanced Diet' },
  { name: 'Berry Smoothie Bowl',     emoji: '🫐', calories: 260, protein: 7,   sugar: 22,  fiber: 6,    category: 'Fruit',        goal_tags: 'Energy Boost' },
  { name: 'Oatmeal with Nuts',       emoji: '🌾', calories: 350, protein: 10,  sugar: 5,   fiber: 8,    category: 'Grain',        goal_tags: 'Energy Boost,Balanced Diet' },
  { name: 'Veggie Buddha Bowl',      emoji: '🥙', calories: 195, protein: 9,   sugar: 6,   fiber: 10,   category: 'Vegetable',    goal_tags: 'Weight Loss,Balanced Diet' },
  { name: 'Egg White Omelette',      emoji: '🥚', calories: 120, protein: 22,  sugar: 1,   fiber: 1.5,  category: 'Protein',      goal_tags: 'Weight Loss,Energy Boost' },
];

// ---------------------------------------------------------------------------
// NutriScore™ Algorithm  (0-100)
// ---------------------------------------------------------------------------
/**
 * Weighted multi-factor scoring:
 *   Positive contributors : protein (×0.35) + fiber (×0.20)
 *   Negative contributors : calories (×0.25) + sugar (×0.20)
 * Passed through a sigmoid to keep top scores feeling earned.
 */
function calculateNutriScore(calories, protein, sugar, fiber) {
  const calScore     = Math.max(0, 1 - (calories - 100) / 600);
  const proteinScore = Math.min(1, protein / 50);
  const sugarScore   = Math.max(0, 1 - sugar / 50);
  const fiberScore   = Math.min(1, fiber / 20);

  const raw = 0.25 * calScore + 0.35 * proteinScore + 0.20 * sugarScore + 0.20 * fiberScore;

  // Sigmoid smoothing
  const score = 100 / (1 + Math.exp(-10 * (raw - 0.5))) * 2;
  return Math.min(100, Math.max(0, Math.round(score * 10) / 10));
}

// ---------------------------------------------------------------------------
// Seed DB on startup
// ---------------------------------------------------------------------------
function seedDatabase() {
  const count = db.prepare('SELECT COUNT(*) as c FROM food_items').get().c;
  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO food_items (name, emoji, calories, protein, sugar, fiber, nutriscore, category, goal_tags)
      VALUES (@name, @emoji, @calories, @protein, @sugar, @fiber, @nutriscore, @category, @goal_tags)
    `);
    const insertMany = db.transaction((items) => {
      for (const item of items) {
        item.nutriscore = calculateNutriScore(item.calories, item.protein, item.sugar, item.fiber);
        insert.run(item);
      }
    });
    insertMany(FOOD_DATA);
    console.log('[NutriFlow] ✅ Database seeded with 10 food items');
  }
}

// ---------------------------------------------------------------------------
// Background Scoring Engine  (runs every 60 seconds)
// ---------------------------------------------------------------------------
function startBackgroundEngine() {
  console.log('[NutriFlow BG Engine] ✅ Started — recalculating NutriScores every 60s');
  setInterval(() => {
    try {
      const items = db.prepare('SELECT * FROM food_items').all();
      const update = db.prepare('UPDATE food_items SET nutriscore = ? WHERE id = ?');
      const recalcAll = db.transaction(() => {
        for (const item of items) {
          const score = calculateNutriScore(item.calories, item.protein, item.sugar, item.fiber);
          update.run(score, item.id);
        }
      });
      recalcAll();
      console.log(`[NutriFlow BG Engine] ♻️  NutriScores recalculated at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error('[NutriFlow BG Engine] Error:', err.message);
    }
  }, 60_000);
}

// ---------------------------------------------------------------------------
// Helper — format item for JSON/template
// ---------------------------------------------------------------------------
function formatItem(item) {
  return {
    ...item,
    nutriscore: Math.round(item.nutriscore * 10) / 10,
    goal_tags:  item.goal_tags ? item.goal_tags.split(',').map(t => t.trim()) : [],
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** GET / — Main dashboard */
app.get('/', (req, res) => {
  const rows  = db.prepare('SELECT * FROM food_items ORDER BY nutriscore DESC').all();
  const items = rows.map(formatItem);
  res.render('index.html', { items, top_score: items[0]?.nutriscore ?? 0 });
});

/** POST /recommend — Filter by health goal */
app.post('/recommend', (req, res) => {
  const goal = (req.body.goal || '').trim();
  if (!goal) return res.status(400).json({ error: 'Goal is required.' });

  const rows = db.prepare('SELECT * FROM food_items ORDER BY nutriscore DESC').all();
  const matched = rows
    .filter(r => r.goal_tags.toLowerCase().includes(goal.toLowerCase()))
    .map(formatItem);

  if (!matched.length) {
    return res.status(404).json({ error: `No items found for goal: ${goal}` });
  }
  res.json({ goal, count: matched.length, items: matched });
});

/** GET /api/items — All items as JSON */
app.get('/api/items', (req, res) => {
  const rows = db.prepare('SELECT * FROM food_items ORDER BY nutriscore DESC').all();
  res.json(rows.map(formatItem));
});

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 5000;

seedDatabase();
startBackgroundEngine();

app.listen(PORT, () => {
  console.log(`\n🌿 NutriFlow is running → http://localhost:${PORT}`);
  console.log('   Press Ctrl+C to stop\n');
});
