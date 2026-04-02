require("dotenv").config();


const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

const corsOptions = {
  origin: [
    "http://localhost:9292",
    "http://localhost:5173",
    "http://localhost:3000",
    "https://bauvabhaikidukan.myshopify.com",
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json());

console.log("TOKEN:", process.env.STORE_FRONT_TOKEN);
console.log("DOMAIN:", process.env.SHOPIFY_STORE_DOMAIN);
// ✅ IMPORTANT: Read DB inside request (not at top level for Vercell)
const getDB = () => {
  const filePath = path.join(process.cwd(), 'database', 'db.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

const GQL_UPDATE_DIAMOND_VARIANT = `
  mutation UpdateVariant($productId: ID!, $variantId: ID!, $price: Money!, $sku: String!) {
    productVariantsBulkUpdate(
      productId: $productId
      variants: [{
        id: $variantId
        price: $price
        optionValues: [{ optionName: "SKU", name: $sku }]
        inventoryPolicy: CONTINUE
        inventoryItem: { tracked: false, sku: $sku }
      }]
    ) {
      productVariants {
        id
        title
        legacyResourceId
        availableForSale
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const GQL_CREATE_SKU_OPTION = `
  mutation CreateSkuOption($productId: ID!, $options: [OptionCreateInput!]!, $variantStrategy: ProductOptionCreateVariantStrategy) {
    productOptionsCreate(
      productId: $productId
      options: $options
      variantStrategy: $variantStrategy
    ) {
      product {
        id
        options {
          id
          name
          values
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

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
    shape,
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
  // const SHAPE = ["EMERALD","SQUARE RADIANT","RADIANT","PRINCESS","PEAR","OVAL","MINER","ROUND","ASSCHER","HEART","MARQUISE"]  
  const COLORS = ["L", "K", "J", "I", "H", "G", "F", "E", "D"];
  const CLARITY = ["SI2", "SI1", "VS2", "VS1", "VVS2", "VVS1", "IF", "FL"];
  const POLISH = ["ID", "EX", "VG", "GD", "FR"];
  const SYM = ["ID", "EX", "VG", "GD", "FR"];
  const FLUOR = ["NON", "FNT", "MED", "STG"];

  let results = db.diamonds;

  if (shape?.name) {
    results = results.filter(
      d => String(d.shape).toUpperCase() === String(shape.name).toUpperCase()
    );
  }


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
                      id
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

      // 🔥 ADD THIS
      variantId: product.variants.nodes[0]?.id || null,
    };

    res.json(formatted);

  } catch (err) {
    console.error("Single Product Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/create-diamond", async (req, res) => {
  try {
    const { diamond } = req.body;

    if (!diamond) {
      return res.status(400).json({ error: "Missing diamond " });
    }

    const title = ` ${diamond.carat}ct ${diamond.shape} Diamond`;

    const totalPrice = Number(diamond.price || 0);

    const endpoint = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2026-01/graphql.json`;

    const headers = {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
    };

    /* -------------------------------------------------- */
    /* 1️⃣ CHECK IF VARIANT ALREADY EXISTS                */
    /* -------------------------------------------------- */

    const searchProductResponse = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `
            query ($query: String!) {
              productVariants(first:1, query:$query) {
                nodes {
                  id
                  product {
                    id
                  }
                }
              }
            }
          `,
        variables: {
          query: `sku:${diamond.sku}`,
        },
      }),
    });

    const existingData = await searchProductResponse.json();

    const existingVariant =
      existingData?.data?.productVariants?.nodes?.[0];

    if (existingVariant) {
      return res.json({
        variantId: existingVariant.id,
      });
    }

    /* -------------------------------------------------- */
    /* 2️⃣ CREATE PRODUCT                                 */
    /* -------------------------------------------------- */

    const createProductResponse = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `
            mutation productCreate($product: ProductCreateInput!) {
              productCreate(product: $product) {
                product {
                  id
                  variants(first:1){
                    nodes{
                      id
                      
                    }
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
        variables: {
          product: {
            title: title,
            descriptionHtml: `
                <strong>Diamond:</strong> ${diamond.shape} ${diamond.carat}ct<br/>
                Color: ${diamond.color}<br/>
                Clarity: ${diamond.clarity}<br/>
                Certificate: ${diamond.sku}
              `,
            vendor: "Diamond",
            productType: "Diamond",
            tags: ["diamond"],
            status: "ACTIVE",
          },

        },
      }),
    });

    const productData = await createProductResponse.json();

    if (
      productData.errors ||
      productData?.data?.productCreate?.userErrors?.length
    ) {
      return res.status(500).json(productData);
    }

    const productId = productData.data.productCreate.product.id;
    const variantId = productData.data.productCreate.product.variants.nodes[0].id;

    const createOptionResponse = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: GQL_CREATE_SKU_OPTION,
        variables: {
          productId,
          options: [
            {
              name: "SKU",
              values: [{ name: diamond.sku }],
            },
          ],
          variantStrategy: "LEAVE_AS_IS",
        },
      }),
    });

    const createOptionData = await createOptionResponse.json();

    if (
      createOptionData.errors ||
      createOptionData?.data?.productOptionsCreate?.userErrors?.length
    ) {
      return res.status(500).json(createOptionData);
    }

    const updateVariantResponse = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: GQL_UPDATE_DIAMOND_VARIANT,
        variables: {
          productId,
          variantId,
          sku: diamond.sku,
          price: totalPrice.toString(),
        },
      }),
    });

    const updateVariantData = await updateVariantResponse.json();

    if (
      updateVariantData.errors ||
      updateVariantData?.data?.productVariantsBulkUpdate?.userErrors?.length
    ) {
      return res.status(500).json(updateVariantData);
    }

    /* 4️⃣ ADD PRODUCT IMAGES                             */
    /* -------------------------------------------------- */

    const mediaInputs = [];

    if (diamond?.image) {
      mediaInputs.push({
        originalSource: diamond.image,
        mediaContentType: "IMAGE",
      });
    }

    if (mediaInputs.length > 0) {
      const mediaResponse = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: `
          mutation CreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
            productCreateMedia(productId: $productId, media: $media) {
              media {
                alt
                mediaContentType
                status
              }
              mediaUserErrors {
                field
                message
              }
            }
          }
        `,
          variables: {
            productId,
            media: mediaInputs,
          },
        }),
      });

      const mediaData = await mediaResponse.json();

      if (
        mediaData.errors ||
        mediaData?.data?.productCreateMedia?.mediaUserErrors?.length
      ) {
        console.log("Media upload error:", mediaData);

        return res.status(500).json({
          error: "Media upload failed",
          details: mediaData,
        });
      }
    }

    /* -------------------------------------------------- */
    /* 5️⃣ RETURN VARIANT ID                              */
    /* -------------------------------------------------- */

    res.json({ variantId });

  } catch (err) {
    console.error("Create Diamond Error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
