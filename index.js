const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());      // allow frontend to access backend
app.use(express.json());

const port = 3000;

// Load db.json
const db = JSON.parse(fs.readFileSync('./database/db.json', 'utf8'));

// Default route
app.get('/', (req, res) => {
  res.send('API Running...');
});

// GET all settings
app.get('/api/settings', (req, res) => {
  res.json(db.settings);
});

// GET single setting
app.get('/api/settings/:id', (req, res) => {
  const item = db.settings.find(s => s.id == req.params.id);
  res.json(item || {});
});

// GET all diamonds
app.get('/api/diamonds', (req, res) => {
  res.json(db.diamonds);
});

// GET single diamond
app.get('/api/diamonds/:sku', (req, res) => {
  const item = db.diamonds.find(d => d.sku == req.params.sku);
  res.json(item || {});
});

app.post("/api/diamonds/filter", (req, res) => {
  const { carat, colorRange, clarityRange, price,polishRange,symRange,flourRange,depthRange,lwRange } = req.body;

  const COLORS = ["L", "K", "J", "I", "H", "G", "F", "E", "D"];
  const CLARITY = ["SI2","SI1","VS2","VS1","VVS2","VVS1","IF","FL"];

  const POLISH= ["ID", "EX", "VG", "GD", "FR"];
  const SYM = ["ID", "EX", "VG", "GD", "FR"];
  const FLUOR = ["NON", "FNT", "MED", "STG"];




  let results = db.diamonds;

  // ⭐ CARAT RANGE
  if (carat) {
    results = results.filter(d =>
      Number(d.carat) >= carat[0] && Number(d.carat) <= carat[1]
    );
  }

  if (depthRange) {
    results = results.filter(d =>
      Number(d.depth) >= depthRange[0] && Number(d.depth) <= depthRange[1]
    );
  }
  
  if (lwRange) {
    results = results.filter(d =>
      Number(d.length) >= lwRange[0] && Number(d.length) <= lwRange[1]
    );
  }

  // ⭐ COLOR RANGE (based on slider index)
  if (colorRange) {
    const [minIdx, maxIdx] = colorRange;
    const allowedColors = COLORS.slice(minIdx, maxIdx + 1);
    

    results = results.filter(d => allowedColors.includes(d.color));
  }

  // ⭐ CLARITY RANGE (based on slider index)
  if (clarityRange) {
    const [minIdx, maxIdx] = clarityRange;
    const allowedClarity = CLARITY.slice(minIdx, maxIdx + 1);

    results = results.filter(d => allowedClarity.includes(d.clarity));
  }

  if (polishRange) {
    const [minIdx, maxIdx] = polishRange;
    const allowedPolish = POLISH.slice(minIdx, maxIdx + 1);

    results = results.filter(d => allowedPolish.includes(d.polish));
  }

   if (symRange) {
    const [minIdx, maxIdx] = symRange;
    const allowedSym = SYM.slice(minIdx, maxIdx + 1);

    results = results.filter(d => allowedSym.includes(d.symmetry));
  }

  if (flourRange) {
    const [minIdx, maxIdx] = flourRange;
    const allowedFlour = FLUOR.slice(minIdx, maxIdx + 1);

    results = results.filter(d => allowedFlour.includes(d.fluorescence));
  }
  // ⭐ PRICE RANGE
  if (price) {
    results = results.filter(d =>
      Number(d.price) >= price[0] && Number(d.price) <= price[1]
    );
  }

  res.json(results);
});

app.post("/api/settings/filter", (req, res) => {
  const { priceRangeSet,selectedMetalSet } = req.body;

  let results = db.settings;  // ✅ FIXED — use settings

  if (priceRangeSet) {
    results = results.filter(s =>
      Number(s.price) >= priceRangeSet[0] &&
      Number(s.price) <= priceRangeSet[1]
    );
  }

  if (selectedMetalSet && selectedMetalSet.description) {
    const metalName = selectedMetalSet.description 
    // "White Gold 14k" → "White"

    results = results.filter(s =>
      s.metal.toLowerCase().includes(metalName.toLowerCase())
    );
  }

  
  res.json(results);
});


app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});