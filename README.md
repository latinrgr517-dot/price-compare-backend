# PriceCompare Backend API

Location-based price comparison backend for the PriceCompare Flutter app.

## Features
- Search products by name, category, or description
- Location-aware pricing (ranks stores by distance + price)
- Detailed store information with distances
- Mock product data (swap for real API later)

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Create `.env` file
```bash
cp .env.example .env
```

### 3. Run the server
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server runs on `http://localhost:3000`

## API Endpoints

### Search Products
```
GET /api/search?query=airpods&category=Electronics&lat=40.7128&lng=-74.0060
```

**Query Parameters:**
- `query` (required) - Product search term
- `category` (optional) - Filter by category (default: "All")
- `lat` (optional) - User latitude
- `lng` (optional) - User longitude

**Response:**
```json
{
  "query": "airpods",
  "category": "All",
  "userLocation": { "latitude": 40.7128, "longitude": -74.0060 },
  "resultCount": 1,
  "results": [
    {
      "id": "1",
      "name": "Apple AirPods Pro (2nd Gen)",
      "emoji": "🎧",
      "category": "Electronics",
      "bestPrice": 184.99,
      "nearestStore": "Costco",
      "nearestDistance": "10.5",
      "storeResults": [
        {
          "store": "costco",
          "storeName": "Costco",
          "price": 184.99,
          "distance": 10.5,
          "distanceMiles": "10.5"
        }
      ]
    }
  ]
}
```

### Get Product Details
```
GET /api/search/:productId?lat=40.7128&lng=-74.0060
```

**Response:**
```json
{
  "product": {
    "id": "1",
    "name": "Apple AirPods Pro (2nd Gen)",
    "emoji": "🎧",
    "category": "Electronics"
  },
  "userLocation": { "latitude": 40.7128, "longitude": -74.0060 },
  "storeResults": [
    {
      "store": "costco",
      "storeName": "Costco",
      "price": 184.99,
      "inStock": true,
      "distanceMiles": "10.5"
    }
  ]
}
```

### Health Check
```
GET /health
```

## Deploy to Heroku

```bash
# Install Heroku CLI first
heroku login
heroku create your-app-name
git push heroku main
heroku open
```

Then update the Flutter app to use:
```
PRICE_COMPARE_BACKEND_URL=https://your-app-name.herokuapp.com/api
```

## Next Steps: Connect Real APIs

Replace mock data with real price sources:
- **[Rainforest API](https://www.rainforestapi.com/)** - Amazon prices
- **[PriceAPI.io](https://www.priceapi.io/)** - Multi-store comparison
- **[Keepa](https://keepa.com/)** - Amazon price history

Example integration:
```javascript
const axios = require('axios');

async function getAmazonPrices(productName) {
  const response = await axios.get('https://api.rainforestapi.com/request', {
    params: {
      api_key: process.env.RAINFOREST_API_KEY,
      type: 'search',
      amazon_domain: 'amazon.com',
      search_term: productName,
    },
  });
  return response.data.products;
}
```

## Environment Variables

```bash
PORT=3000                          # Server port
NODE_ENV=development               # development or production
RAINFOREST_API_KEY=your_key        # For Amazon data
PRICEAPI_API_KEY=your_key          # For multi-store data
```
