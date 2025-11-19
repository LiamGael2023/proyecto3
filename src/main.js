/**
 * GIS Viewer - Modern Leaflet Map Application
 * Features: Multiple base layers, drawing tools, measurements, geolocation
 */

import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet.locatecontrol';

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  defaultCenter: [40.416775, -3.703790], // Madrid, Spain
  defaultZoom: 6,
  minZoom: 2,
  maxZoom: 19,
  baseLayers: {
    osm: {
      name: 'OpenStreetMap',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    satellite: {
      name: 'Satélite',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; <a href="https://www.esri.com">Esri</a>'
    },
    terrain: {
      name: 'Terreno',
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
    },
    dark: {
      name: 'Oscuro',
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://carto.com">CARTO</a>'
    }
  }
};

// =============================================================================
// State Management
// =============================================================================

const state = {
  map: null,
  currentBaseLayer: null,
  baseLayers: {},
  drawnItems: null,
  drawControl: null,
  currentDrawTool: null,
  measureMode: false,
  theme: localStorage.getItem('gis-theme') || 'light',
  sidebarOpen: true
};

// =============================================================================
// Initialization
// =============================================================================

document.addEventListener('DOMContentLoaded', init);

function init() {
  initTheme();
  initMap();
  initBaseLayers();
  initDrawLayer();
  initEventListeners();
  initCoordinates();
  hideLoading();
  showToast('success', 'Bienvenido', 'Visor GIS cargado correctamente');
}

// =============================================================================
// Theme Management
// =============================================================================

function initTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  updateThemeIcon();
}

function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', state.theme);
  localStorage.setItem('gis-theme', state.theme);
  updateThemeIcon();
  showToast('info', 'Tema cambiado', `Modo ${state.theme === 'light' ? 'claro' : 'oscuro'} activado`);
}

function updateThemeIcon() {
  const icon = document.querySelector('#themeToggle i');
  if (icon) {
    icon.className = state.theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
  }
}

// =============================================================================
// Map Initialization
// =============================================================================

function initMap() {
  state.map = L.map('map', {
    center: CONFIG.defaultCenter,
    zoom: CONFIG.defaultZoom,
    minZoom: CONFIG.minZoom,
    maxZoom: CONFIG.maxZoom,
    zoomControl: false,
    attributionControl: true
  });

  // Add scale control
  L.control.scale({
    position: 'bottomleft',
    metric: true,
    imperial: false,
    maxWidth: 200
  }).addTo(state.map);
}

// =============================================================================
// Base Layers
// =============================================================================

function initBaseLayers() {
  Object.entries(CONFIG.baseLayers).forEach(([key, config]) => {
    state.baseLayers[key] = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: CONFIG.maxZoom
    });
  });

  // Set default layer
  state.baseLayers.osm.addTo(state.map);
  state.currentBaseLayer = 'osm';

  // Add event listeners for layer switching
  document.querySelectorAll('input[name="baseLayer"]').forEach(input => {
    input.addEventListener('change', (e) => {
      switchBaseLayer(e.target.value);
    });
  });
}

function switchBaseLayer(layerKey) {
  if (state.currentBaseLayer === layerKey) return;

  // Remove current layer
  if (state.baseLayers[state.currentBaseLayer]) {
    state.map.removeLayer(state.baseLayers[state.currentBaseLayer]);
  }

  // Add new layer
  state.baseLayers[layerKey].addTo(state.map);
  state.currentBaseLayer = layerKey;

  showToast('info', 'Capa cambiada', `${CONFIG.baseLayers[layerKey].name} activada`);
}

// =============================================================================
// Drawing Layer & Tools
// =============================================================================

