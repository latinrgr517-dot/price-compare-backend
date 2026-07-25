require('dotenv').config();
const express = require('express');
const cors = require('cors');
const searchRoutes = require('./routes/search');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api', searchRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🛒 Price Compare Backend running on http://localhost:${PORT}`);
  console.log(`Search endpoint: GET /api/search?query=...&lat=...&lng=...&category=...`);
});
