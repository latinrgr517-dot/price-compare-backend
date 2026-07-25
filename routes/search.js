const express = require('express');
const router = express.Router();
const axios = require('axios');
const PRODUCTS = require('../data/products');
const STORES = require('../data/stores');
const { distanceMiles } = require('../utils/distance');

const SERPAPI_KEY = process.env.SERPAPI_KEY;

// Store name → emoji/color mapping for SerpAPI results
const STORE_META = {
  amazon: { emoji: '📦', color: '#FF9900' },
  walmart: { emoji: '🏪', color: '#0071CE' },
  'best buy': { emoji: '🔵', color: '#003087' },
  target: { emoji: '🎯', color: '#CC0000' },
  costco: { emoji: '🏢', color: '#005DAA' },
  ebay: { emoji: '🛒', color: '#E53238' },
  default: { emoji: '🏬', color: '#555555' },
};

function getStoreMeta(name) {
  const key = name.toLowerCase();
  for (const [k, v] of Object.entries(STORE_META)) {
    if (key.includes(k)) return { ...v, key: k };
  }
  return { ...STORE_META.default, key: 'other' };
}

// Parse price string like "$199.99" → 199.99
function parsePrice(str) {
  if (!str) return null;
  const match = str.replace(/,/g, '').match(/[\d.]+/);
  return match ? parseFloat(match[0]) : null;
}

// Fetch real prices from Google Shopping via SerpAPI
async function fetchRealPrices(query) {
  const url = 'https://serpapi.com/search.json';
  const { data } = await axios.get(url, {
    params: {
      engine: 'google_shopping',
      q: query,
      api_key: SERPAPI_KEY,
      num: 10,
    },
  });

  const items = data.shopping_results || [];

  // Group by product name, collect store prices
  const grouped = {};
  items.forEach((item) => {
    const name = item.title;
    const storeName = item.source || 'Unknown';
    const price = parsePrice(item.price);
    const link = item.link || '';
    const thumbnail = item.thumbnail || '';

    if (!price) return;

    if (!grouped[name]) {
      // Bug 16 fix: use stable hash of title instead of Math.random()
      const stableId = item.product_id || Buffer.from(name).toString('base64').slice(0, 16);
      grouped[name] = {
        id: stableId,
        name,
        thumbnail,
        category: 'All',
        description: item.snippet || name,
        emoji: '🛍️',
        storeResults: [],
      };
    }

    const meta = getStoreMeta(storeName);
    grouped[name].storeResults.push({
      store: meta.key,
      storeName,
      storeEmoji: meta.emoji,
      storeColor: meta.color,
      price,
      link,
      inStock: true,
      distance: 0,
      distanceMiles: '0.0',
    });
  });

  return Object.values(grouped);
}

// Enrich results with user distance data using mock store locations
function enrichWithDistance(results, userLat, userLng) {
  return results.map((product) => {
    const storeResults = product.storeResults.map((s) => {
      // Try to match to a known store location for distance calc
      const storeKey = Object.keys(STORES).find((k) => s.store.includes(k) || s.storeName.toLowerCase().includes(k));
      const storeData = storeKey ? STORES[storeKey] : null;
      const distance =
        userLat && userLng && storeData ? distanceMiles(userLat, userLng, storeData.latitude, storeData.longitude) : 0;

      return { ...s, distance, distanceMiles: distance.toFixed(1) };
    });

    // Sort by distance then price
    storeResults.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      return a.price - b.price;
    });

    const bestPrice = storeResults[0]?.price || null;
    const nearestStore = storeResults[0]?.storeName || null;
    const nearestDistance = storeResults[0]?.distanceMiles || null;

    return { ...product, storeResults, bestPrice, nearestStore, nearestDistance };
  });
}

// Fallback: filter mock data (used when no SERPAPI_KEY)
function searchMockData(query, category, userLat, userLng) {
  const q = query.toLowerCase().trim();
  let results = PRODUCTS.filter((p) => {
    const matchQuery =
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q);
    const matchCategory = category === 'All' || p.category === category;
    return matchQuery && matchCategory;
  });

  results = results.map((product) => {
    const storeResults = product.prices
      .filter((p) => p.inStock)
      .map((pricing) => {
        const store = STORES[pricing.store];
        // Bug 10 fix: guard unknown store keys
        if (!store) return null;
        const distance = userLat && userLng ? distanceMiles(userLat, userLng, store.latitude, store.longitude) : 0;
        return {
          store: pricing.store,
          storeName: store.name,
          storeEmoji: store.emoji,
          storeColor: store.color, // Bug 15 fix: include storeColor in mock path too
          price: pricing.price,
          distance,
          distanceMiles: distance.toFixed(1),
          inStock: true,
        };
      })
      .filter(Boolean) // remove nulls from unknown stores
      .sort((a, b) => a.distance - b.distance || a.price - b.price);

    return {
      id: product.id,
      name: product.name,
      emoji: product.emoji,
      category: product.category,
      description: product.description,
      bestPrice: storeResults[0]?.price || null,
      nearestStore: storeResults[0]?.storeName || null,
      nearestDistance: storeResults[0]?.distanceMiles || null,
      storeResults,
    };
  });

  results.sort((a, b) => (a.bestPrice || 999999) - (b.bestPrice || 999999));
  return results;
}

router.get('/search', async (req, res) => {
  const { query, category = 'All', lat, lng } = req.query;

  if (!query) return res.status(400).json({ error: 'Missing query parameter' });

  const userLat = lat ? parseFloat(lat) : null;
  const userLng = lng ? parseFloat(lng) : null;

  // Use real SerpAPI if key is set, otherwise fall back to mock data
  if (SERPAPI_KEY) {
    try {
      let results = await fetchRealPrices(query);
      results = enrichWithDistance(results, userLat, userLng);
      results.sort((a, b) => (a.bestPrice || 999999) - (b.bestPrice || 999999));

      return res.json({
        query,
        category,
        source: 'live',
        userLocation: userLat && userLng ? { latitude: userLat, longitude: userLng } : null,
        resultCount: results.length,
        results,
      });
    } catch (err) {
      console.error('SerpAPI error, falling back to mock data:', err.message);
    }
  }

  // Fallback to mock data
  const results = searchMockData(query, category, userLat, userLng);
  res.json({
    query,
    category,
    source: 'mock',
    userLocation: userLat && userLng ? { latitude: userLat, longitude: userLng } : null,
    resultCount: results.length,
    results,
  });
});

router.get('/search/:productId', (req, res) => {
  const { productId } = req.params;
  const { lat, lng } = req.query;

  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const userLat = lat ? parseFloat(lat) : null;
  const userLng = lng ? parseFloat(lng) : null;

  const storeResults = product.prices
    .map((pricing) => {
      const store = STORES[pricing.store];
      // Bug 11 fix: guard unknown store keys
      if (!store) return null;
      const distance = userLat && userLng ? distanceMiles(userLat, userLng, store.latitude, store.longitude) : 0;
      return {
        store: pricing.store,
        storeName: store.name,
        storeEmoji: store.emoji,
        storeColor: store.color,
        price: pricing.price,
        inStock: pricing.inStock,
        distance,
        distanceMiles: distance.toFixed(1),
      };
    })
    .filter(Boolean);

  res.json({
    product: {
      id: product.id,
      name: product.name,
      emoji: product.emoji,
      category: product.category,
      description: product.description,
    },
    userLocation: userLat && userLng ? { latitude: userLat, longitude: userLng } : null,
    storeResults: storeResults.sort((a, b) => {
      if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return a.price - b.price;
    }),
  });
});

module.exports = router;
