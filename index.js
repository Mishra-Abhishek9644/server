require("dotenv").config();


const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

console.log("TOKEN:", process.env.STORE_FRONT_TOKEN);
console.log("DOMAIN:", process.env.SHOPIFY_STORE_DOMAIN);
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

app.get("/api/shopify/settings", async (req, res) => {
  try {
    const response = await fetch(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2026-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
        },
        body: JSON.stringify({
          query: `
            query {
              products(first: 50, query: "tag:solitaire") {
                nodes {
                  id
                  title
                  featuredImage {
                    url
                  }
                  priceRange {
                    minVariantPrice {
                      amount
                    }
                  }
                }
              }
            }
          `,
        }),
      }
    );

    const data = await response.json();

    if (data.errors) {
      return res.status(500).json(data);
    }

    const formatted = data.data.products.nodes.map((product) => ({
      id: product.id,
      title: product.title,
      image: product.featuredImage?.url || "",
      price: Number(product.priceRange?.minVariantPrice?.amount || 0),
    }));

    res.json(formatted);

  } catch (err) {
    console.error("Shopify Fetch Error:", err);
    res.status(500).json({ error: err.message });
  }
});

const buildShopifyQuery = ({ metal, minPrice, maxPrice }) => {
  const parts = ["tag:solitaire"];

  if (metal && metal.trim() !== "") {
    parts.push(`tag:${metal}`);
  }

  if (minPrice !== undefined) {
    parts.push(`price:>=${minPrice}`);
  }

  if (maxPrice !== undefined) {
    parts.push(`price:<=${maxPrice}`);
  }

  return parts.join(" AND ");
};

app.post("/api/shopify/settings/filter", async (req, res) => {
  try {
    const { metal, price } = req.body;

    const query = buildShopifyQuery({
      metal,
      minPrice: price?.[0],
      maxPrice: price?.[1],
    });

    const response = await fetch(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2026-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
        },
        body: JSON.stringify({
          query: `
            query getProducts($query: String!) {
              products(first: 50, query: $query) {
                nodes {
                  id
                  title
                  featuredImage {
                    url
                  }
                  priceRange {
                    minVariantPrice {
                      amount
                    }
                  }
                }
              }
            }
          `,
          variables: { query },
        }),
      }
    );

    const data = await response.json();

    const formatted = data.data.products.nodes.map((product) => ({
      id: product.id,
      title: product.title,
      image: product.featuredImage?.url || "",
      price: Number(product.priceRange?.minVariantPrice?.amount || 0),
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/shopify/settings/:id", async (req, res) => {
  console.log("CREATE RING ROUTE HIT");
  try {
    const numericId = req.params.id;

    // 🔥 Reconstruct Shopify GID properly
    const fullGid = `gid://shopify/Product/${numericId}`;

    const response = await fetch(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2026-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
        },
        body: JSON.stringify({
          query: `
            query getProduct($id: ID!) {
              product(id: $id) {
                id
                title
                productType
                vendor

                images(first: 10) {
                  nodes {
                    url
                  }
                }

                variants(first: 5) {
                  nodes {
                    sku
                    price
                  }
                }
              }
            }
          `,
          variables: { id: fullGid },
        }),
      }
    );

    const data = await response.json();

    if (data.errors || !data.data.product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const product = data.data.product;

    const formatted = {
      id: product.id,
      title: product.title,
      productType: product.productType,
      vendor: product.vendor,
      sku: product.variants.nodes[0]?.sku || "",
      price: Number(product.variants.nodes[0]?.price || 0),
      images: product.images.nodes.map((img) => img.url),
    };

    res.json(formatted);

  } catch (err) {
    console.error("Single Product Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ❌ REMOVE app.listen()
// ✅ EXPORT app instead
module.exports = app;