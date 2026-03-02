const fs = require("fs");

// Load DB
const data = JSON.parse(
  fs.readFileSync("./database/db.json", "utf8")
);

// ✅ Shopify-required headers (correct order)
const headers = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Vendor",
  "Product Category",
  "Type",
  "Tags",
  "Published",
  "Option1 Name",
  "Option1 Value",
  "Variant SKU",
  "Variant Inventory Tracker",
  "Variant Inventory Qty",
  "Variant Inventory Policy",
  "Variant Fulfillment Service",
  "Variant Price",
  "Image Src"
];

let csv = headers.join(",") + "\n";

// 🔥 Only use settings
data.settings.forEach(item => {

  const handle = item.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  // ✅ Remove empty + duplicate images
  const images = [
    item.image,
    item.additional_image_1,
    item.additional_image_2,
    item.additional_image_3,
    item.additional_image_4,
    item.additional_image_5
  ]
  .filter(img => img && img.trim() !== "")
  .filter((value, index, self) => self.indexOf(value) === index);

  images.forEach((img, index) => {

  if (index === 0) {
    // First row → full product data
    csv += [
      handle,
      `"${item.title}"`,
      "",
      "Ring Builder",
      "Jewelry",
      "Ring Setting",
      `"${item.ring_style}"`,
      "true",
      "Metal",
      item.metal,
      item.sku,
      "shopify",
      item.quantity,
      "deny",
      "manual",
      item.price,
      img
    ].join(",") + "\n";
  } else {
    // Additional images → only Handle + Image Src
    csv += [
      handle,
      "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", img
    ].join(",") + "\n";
  }

});
});

fs.writeFileSync("shopify-settings.csv", csv);

console.log("✅ Shopify Settings CSV Generated Successfully!");