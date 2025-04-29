const express = require('express');
const router = express.Router();

// Beispieldaten (später könnte dies aus einer Datenbank kommen)
let catalogData = [
  {
    id: 1,
    Case: "Produkt 1",
    Issue: "Elektronik",
    Economic: 499.99,
    Socio: "Ein tolles elektronisches Gerät",
    Ecologic: "Dies ist eine ausführliche Beschreibung des Produkts mit allen Details.",
  },
  {
    id: 2,
    name: "Produkt 2",
    category: "Möbel",
    price: 299.99,
    shortDescription: "Ein bequemes Möbelstück",
    description: "Detaillierte Beschreibung des Möbelstücks.",
    imageUrl: "/images/product2.jpg",
    properties: {
      "Material": "Holz",
      "Farbe": "Braun",
      "Maße": "120 x 80 x 75 cm"
    }
  },
];

// Alle Katalogeinträge abrufen
router.get('/', (req, res) => {
  res.json(catalogData);
});

// Einzelnen Katalogeintrag abrufen
router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const item = catalogData.find(item => item.id === id);
  
  if (item) {
    res.json(item);
  } else {
    res.status(404).json({ message: "Eintrag nicht gefunden" });
  }
});

// Neuen Katalogeintrag hinzufügen
router.post('/', (req, res) => {
  const newItem = req.body;
  newItem.id = catalogData.length + 1;
  
  catalogData.push(newItem);
  res.status(201).json(newItem);
});

// Katalogeintrag aktualisieren
router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const updatedItem = req.body;
  
  const index = catalogData.findIndex(item => item.id === id);
  
  if (index !== -1) {
    catalogData[index] = { ...catalogData[index], ...updatedItem };
    res.json(catalogData[index]);
  } else {
    res.status(404).json({ message: "Eintrag nicht gefunden" });
  }
});

// Katalogeintrag löschen
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  
  const index = catalogData.findIndex(item => item.id === id);
  
  if (index !== -1) {
    const deletedItem = catalogData.splice(index, 1);
    res.json(deletedItem[0]);
  } else {
    res.status(404).json({ message: "Eintrag nicht gefunden" });
  }
});

module.exports = router;