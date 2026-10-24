// Local development entry. On Vercel, api/index.js is used instead.
require('dotenv').config();
const app = require('./app');
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Isee API listening on http://localhost:${port}`));