function initDrawLayer() {
  state.drawnItems = new L.FeatureGroup();
  state.map.addLayer(state.drawnItems);

  // Configure draw options
  const drawOptions = {
    position: 'topright',
    draw: {
      polyline: {
        shapeOptions: {
          color: '#667eea',
          weight: 3
        }
      },
      polygon: {
        allowIntersection: false,
        shapeOptions: {
          color: '#667eea',
          fillColor: '#667eea',
          fillOpacity: 0.3
        }
      },
      circle: {
        shapeOptions: {
          color: '#667eea',
          fillColor: '#667eea',
          fillOpacity: 0.3
        }
      },
      rectangle: {
        shapeOptions: {
          color: '#667eea',
          fillColor: '#667eea',
          fillOpacity: 0.3
        }
      },
      marker: true,
      circlemarker: false
    },
    edit: {
      featureGroup: state.drawnItems,
      remove: true
    }
  };

  state.drawControl = new L.Control.Draw(drawOptions);
  // We don't add the default control, we use custom buttons

  // Handle draw events
  state.map.on(L.Draw.Event.CREATED, (e) => {
    const layer = e.layer;

    // Add popup with info
    if (e.layerType === 'marker') {
      const latlng = layer.getLatLng();
      layer.bindPopup(`
        <strong>Marcador</strong><br>
        Lat: ${latlng.lat.toFixed(6)}<br>
        Lng: ${latlng.lng.toFixed(6)}
      `);
    } else if (e.layerType === 'polyline') {
      const distance = calculateDistance(layer);
      layer.bindPopup(`
        <strong>Línea</strong><br>
        Distancia: ${formatDistance(distance)}
      `);
    } else if (e.layerType === 'polygon' || e.layerType === 'rectangle') {
      const area = calculateArea(layer);
      layer.bindPopup(`
        <strong>${e.layerType === 'polygon' ? 'Polígono' : 'Rectángulo'}</strong><br>
        Área: ${formatArea(area)}
      `);
    } else if (e.layerType === 'circle') {
      const radius = layer.getRadius();
      const area = Math.PI * radius * radius;
      layer.bindPopup(`
        <strong>Círculo</strong><br>
        Radio: ${formatDistance(radius)}<br>
        Área: ${formatArea(area)}
      `);
    }

    state.drawnItems.addLayer(layer);
    showToast('success', 'Elemento creado', `${e.layerType} añadido al mapa`);
  });

  state.map.on(L.Draw.Event.DELETED, () => {
    showToast('info', 'Elementos eliminados', 'Los elementos seleccionados han sido eliminados');
  });
}

function startDrawing(type) {
  // Cancel any existing drawing
  if (state.currentDrawTool) {
    state.currentDrawTool.disable();
  }

  let handler;
  switch (type) {
    case 'marker':
      handler = new L.Draw.Marker(state.map);
      break;
    case 'polyline':
      handler = new L.Draw.Polyline(state.map, {
        shapeOptions: { color: '#667eea', weight: 3 }
      });
      break;
    case 'polygon':
      handler = new L.Draw.Polygon(state.map, {
        shapeOptions: { color: '#667eea', fillColor: '#667eea', fillOpacity: 0.3 }
      });
      break;
    case 'circle':
      handler = new L.Draw.Circle(state.map, {
        shapeOptions: { color: '#667eea', fillColor: '#667eea', fillOpacity: 0.3 }
      });
      break;
    case 'rectangle':
      handler = new L.Draw.Rectangle(state.map, {
        shapeOptions: { color: '#667eea', fillColor: '#667eea', fillOpacity: 0.3 }
      });
      break;
  }

  if (handler) {
    handler.enable();
    state.currentDrawTool = handler;
    updateToolButtons(type);
  }
}

function updateToolButtons(activeType) {
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const buttonMap = {
    marker: 'drawMarker',
    polyline: 'drawLine',
    polygon: 'drawPolygon',
    circle: 'drawCircle',
    rectangle: 'drawRectangle'
  };

  if (buttonMap[activeType]) {
    document.getElementById(buttonMap[activeType])?.classList.add('active');
  }
}

function clearDrawings() {
  state.drawnItems.clearLayers();
  showToast('info', 'Mapa limpiado', 'Todos los dibujos han sido eliminados');
}

// =============================================================================
// Measurements
// =============================================================================

function calculateDistance(layer) {
  const latlngs = layer.getLatLngs();
  let distance = 0;

  for (let i = 0; i < latlngs.length - 1; i++) {
    distance += latlngs[i].distanceTo(latlngs[i + 1]);
  }

  return distance;
}

function calculateArea(layer) {
  return L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
}

function formatDistance(meters) {
  if (meters >= 1000) {
    return (meters / 1000).toFixed(2) + ' km';
  }
  return meters.toFixed(2) + ' m';
}

