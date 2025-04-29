document.addEventListener('DOMContentLoaded', () => {
    // DOM-Elemente
    const catalogContainer = document.getElementById('catalog-container');
    const categoryFilter = document.getElementById('category');
    const priceFilter = document.getElementById('price');
    const priceDisplay = document.getElementById('price-display');
    const applyFiltersBtn = document.getElementById('apply-filters');
    const resetFiltersBtn = document.getElementById('reset-filters');
    const modal = document.getElementById('item-details-modal');
    const closeModal = document.querySelector('.close-modal');
    const itemDetails = document.getElementById('item-details');
    
    // API-Endpunkt
    const API_URL = `localhost:${process.env.PORT}/api/catalog`;
    console.log(API_URL)

    // Variablen für Katalogdaten und Filter
    let catalogItems = [];
    let categories = new Set();
    let currentFilters = {
      category: '',
      maxPrice: 1000
    };
    
    // Katalogdaten laden
    async function fetchCatalogData() {
      try {
        const response = await fetch(API_URL);
        if (!response.ok) {
          throw new Error('Netzwerkantwort war nicht OK');
        }
        
        catalogItems = await response.json();
        
        // Kategorien aus den Daten extrahieren
        catalogItems.forEach(item => {
          if (item.category) {
            categories.add(item.category);
          }
        });
        
        // Filter-Optionen füllen
        populateFilters();
        
        // Katalog anzeigen
        renderCatalog(catalogItems);
        
      } catch (error) {
        console.error('Fehler beim Laden der Katalogdaten:', error);
        catalogContainer.innerHTML = '<div class="error">Fehler beim Laden der Daten. Bitte versuchen Sie es später erneut.</div>';
      }
    }
    
    // Filter-Optionen aus den Daten füllen
    function populateFilters() {
      // Kategorien hinzufügen
      categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
      });
      
      // Event-Listener für den Preis-Slider
      priceFilter.addEventListener('input', () => {
        priceDisplay.textContent = `${priceFilter.value} €`;
      });
    }
    
    // Katalog mit gefilterten Elementen rendern
    function renderCatalog(items) {
      catalogContainer.innerHTML = '';
      
      if (items.length === 0) {
        catalogContainer.innerHTML = '<div class="no-results">Keine Ergebnisse gefunden.</div>';
        return;
      }
      
      items.forEach(item => {
        const catalogItem = document.createElement('div');
        catalogItem.className = 'catalog-item';
        catalogItem.dataset.id = item.id;
        
        catalogItem.innerHTML = `
          <img src="${item.imageUrl || '/images/placeholder.jpg'}" alt="${item.name}">
          <div class="catalog-item-content">
            <h3>${item.name}</h3>
            <p>${item.shortDescription || ''}</p>
            <p class="item-price">${item.price} €</p>
          </div>
        `;
        
        // Event-Listener für Klick auf Katalogelement
        catalogItem.addEventListener('click', () => {
          showItemDetails(item);
        });
        
        catalogContainer.appendChild(catalogItem);
      });
    }
    
    // Filter anwenden
    function applyFilters() {
      currentFilters.category = categoryFilter.value;
      currentFilters.maxPrice = parseInt(priceFilter.value);
      
      const filteredItems = catalogItems.filter(item => {
        const matchesCategory = !currentFilters.category || item.category === currentFilters.category;
        const matchesPrice = item.price <= currentFilters.maxPrice;
        
        return matchesCategory && matchesPrice;
      });
      
      renderCatalog(filteredItems);
    }
    
    // Filter zurücksetzen
    function resetFilters() {
      categoryFilter.value = '';
      priceFilter.value = 1000;
      priceDisplay.textContent = '1000 €';
      
      currentFilters = {
        category: '',
        maxPrice: 1000
      };
      
      renderCatalog(catalogItems);
    }
    
    // Detailansicht eines Elements anzeigen
    function showItemDetails(item) {
      itemDetails.innerHTML = `
        <div class="item-details-image">
          <img src="${item.imageUrl || '/images/placeholder.jpg'}" alt="${item.name}">
        </div>
        <div class="item-details-info">
          <h2>${item.name}</h2>
          <p class="item-price">${item.price} €</p>
          <p class="item-category">Kategorie: ${item.category}</p>
          <div class="item-description">
            ${item.description || item.shortDescription || 'Keine Beschreibung verfügbar.'}
          </div>
          <div class="item-properties">
            ${renderItemProperties(item)}
          </div>
        </div>
      `;
      
      // Modal anzeigen
      modal.style.display = 'block';
    }
    
    // Eigenschaften des Elements als HTML rendern
    function renderItemProperties(item) {
      if (!item.properties || Object.keys(item.properties).length === 0) {
        return '';
      }
      
      let propertiesHtml = '<h3>Eigenschaften</h3><ul>';
      
      for (const [key, value] of Object.entries(item.properties)) {
        propertiesHtml += `<li><strong>${key}:</strong> ${value}</li>`;
      }
      
      propertiesHtml += '</ul>';
      return propertiesHtml;
    }
    
    // Modal schließen
    function closeItemDetails() {
      modal.style.display = 'none';
    }
    
    // Event-Listener
    applyFiltersBtn.addEventListener('click', applyFilters);
    resetFiltersBtn.addEventListener('click', resetFilters);
    closeModal.addEventListener('click', closeItemDetails);
    
    // Modal schließen, wenn außerhalb geklickt wird
    window.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeItemDetails();
      }
    });
    
    // Beim Laden der Seite Katalogdaten abrufen
    fetchCatalogData();
  });