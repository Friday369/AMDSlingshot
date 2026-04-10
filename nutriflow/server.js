'use strict';

const express  = require('express');
const nunjucks = require('nunjucks');
const Database = require('better-sqlite3');
const path     = require('path');

// ── App Setup ──────────────────────────────────────────────────────────────
const app = express();
const db  = new Database(path.join(__dirname, 'nutriflow.db'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

nunjucks.configure(path.join(__dirname, 'templates'), {
  autoescape: true,
  express:    app,
  watch:      false,
});
app.set('view engine', 'html');

// ── Database Tables ────────────────────────────────────────────────────────
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

  CREATE TABLE IF NOT EXISTS cart_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    food_id    INTEGER NOT NULL UNIQUE,
    name       TEXT    NOT NULL,
    emoji      TEXT    DEFAULT '🍽️',
    calories   REAL    NOT NULL,
    protein    REAL    NOT NULL,
    sugar      REAL    NOT NULL,
    fiber      REAL    NOT NULL,
    nutriscore REAL    DEFAULT 0,
    quantity   INTEGER DEFAULT 1,
    added_at   TEXT    DEFAULT (datetime('now'))
  );
`);

// ── Seed Data ──────────────────────────────────────────────────────────────
const FOOD_DATA = [
  { name:'Grilled Salmon',           emoji:'🐟', calories:367, protein:40,  sugar:0,   fiber:0,    category:'Protein',     goal_tags:'Weight Loss,Energy Boost' },
  { name:'Quinoa Bowl',              emoji:'🥗', calories:222, protein:8,   sugar:3.5, fiber:5,    category:'Grain',       goal_tags:'Weight Loss,Energy Boost,Balanced Diet' },
  { name:'Avocado Toast',            emoji:'🥑', calories:290, protein:6.5, sugar:1.2, fiber:7,    category:'Healthy Fat', goal_tags:'Weight Loss,Balanced Diet' },
  { name:'Greek Yogurt Parfait',     emoji:'🍨', calories:180, protein:15,  sugar:12,  fiber:2,    category:'Dairy',       goal_tags:'Energy Boost,Balanced Diet' },
  { name:'Chicken & Veggie Stir-Fry',emoji:'🍳', calories:310, protein:32,  sugar:4,   fiber:4.5,  category:'Protein',     goal_tags:'Weight Loss,Energy Boost' },
  { name:'Lentil Soup',              emoji:'🍲', calories:230, protein:18,  sugar:2,   fiber:15.5, category:'Legume',      goal_tags:'Weight Loss,Balanced Diet' },
  { name:'Berry Smoothie Bowl',      emoji:'🫐', calories:260, protein:7,   sugar:22,  fiber:6,    category:'Fruit',       goal_tags:'Energy Boost' },
  { name:'Oatmeal with Nuts',        emoji:'🌾', calories:350, protein:10,  sugar:5,   fiber:8,    category:'Grain',       goal_tags:'Energy Boost,Balanced Diet' },
  { name:'Veggie Buddha Bowl',       emoji:'🥙', calories:195, protein:9,   sugar:6,   fiber:10,   category:'Vegetable',   goal_tags:'Weight Loss,Balanced Diet' },
  { name:'Egg White Omelette',       emoji:'🥚', calories:120, protein:22,  sugar:1,   fiber:1.5,  category:'Protein',     goal_tags:'Weight Loss,Energy Boost' },
];

// ── NutriScore Algorithm ───────────────────────────────────────────────────
function calcScore(calories, protein, sugar, fiber) {
  const raw = 0.25 * Math.max(0, 1 - (calories - 100) / 600)
            + 0.35 * Math.min(1, protein / 50)
            + 0.20 * Math.max(0, 1 - sugar / 50)
            + 0.20 * Math.min(1, fiber / 20);
  const score = 100 / (1 + Math.exp(-10 * (raw - 0.5))) * 2;
  return Math.min(100, Math.max(0, Math.round(score * 10) / 10));
}

// ── Seed DB ────────────────────────────────────────────────────────────────
function seedDatabase() {
  if (db.prepare('SELECT COUNT(*) as c FROM food_items').get().c === 0) {
    const ins = db.prepare(
      `INSERT INTO food_items (name,emoji,calories,protein,sugar,fiber,nutriscore,category,goal_tags)
       VALUES (@name,@emoji,@calories,@protein,@sugar,@fiber,@nutriscore,@category,@goal_tags)`
    );
    db.transaction(items => {
      for (const i of items) { i.nutriscore = calcScore(i.calories,i.protein,i.sugar,i.fiber); ins.run(i); }
    })(FOOD_DATA);
    console.log('[NutriFlow] ✅ Seeded 10 food items');
  }
}

// ── Background Engine ──────────────────────────────────────────────────────
function startBackgroundEngine() {
  console.log('[NutriFlow BG] ✅ Started — recalculating every 60s');
  setInterval(() => {
    try {
      const upd = db.prepare('UPDATE food_items SET nutriscore=? WHERE id=?');
      db.transaction(() => {
        for (const i of db.prepare('SELECT * FROM food_items').all())
          upd.run(calcScore(i.calories,i.protein,i.sugar,i.fiber), i.id);
      })();
      console.log(`[NutriFlow BG] ♻️  Recalculated at ${new Date().toLocaleTimeString()}`);
    } catch(e) { console.error('[NutriFlow BG] Error:', e.message); }
  }, 60_000);
}

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = item => ({
  ...item,
  nutriscore: Math.round(item.nutriscore * 10) / 10,
  goal_tags:  item.goal_tags ? item.goal_tags.split(',').map(t => t.trim()) : [],
});

function cartCount() {
  return db.prepare('SELECT COALESCE(SUM(quantity),0) as t FROM cart_items').get().t;
}

function cartData() {
  const rows = db.prepare('SELECT * FROM cart_items ORDER BY added_at ASC').all();
  const qty  = rows.reduce((s,i) => s + i.quantity, 0);
  return {
    items:         rows,
    itemCount:     qty,
    totalCalories: Math.round(rows.reduce((s,i) => s + i.calories * i.quantity, 0)),
    totalProtein:  +(rows.reduce((s,i) => s + i.protein  * i.quantity, 0)).toFixed(1),
    totalSugar:    +(rows.reduce((s,i) => s + i.sugar    * i.quantity, 0)).toFixed(1),
    totalFiber:    +(rows.reduce((s,i) => s + i.fiber    * i.quantity, 0)).toFixed(1),
    avgNutriScore: rows.length
      ? Math.round(rows.reduce((s,i) => s + i.nutriscore, 0) / rows.length * 10) / 10
      : 0,
  };
}

// ── Routes: Catalog ────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  const items = db.prepare('SELECT * FROM food_items ORDER BY nutriscore DESC').all().map(fmt);
  res.render('index.html', { items, cartCount: cartCount() });
});

app.post('/recommend', (req, res) => {
  const goal = (req.body.goal || '').trim();
  if (!goal) return res.status(400).json({ error:'Goal required.' });
  const matched = db.prepare('SELECT * FROM food_items ORDER BY nutriscore DESC').all()
    .filter(r => r.goal_tags.toLowerCase().includes(goal.toLowerCase()))
    .map(fmt);
  if (!matched.length) return res.status(404).json({ error:`No items for: ${goal}` });
  res.json({ goal, count: matched.length, items: matched });
});

app.get('/api/items', (req, res) => {
  res.json(db.prepare('SELECT * FROM food_items ORDER BY nutriscore DESC').all().map(fmt));
});

// ── Routes: Cart ───────────────────────────────────────────────────────────
app.get('/cart', (req, res) => {
  const data = cartData();
  res.render('cart.html', { ...data, cartCount: data.itemCount });
});

app.get('/api/cart', (req, res) => res.json(cartData()));

app.post('/cart/add', (req, res) => {
  const foodId = parseInt(req.body.food_id, 10);
  if (!foodId) return res.status(400).json({ error:'food_id required.' });
  const food = db.prepare('SELECT * FROM food_items WHERE id=?').get(foodId);
  if (!food) return res.status(404).json({ error:'Food not found.' });
  const exists = db.prepare('SELECT id FROM cart_items WHERE food_id=?').get(foodId);
  if (exists) {
    db.prepare('UPDATE cart_items SET quantity=quantity+1 WHERE food_id=?').run(foodId);
  } else {
    db.prepare(
      `INSERT INTO cart_items (food_id,name,emoji,calories,protein,sugar,fiber,nutriscore,quantity)
       VALUES (?,?,?,?,?,?,?,?,1)`
    ).run(food.id, food.name, food.emoji, food.calories, food.protein, food.sugar, food.fiber, food.nutriscore);
  }
  res.json({ success:true, message:`${food.name} added to cart!`, cartCount: cartCount() });
});

app.post('/cart/remove', (req, res) => {
  const foodId = parseInt(req.body.food_id, 10);
  const row = db.prepare('SELECT * FROM cart_items WHERE food_id=?').get(foodId);
  if (!row) return res.status(404).json({ error:'Not in cart.' });
  if (row.quantity > 1) db.prepare('UPDATE cart_items SET quantity=quantity-1 WHERE food_id=?').run(foodId);
  else                  db.prepare('DELETE FROM cart_items WHERE food_id=?').run(foodId);
  res.json({ success:true, cartCount: cartCount() });
});

app.post('/cart/delete', (req, res) => {
  const foodId = parseInt(req.body.food_id, 10);
  db.prepare('DELETE FROM cart_items WHERE food_id=?').run(foodId);
  res.json({ success:true, cartCount: cartCount() });
});

app.post('/cart/clear', (req, res) => {
  db.prepare('DELETE FROM cart_items').run();
  res.json({ success:true, cartCount:0 });
});

app.post('/cart/checkout', (req, res) => {
  const data = cartData();
  if (!data.itemCount) return res.status(400).json({ error:'Cart is empty.' });
  const orderId = `NF-${Date.now()}`;
  db.prepare('DELETE FROM cart_items').run();
  res.json({ success:true, orderId, message:'🎉 Order placed — enjoy your meal!', summary: data });
});

// ── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
seedDatabase();
startBackgroundEngine();
app.listen(PORT, () => {
  console.log(`\n🌿 NutriFlow → http://localhost:${PORT}\n`);
});