function formatArea(sqMeters) {
  if (sqMeters >= 1000000) {
    return (sqMeters / 1000000).toFixed(2) + ' km²';
  } else if (sqMeters >= 10000) {
    return (sqMeters / 10000).toFixed(2) + ' ha';
  }
  return sqMeters.toFixed(2) + ' m²';
}

// =============================================================================
// Coordinates Display
// =============================================================================

function initCoordinates() {
  state.map.on('mousemove', (e) => {
    document.getElementById('coordLat').textContent = e.latlng.lat.toFixed(6);
    document.getElementById('coordLng').textContent = e.latlng.lng.toFixed(6);
  });
}

function copyCoordinates() {
  const lat = document.getElementById('coordLat').textContent;
  const lng = document.getElementById('coordLng').textContent;

  if (lat === '--' || lng === '--') {
    showToast('warning', 'Sin coordenadas', 'Mueve el cursor sobre el mapa primero');
    return;
  }

  const coords = `${lat}, ${lng}`;
  navigator.clipboard.writeText(coords).then(() => {
    showToast('success', 'Copiado', 'Coordenadas copiadas al portapapeles');
  }).catch(() => {
    showToast('error', 'Error', 'No se pudieron copiar las coordenadas');
  });
}

// =============================================================================
// Geolocation
// =============================================================================

function locateUser() {
  showLoading();

  state.map.locate({ setView: true, maxZoom: 16 });

  state.map.once('locationfound', (e) => {
    hideLoading();

    const radius = e.accuracy;

    L.marker(e.latlng)
      .addTo(state.drawnItems)
      .bindPopup(`
        <strong>Tu ubicación</strong><br>
        Precisión: ${formatDistance(radius)}
      `)
      .openPopup();

    L.circle(e.latlng, {
      radius: radius,
      color: '#667eea',
      fillColor: '#667eea',
      fillOpacity: 0.1
    }).addTo(state.drawnItems);

    showToast('success', 'Ubicación encontrada', 'Tu posición ha sido localizada');
  });

  state.map.once('locationerror', (e) => {
    hideLoading();
    showToast('error', 'Error de ubicación', e.message);
  });
}

// =============================================================================
// Search Functionality
// =============================================================================

let searchTimeout;

async function searchLocation(query) {
  if (!query || query.length < 3) {
    hideSearchResults();
    return;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
    );
    const results = await response.json();

    if (results.length > 0) {
      showSearchResults(results);
    } else {
      hideSearchResults();
    }
  } catch (error) {
    console.error('Search error:', error);
    showToast('error', 'Error de búsqueda', 'No se pudo realizar la búsqueda');
  }
}

function showSearchResults(results) {
  const container = document.getElementById('searchResults');
  container.innerHTML = results.map(result => `
    <div class="search-result-item" data-lat="${result.lat}" data-lon="${result.lon}">
      <i class="fas fa-map-marker-alt" style="color: var(--color-primary); margin-right: 8px;"></i>
      ${result.display_name}
    </div>
  `).join('');

  container.classList.add('active');

  // Add click handlers
  container.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const lat = parseFloat(item.dataset.lat);
      const lon = parseFloat(item.dataset.lon);

      state.map.setView([lat, lon], 15);

      L.marker([lat, lon])
        .addTo(state.drawnItems)
        .bindPopup(item.textContent.trim())
        .openPopup();

      hideSearchResults();
      document.getElementById('searchInput').value = '';
    });
  });
}

function hideSearchResults() {
  document.getElementById('searchResults').classList.remove('active');
}

// =============================================================================
// Export Functions
// =============================================================================

