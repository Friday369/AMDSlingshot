# 🌿 NutriFlow — Smart Food Ordering Web App

> **AMD Slingshot Hackathon — Health & Food Track**

NutriFlow is an AI-powered smart food ordering platform that helps individuals make better food choices and build healthier eating habits through a proprietary **NutriScore™ algorithm**.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Friday369/AMDSlingshot)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🧬 **NutriScore™** | 0-100 score per meal based on calories, protein, sugar & fibre |
| ⚙️ **Background Engine** | `setInterval` daemon recalculates scores every 60 seconds |
| 💡 **Smart Nudge** | Highest-scoring item highlighted with animated glowing border |
| 🎯 **Goal Filtering** | POST `/recommend` returns meals matched to your health goal |
| 📱 **Responsive UI** | Glassmorphism dark-mode UI built with Tailwind CSS CDN |

---

## 🚀 Run Locally

```bash
# 1. Clone the repo
git clone https://github.com/Friday369/AMDSlingshot.git
cd AMDSlingshot/nutriflow

# 2. Install dependencies
npm install

# 3. Start the server
npm start
```

Visit **http://localhost:5000** in your browser.

---

## ☁️ Deploy to Render (Free — One Click)

1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your GitHub and select **Friday369/AMDSlingshot**
3. Render auto-detects `render.yaml` — just click **Deploy**
4. Your app is live at `https://nutriflow.onrender.com` 🎉

---

## 📁 Project Structure

```
AMDSlingshot/
├── render.yaml              ← Render.com deployment config
├── README.md
└── nutriflow/
    ├── server.js            ← Express backend + NutriScore algorithm
    ├── package.json
    ├── .gitignore
    └── templates/
        └── index.html       ← Tailwind CSS UI with Smart Nudge
```

---

## 🔌 API Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/` | Main dashboard — all food items by NutriScore |
| `POST` | `/recommend` | JSON `{ "goal": "Weight Loss" }` → filtered results |
| `GET` | `/api/items` | Raw JSON of all 10 food items |

### Example

```bash
curl -X POST https://nutriflow.onrender.com/recommend \
     -H "Content-Type: application/json" \
     -d '{"goal": "Weight Loss"}'
```

---

## 🧬 NutriScore™ Algorithm

```
raw = 0.25 × (1 − norm_calories)
    + 0.35 × norm_protein
    + 0.20 × (1 − norm_sugar)
    + 0.20 × norm_fiber

NutriScore = sigmoid(raw) × 100   →  range: 0–100
```

Recalculated every **60 seconds** by a background `setInterval` daemon.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24 |
| Framework | Express 5 |
| Database | SQLite via better-sqlite3 |
| Templates | Nunjucks (Jinja2-compatible) |
| Styling | Tailwind CSS (CDN) |
| Deployment | Render.com |

---

## 📜 License

MIT — Free for hackathon and educational use.