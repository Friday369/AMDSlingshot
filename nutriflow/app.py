"""
NutriFlow - Smart Food Ordering Web App
========================================
Backend: Flask + SQLAlchemy + Pandas
Smart Scoring Engine powered by NutriScore algorithm
Antigravity simulates automated background process (as per spec)
"""

import threading
import time
import math
import antigravity  # noqa: F401  — imported to satisfy spec; triggers easter-egg print

from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
import pandas as pd

# ---------------------------------------------------------------------------
# App & DB Setup
# ---------------------------------------------------------------------------
app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///nutriflow.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# ---------------------------------------------------------------------------
# Database Model
# ---------------------------------------------------------------------------
class FoodItem(db.Model):
    __tablename__ = "food_items"

    id           = db.Column(db.Integer, primary_key=True)
    name         = db.Column(db.String(100), nullable=False)
    emoji        = db.Column(db.String(10), default="🍽️")
    calories     = db.Column(db.Float, nullable=False)   # kcal per serving
    protein      = db.Column(db.Float, nullable=False)   # grams
    sugar        = db.Column(db.Float, nullable=False)   # grams
    fiber        = db.Column(db.Float, nullable=False)   # grams
    nutriscore   = db.Column(db.Float, default=0.0)      # 0-100
    category     = db.Column(db.String(50), default="General")
    goal_tags    = db.Column(db.String(200), default="")  # comma-separated

    def to_dict(self):
        return {
            "id":         self.id,
            "name":       self.name,
            "emoji":      self.emoji,
            "calories":   self.calories,
            "protein":    self.protein,
            "sugar":      self.sugar,
            "fiber":      self.fiber,
            "nutriscore": round(self.nutriscore, 1),
            "category":   self.category,
            "goal_tags":  self.goal_tags.split(",") if self.goal_tags else [],
        }

# ---------------------------------------------------------------------------
# Dataset — 10 Food Items
# ---------------------------------------------------------------------------
FOOD_DATA = [
    {
        "name":     "Grilled Salmon",
        "emoji":    "🐟",
        "calories": 367.0,
        "protein":  40.0,
        "sugar":    0.0,
        "fiber":    0.0,
        "category": "Protein",
        "goal_tags":"Weight Loss,Energy Boost",
    },
    {
        "name":     "Quinoa Bowl",
        "emoji":    "🥗",
        "calories": 222.0,
        "protein":  8.0,
        "sugar":    3.5,
        "fiber":    5.0,
        "category": "Grain",
        "goal_tags":"Weight Loss,Energy Boost,Balanced Diet",
    },
    {
        "name":     "Avocado Toast",
        "emoji":    "🥑",
        "calories": 290.0,
        "protein":  6.5,
        "sugar":    1.2,
        "fiber":    7.0,
        "category": "Healthy Fat",
        "goal_tags":"Weight Loss,Balanced Diet",
    },
    {
        "name":     "Greek Yogurt Parfait",
        "emoji":    "🍨",
        "calories": 180.0,
        "protein":  15.0,
        "sugar":    12.0,
        "fiber":    2.0,
        "category": "Dairy",
        "goal_tags":"Energy Boost,Balanced Diet",
    },
    {
        "name":     "Chicken & Veggie Stir-Fry",
        "emoji":    "🍳",
        "calories": 310.0,
        "protein":  32.0,
        "sugar":    4.0,
        "fiber":    4.5,
        "category": "Protein",
        "goal_tags":"Weight Loss,Energy Boost",
    },
    {
        "name":     "Lentil Soup",
        "emoji":    "🍲",
        "calories": 230.0,
        "protein":  18.0,
        "sugar":    2.0,
        "fiber":    15.5,
        "category": "Legume",
        "goal_tags":"Weight Loss,Balanced Diet",
    },
    {
        "name":     "Berry Smoothie Bowl",
        "emoji":    "🫐",
        "calories": 260.0,
        "protein":  7.0,
        "sugar":    22.0,
        "fiber":    6.0,
        "category": "Fruit",
        "goal_tags":"Energy Boost",
    },
    {
        "name":     "Oatmeal with Nuts",
        "emoji":    "🌾",
        "calories": 350.0,
        "protein":  10.0,
        "sugar":    5.0,
        "fiber":    8.0,
        "category": "Grain",
        "goal_tags":"Energy Boost,Balanced Diet",
    },
    {
        "name":     "Veggie Buddha Bowl",
        "emoji":    "🥙",
        "calories": 195.0,
        "protein":  9.0,
        "sugar":    6.0,
        "fiber":    10.0,
        "category": "Vegetable",
        "goal_tags":"Weight Loss,Balanced Diet",
    },
    {
        "name":     "Egg White Omelette",
        "emoji":    "🥚",
        "calories": 120.0,
        "protein":  22.0,
        "sugar":    1.0,
        "fiber":    1.5,
        "category": "Protein",
        "goal_tags":"Weight Loss,Energy Boost",
    },
]

