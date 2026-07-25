const express = require('express');
const router = express.Router();
const PRODUCTS = require('../data/products');
const STORES = require('../data/stores');
const { distanceMiles } = require('../utils/distance');

router.get('/search', (req, res) => {
  const { query, category = 'All', lat, lng } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  const userLat = lat ? parseFloat(lat) : null;
  const userLng = lng ? parseFloat(lng) : null;

  // Filter products by query and category
  const q = query.toLowerCase().trim();
  let results = PRODUCTS.filter((p) => {
    const matchQuery =
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q);

    const matchCategory = category === 'All' || p.category === category;

    return matchQuery && matchCategory;
  });

  // Enrich results with store distances and pricing
  results = results.map((product) => {
    const storeResults = product.prices
      .filter((p) => p.inStock)
      .map((pricing) => {
        const store = STORES[pricing.store];
        const distance = userLat && userLng ? distanceMiles(userLat, userLng, store.latitude, store.longitude) : 0;

        return {
          store: pricing.store,
          storeName: store.name,
          storeEmoji: store.emoji,
          address: store.address,
          price: pricing.price,
          distance,
          distanceMiles: distance.toFixed(1),
        };
      })
      .sort((a, b) => {
        // Sort by distance first, then price
        if (a.distance !== b.distance) return a.distance - b.distance;
        return a.price - b.price;
      });

    const bestPrice = storeResults.length > 0 ? storeResults[0].price : null;
    const nearestStore = storeResults.length > 0 ? storeResults[0].storeName : null;
    const nearestDistance = storeResults.length > 0 ? storeResults[0].distanceMiles : null;

    return {
      id: product.id,
      name: product.name,
      emoji: product.emoji,
      category: product.category,
      description: product.description,
      bestPrice,
      nearestStore,
      nearestDistance,
      storeResults,
    };
  });

  // Sort by best price overall
  results.sort((a, b) => (a.bestPrice || 999999) - (b.bestPrice || 999999));

  res.json({
    query,
    category,
    userLocation: userLat && userLng ? { latitude: userLat, longitude: userLng } : null,
    resultCount: results.length,
    results,
  });
});

router.get('/search/:productId', (req, res) => {
  const { productId } = req.params;
  const { lat, lng } = req.query;

  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const userLat = lat ? parseFloat(lat) : null;
  const userLng = lng ? parseFloat(lng) : null;

  const storeResults = product.prices.map((pricing) => {
    const store = STORES[pricing.store];
    const distance = userLat && userLng ? distanceMiles(userLat, userLng, store.latitude, store.longitude) : 0;

    return {
      store: pricing.store,
      storeName: store.name,
      storeEmoji: store.emoji,
      address: store.address,
      price: pricing.price,
      inStock: pricing.inStock,
      distance,
      distanceMiles: distance.toFixed(1),
    };
  });

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