function exportGeoJSON() {
  const data = state.drawnItems.toGeoJSON();

  if (data.features.length === 0) {
    showToast('warning', 'Sin datos', 'No hay elementos para exportar');
    return;
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gis-export-${new Date().toISOString().slice(0, 10)}.geojson`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('success', 'Exportado', 'Archivo GeoJSON descargado');
}

function exportImage() {
  showToast('info', 'Captura', 'Función de captura en desarrollo');
  // Note: Implementing screenshot requires additional libraries like html2canvas
}

// =============================================================================
// UI Controls
// =============================================================================

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  state.sidebarOpen = !state.sidebarOpen;
  sidebar.classList.toggle('open', state.sidebarOpen);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      showToast('error', 'Error', 'No se pudo activar pantalla completa');
    });
  } else {
    document.exitFullscreen();
  }
}

function updateFullscreenIcon() {
  const icon = document.querySelector('#fullscreenToggle i');
  if (icon) {
    icon.className = document.fullscreenElement ? 'fas fa-compress' : 'fas fa-expand';
  }
}

// =============================================================================
// Toast Notifications
// =============================================================================

function showToast(type, title, message) {
  const container = document.getElementById('toastContainer');

  const icons = {
    success: 'fa-check-circle',
    error: 'fa-times-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas ${icons[type]} toast-icon"></i>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" aria-label="Close">
      <i class="fas fa-times"></i>
    </button>
  `;

  container.appendChild(toast);

  // Auto remove after 5 seconds
  setTimeout(() => {
    toast.style.animation = 'slideInRight var(--transition-normal) reverse';
    setTimeout(() => toast.remove(), 250);
  }, 5000);

  // Close button
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.remove();
  });
}

// =============================================================================
// Loading Overlay
// =============================================================================

function showLoading() {
  document.getElementById('loadingOverlay').classList.add('active');
}

function hideLoading() {
  document.getElementById('loadingOverlay').classList.remove('active');
}

// =============================================================================
// Event Listeners
// =============================================================================

function initEventListeners() {
  // Theme toggle
  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

  // Fullscreen toggle
  document.getElementById('fullscreenToggle')?.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', updateFullscreenIcon);

  // Sidebar toggle
  document.getElementById('menuToggle')?.addEventListener('click', toggleSidebar);

  // Zoom controls
  document.getElementById('zoomIn')?.addEventListener('click', () => state.map.zoomIn());
  document.getElementById('zoomOut')?.addEventListener('click', () => state.map.zoomOut());

  // Home button
  document.getElementById('homeBtn')?.addEventListener('click', () => {
    state.map.setView(CONFIG.defaultCenter, CONFIG.defaultZoom);
  });

  // Locate button
  document.getElementById('locateBtn')?.addEventListener('click', locateUser);

  // Drawing tools
  document.getElementById('drawMarker')?.addEventListener('click', () => startDrawing('marker'));
  document.getElementById('drawLine')?.addEventListener('click', () => startDrawing('polyline'));
  document.getElementById('drawPolygon')?.addEventListener('click', () => startDrawing('polygon'));
  document.getElementById('drawCircle')?.addEventListener('click', () => startDrawing('circle'));
  document.getElementById('drawRectangle')?.addEventListener('click', () => startDrawing('rectangle'));

  // Measurement tools
  document.getElementById('measureDistance')?.addEventListener('click', () => {
    startDrawing('polyline');
    showToast('info', 'Medir distancia', 'Dibuja una línea para medir');
  });
  document.getElementById('measureArea')?.addEventListener('click', () => {
    startDrawing('polygon');
    showToast('info', 'Medir área', 'Dibuja un polígono para medir');
  });

  // Clear drawings
  document.getElementById('clearDrawings')?.addEventListener('click', clearDrawings);

  // Copy coordinates
  document.getElementById('copyCoords')?.addEventListener('click', copyCoordinates);

  // Export functions
  document.getElementById('exportGeoJSON')?.addEventListener('click', exportGeoJSON);
  document.getElementById('exportImage')?.addEventListener('click', exportImage);

  // Search
  const searchInput = document.getElementById('searchInput');
  searchInput?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchLocation(e.target.value);
    }, 500);
  });

  // Close search results when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      hideSearchResults();
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape to cancel drawing
    if (e.key === 'Escape' && state.currentDrawTool) {
      state.currentDrawTool.disable();
      state.currentDrawTool = null;
      updateToolButtons(null);
    }

    // Ctrl+F for fullscreen
    if (e.key === 'f' && e.ctrlKey) {
      e.preventDefault();
      toggleFullscreen();
    }
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    state.map.invalidateSize();
  });
}

// =============================================================================
// Export for debugging
// =============================================================================

window.gisViewer = {
  state,
  map: () => state.map,
  showToast,
  exportGeoJSON
};