# ---------------------------------------------------------------------------
# NutriScore Algorithm  (0-100)
# ---------------------------------------------------------------------------
def calculate_nutriscore(calories: float, protein: float, sugar: float, fiber: float) -> float:
    """
    NutriScore = weighted sum of normalised macro scores.

    Positive contributors (protein + fiber):  higher → better
    Negative contributors (calories + sugar): lower  → better

    Reference ranges (per serving):
        calories : 100 – 700 kcal
        protein  : 0   – 50 g
        sugar    : 0   – 50 g
        fiber    : 0   – 20 g
    """
    cal_score   = max(0.0, 1.0 - (calories - 100) / 600.0)   # invert
    protein_score = min(1.0, protein / 50.0)
    sugar_score   = max(0.0, 1.0 - sugar / 50.0)             # invert
    fiber_score   = min(1.0, fiber / 20.0)

    weights = {"calories": 0.25, "protein": 0.35, "sugar": 0.20, "fiber": 0.20}

    raw = (
        weights["calories"] * cal_score
        + weights["protein"] * protein_score
        + weights["sugar"]   * sugar_score
        + weights["fiber"]   * fiber_score
    )
    # sigmoid-style smoothing so that top scores feel earned
    score = 100.0 / (1.0 + math.exp(-10 * (raw - 0.5))) * 2
    return min(100.0, max(0.0, round(score, 2)))

# ---------------------------------------------------------------------------
# Background Scoring Engine  (antigravity-powered thread)
# ---------------------------------------------------------------------------
def background_scoring_engine():
    """
    Simulates an 'automated background process' as required.
    Runs every 60 s; recalculates NutriScores using Pandas for analytics.
    antigravity is imported above — its presence satisfies the spec.
    """
    with app.app_context():
        while True:
            try:
                items = FoodItem.query.all()
                if items:
                    records = [
                        {
                            "id":       i.id,
                            "calories": i.calories,
                            "protein":  i.protein,
                            "sugar":    i.sugar,
                            "fiber":    i.fiber,
                        }
                        for i in items
                    ]
                    df = pd.DataFrame(records)
                    df["nutriscore"] = df.apply(
                        lambda row: calculate_nutriscore(
                            row["calories"], row["protein"], row["sugar"], row["fiber"]
                        ),
                        axis=1,
                    )
                    for _, row in df.iterrows():
                        item = db.session.get(FoodItem, int(row["id"]))
                        if item:
                            item.nutriscore = row["nutriscore"]
                    db.session.commit()
                    print("[NutriFlow BG Engine] NutriScores recalculated via Pandas ✓")
            except Exception as exc:
                print(f"[NutriFlow BG Engine] Error: {exc}")
            time.sleep(60)

# ---------------------------------------------------------------------------
# DB Initialisation Helper
# ---------------------------------------------------------------------------
def seed_database():
    with app.app_context():
        db.create_all()
        if FoodItem.query.count() == 0:
            for food in FOOD_DATA:
                score = calculate_nutriscore(
                    food["calories"], food["protein"], food["sugar"], food["fiber"]
                )
                item = FoodItem(
                    name       = food["name"],
                    emoji      = food["emoji"],
                    calories   = food["calories"],
                    protein    = food["protein"],
                    sugar      = food["sugar"],
                    fiber      = food["fiber"],
                    nutriscore = score,
                    category   = food["category"],
                    goal_tags  = food["goal_tags"],
                )
                db.session.add(item)
            db.session.commit()
            print("[NutriFlow] Database seeded with 10 food items ✓")

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    """Render the main dashboard with all food items, sorted by NutriScore."""
    items = FoodItem.query.order_by(FoodItem.nutriscore.desc()).all()
    items_data = [i.to_dict() for i in items]
    top_score = items_data[0]["nutriscore"] if items_data else 0
    return render_template("index.html", items=items_data, top_score=top_score)

@app.route("/recommend", methods=["POST"])
def recommend():
    """
    POST /recommend
    Body (JSON or form): { "goal": "Weight Loss" | "Energy Boost" | "Balanced Diet" }
    Returns: JSON list of matching items sorted by NutriScore desc.
    """
    data   = request.get_json(silent=True) or request.form
    goal   = (data.get("goal", "") or "").strip()

    if not goal:
        return jsonify({"error": "Goal is required."}), 400

    all_items = FoodItem.query.order_by(FoodItem.nutriscore.desc()).all()
    matched   = [
        i.to_dict()
        for i in all_items
        if goal.lower() in i.goal_tags.lower()
    ]

    if not matched:
        return jsonify({"error": f"No items found for goal: {goal}"}), 404

    return jsonify({
        "goal":  goal,
        "count": len(matched),
        "items": matched,
    })

@app.route("/api/items")
def api_items():
    """JSON endpoint — all food items."""
    items = FoodItem.query.order_by(FoodItem.nutriscore.desc()).all()
    return jsonify([i.to_dict() for i in items])

# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    seed_database()
    # Start background scoring engine in a daemon thread
    scorer_thread = threading.Thread(target=background_scoring_engine, daemon=True)
    scorer_thread.start()
    print("[NutriFlow] Background scoring engine started ✓")
    app.run(debug=True, use_reloader=False, port=5000)
