const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// ✅ IMPORTANT: Read DB inside request (not at top level for Vercel)
const getDB = () => {
  const filePath = path.join(process.cwd(), 'database', 'db.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

// Default route
app.get('/', (req, res) => {
  res.send('API Running...');
});

// GET all settings
app.get('/api/settings', (req, res) => {
  const db = getDB();
  res.json(db.settings);
});

// GET single setting
app.get('/api/settings/:id', (req, res) => {
  const db = getDB();
  const item = db.settings.find(s => s.id == req.params.id);
  res.json(item || {});
});

// GET all diamonds
app.get('/api/diamonds', (req, res) => {
  const db = getDB();
  res.json(db.diamonds);
});

// GET single diamond
app.get('/api/diamonds/:sku', (req, res) => {
  const db = getDB();
  const item = db.diamonds.find(d => d.sku == req.params.sku);
  res.json(item || {});
});

app.post("/api/diamonds/filter", (req, res) => {
  const db = getDB();

  const {
    carat,
    colorRange,
    clarityRange,
    price,
    polishRange,
    symRange,
    flourRange,
    depthRange,
    lwRange
  } = req.body;

  const COLORS = ["L", "K", "J", "I", "H", "G", "F", "E", "D"];
  const CLARITY = ["SI2","SI1","VS2","VS1","VVS2","VVS1","IF","FL"];
  const POLISH = ["ID", "EX", "VG", "GD", "FR"];
  const SYM = ["ID", "EX", "VG", "GD", "FR"];
  const FLUOR = ["NON", "FNT", "MED", "STG"];

  let results = db.diamonds;

  if (carat) {
    results = results.filter(d =>
      Number(d.carat) >= carat[0] &&
      Number(d.carat) <= carat[1]
    );
  }

  if (depthRange) {
    results = results.filter(d =>
      Number(d.depth) >= depthRange[0] &&
      Number(d.depth) <= depthRange[1]
    );
  }

  if (lwRange) {
    results = results.filter(d =>
      Number(d.length) >= lwRange[0] &&
      Number(d.length) <= lwRange[1]
    );
  }

  if (colorRange) {
    const allowed = COLORS.slice(colorRange[0], colorRange[1] + 1);
    results = results.filter(d => allowed.includes(d.color));
  }

  if (clarityRange) {
    const allowed = CLARITY.slice(clarityRange[0], clarityRange[1] + 1);
    results = results.filter(d => allowed.includes(d.clarity));
  }

  if (polishRange) {
    const allowed = POLISH.slice(polishRange[0], polishRange[1] + 1);
    results = results.filter(d => allowed.includes(d.polish));
  }

  if (symRange) {
    const allowed = SYM.slice(symRange[0], symRange[1] + 1);
    results = results.filter(d => allowed.includes(d.symmetry));
  }

  if (flourRange) {
    const allowed = FLUOR.slice(flourRange[0], flourRange[1] + 1);
    results = results.filter(d => allowed.includes(d.fluorescence));
  }

  if (price) {
    results = results.filter(d =>
      Number(d.price) >= price[0] &&
      Number(d.price) <= price[1]
    );
  }

  res.json(results);
});

app.post("/api/settings/filter", (req, res) => {
  const db = getDB();
  const { priceRangeSet, selectedMetalSet } = req.body;

  let results = db.settings;

  if (priceRangeSet) {
    results = results.filter(s =>
      Number(s.price) >= priceRangeSet[0] &&
      Number(s.price) <= priceRangeSet[1]
    );
  }

  if (selectedMetalSet?.description) {
    const metalName = selectedMetalSet.description;
    results = results.filter(s =>
      s.metal.toLowerCase().includes(metalName.toLowerCase())
    );
  }

  res.json(results);
});

// ❌ REMOVE app.listen()
// ✅ EXPORT app instead
module.exports = app;