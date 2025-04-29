const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// API-Routen einbinden
const catalogRoutes = require('./routes/catalog');
app.use('/api/catalog', catalogRoutes);

// Statische Dateien aus dem client/public-Ordner bereitstellen
app.use(express.static('../client/public'));

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});