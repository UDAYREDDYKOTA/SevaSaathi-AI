import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, MapPin, Navigation, Loader2, X, ExternalLink } from 'lucide-react';

// Default Center: Hyderabad, Telangana, India
const HYDERABAD_CENTER = {
  lat: 17.3850,
  lng: 78.4867,
  zoom: 12,
};

// Curated fast-autocomplete database for major Hyderabad localities & landmarks
const HYDERABAD_LOCALITIES = [
  { name: 'Charminar', area: 'Old City, Hyderabad', lat: 17.3616, lng: 78.4747 },
  { name: 'Gachibowli', area: 'Financial District, Hyderabad', lat: 17.4401, lng: 78.3489 },
  { name: 'Madhapur', area: 'Hitec City corridor, Hyderabad', lat: 17.4483, lng: 78.3915 },
  { name: 'Kukatpally', area: 'North-West Zone, Hyderabad', lat: 17.4875, lng: 78.4158 },
  { name: 'Secunderabad', area: 'Twin Cities, Hyderabad', lat: 17.4399, lng: 78.4983 },
  { name: 'LB Nagar', area: 'East Zone, Hyderabad', lat: 17.3457, lng: 78.5522 },
  { name: 'Hitec City', area: 'Cyberabad, Hyderabad', lat: 17.4435, lng: 78.3772 },
  { name: 'Jubilee Hills', area: 'Central West, Hyderabad', lat: 17.4319, lng: 78.4073 },
  { name: 'Banjara Hills', area: 'Central West, Hyderabad', lat: 17.4156, lng: 78.4357 },
  { name: 'Ameerpet', area: 'Central Zone, Hyderabad', lat: 17.4375, lng: 78.4483 },
  { name: 'Begumpet', area: 'North-Central, Hyderabad', lat: 17.4448, lng: 78.4682 },
  { name: 'Mehdipatnam', area: 'South-West, Hyderabad', lat: 17.3916, lng: 78.4439 },
  { name: 'Uppal', area: 'East Zone, Hyderabad', lat: 17.4018, lng: 78.5602 },
  { name: 'Dilsukhnagar', area: 'South-East, Hyderabad', lat: 17.3688, lng: 78.5247 },
  { name: 'Kondapur', area: 'IT Corridor, Hyderabad', lat: 17.4699, lng: 78.3578 },
  { name: 'Miyapur', area: 'North-West, Hyderabad', lat: 17.4968, lng: 78.3614 },
  { name: 'Nampally', area: 'Station Road, Hyderabad', lat: 17.3888, lng: 78.4683 },
  { name: 'Abids', area: 'Commercial Center, Hyderabad', lat: 17.3910, lng: 78.4770 },
  { name: 'Toli Chowki', area: 'Golconda side, Hyderabad', lat: 17.4013, lng: 78.4124 },
  { name: 'Himayatnagar', area: 'Central Zone, Hyderabad', lat: 17.4022, lng: 78.4842 },
  { name: 'Somajiguda', area: 'Raj Bhavan Road, Hyderabad', lat: 17.4256, lng: 78.4580 },
  { name: 'Tarnaka', area: 'Secunderabad Road, Hyderabad', lat: 17.4292, lng: 78.5312 },
  { name: 'Shamshabad', area: 'Airport Zone, Hyderabad', lat: 17.2403, lng: 78.4294 },
  { name: 'Koti', area: 'Sultan Bazaar, Hyderabad', lat: 17.3833, lng: 78.4833 },
  { name: 'Alwal', area: 'Secunderabad North, Hyderabad', lat: 17.5028, lng: 78.5139 },
];

/**
 * Creates custom crisp SVG marker pin icons (zero broken image asset issues)
 */
function createCustomPin(color = '#e11d48', isDraggable = false) {
  return L.divIcon({
    className: 'custom-map-marker-pin',
    html: `
      <div style="
        position: relative;
        width: 34px;
        height: 34px;
        background: ${color};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2.5px solid #ffffff;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: ${isDraggable ? 'grab' : 'pointer'};
      ">
        <div style="width: 10px; height: 10px; background: #ffffff; border-radius: 50%; transform: rotate(45deg);"></div>
      </div>
      <div style="
        position: absolute;
        bottom: -4px;
        left: 9px;
        width: 16px;
        height: 6px;
        background: rgba(0,0,0,0.3);
        border-radius: 50%;
        filter: blur(1px);
      "></div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34],
  });
}

/**
 * Interactive Leaflet + OpenStreetMap component for Hyderabad, Telangana.
 * 
 * Props:
 * - latitude (number|null)
 * - longitude (number|null)
 * - address (string)
 * - onLocationSelect (function({ lat, lng, address })): called when location changes
 * - readOnly (boolean): if true, disables click/drag and acts as display map
 * - height (string): CSS height (default '380px')
 * - showSearch (boolean): whether to display search autocomplete box
 * - title (string): optional label
 */
export default function HyderabadMap({
  latitude = null,
  longitude = null,
  address = '',
  onLocationSelect = null,
  readOnly = false,
  height = '380px',
  showSearch = true,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const isInternalUpdateRef = useRef(false);

  // Search & Geocoding state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Active coordinates
  const activeLat = typeof latitude === 'number' && !isNaN(latitude) ? latitude : HYDERABAD_CENTER.lat;
  const activeLng = typeof longitude === 'number' && !isNaN(longitude) ? longitude : HYDERABAD_CENTER.lng;
  const hasSelectedCoords = typeof latitude === 'number' && typeof longitude === 'number';

  // Reverse geocode via OpenStreetMap Nominatim with Hyderabad fallback
  const reverseGeocode = useCallback(async (lat, lng) => {
    setIsReverseGeocoding(true);
    setLocationError('');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const displayParts = [];
        const addr = data.address || {};

        if (addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood) {
          if (addr.road) displayParts.push(addr.road);
          if (addr.suburb) displayParts.push(addr.suburb);
          else if (addr.neighbourhood) displayParts.push(addr.neighbourhood);
          if (addr.city || addr.town || addr.county) displayParts.push(addr.city || addr.town || 'Hyderabad');
        } else if (data.display_name) {
          const parts = data.display_name.split(',').map((p) => p.trim());
          displayParts.push(...parts.slice(0, 3));
        }

        const formattedAddress = displayParts.length > 0 ? displayParts.join(', ') : `Location in Hyderabad (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

        if (onLocationSelect) {
          isInternalUpdateRef.current = true;
          onLocationSelect({
            lat: Math.round(lat * 100000) / 100000,
            lng: Math.round(lng * 100000) / 100000,
            address: formattedAddress,
          });
        }
      }
    } catch (err) {
      console.debug('Reverse geocoding offline, using nearest Hyderabad locality fallback:', err?.message);
      // Local fallback using nearest known locality if Nominatim is rate-limited or offline
      let nearest = HYDERABAD_LOCALITIES[0];
      let minDist = Infinity;
      for (const loc of HYDERABAD_LOCALITIES) {
        const dist = Math.hypot(loc.lat - lat, loc.lng - lng);
        if (dist < minDist) {
          minDist = dist;
          nearest = loc;
        }
      }
      const fallbackStr = `${nearest.name}, ${nearest.area} (GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      if (onLocationSelect) {
        isInternalUpdateRef.current = true;
        onLocationSelect({
          lat: Math.round(lat * 100000) / 100000,
          lng: Math.round(lng * 100000) / 100000,
          address: fallbackStr,
        });
      }
    } finally {
      setIsReverseGeocoding(false);
    }
  }, [onLocationSelect]);

  // Place or move marker on map
  const setMapLocation = useCallback((lat, lng, zoom = 15, shouldReverseGeocode = false) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.setView([lat, lng], zoom, { animate: true });

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const pin = L.marker([lat, lng], {
        icon: createCustomPin('#e11d48', !readOnly),
        draggable: !readOnly,
      }).addTo(map);

      if (!readOnly) {
        pin.on('dragend', (e) => {
          const pos = e.target.getLatLng();
          reverseGeocode(pos.lat, pos.lng);
        });
      }

      markerRef.current = pin;
    }

    if (markerRef.current) {
      markerRef.current.bindPopup(`
        <div style="font-family: inherit; font-size: 0.85rem; line-height: 1.4;">
          <strong style="color: #0f172a; display: block; margin-bottom: 2px;">Selected Incident Location</strong>
          <span style="color: #475569;">${address || 'Hyderabad, Telangana'}</span>
          <div style="margin-top: 4px; font-size: 0.75rem; color: #0284c7; font-weight: 600;">
            ${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E
          </div>
        </div>
      `);
    }

    if (shouldReverseGeocode) {
      reverseGeocode(lat, lng);
    }
  }, [readOnly, address, reverseGeocode]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center on selected location or Hyderabad center
    const initialLat = hasSelectedCoords ? activeLat : HYDERABAD_CENTER.lat;
    const initialLng = hasSelectedCoords ? activeLng : HYDERABAD_CENTER.lng;
    const initialZoom = hasSelectedCoords ? 15 : HYDERABAD_CENTER.zoom;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: true,
      scrollWheelZoom: !readOnly,
    });

    // High performance OpenStreetMap Carto tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    // Drop marker if initial coordinates exist
    if (hasSelectedCoords) {
      const pin = L.marker([initialLat, initialLng], {
        icon: createCustomPin('#e11d48', !readOnly),
        draggable: !readOnly,
      }).addTo(map);

      if (!readOnly) {
        pin.on('dragend', (e) => {
          const pos = e.target.getLatLng();
          reverseGeocode(pos.lat, pos.lng);
        });
      }

      markerRef.current = pin;
    }

    // Map click handler (drops/moves pin and reverse geocodes)
    if (!readOnly) {
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        setMapLocation(lat, lng, map.getZoom(), true);
      });
    }

    // Invalidate map size after render for smooth loading
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []); // Run once on mount

  // Sync external coordinates update (e.g. demo auto-fill or reset)
  useEffect(() => {
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }

    if (mapInstanceRef.current && hasSelectedCoords) {
      setMapLocation(activeLat, activeLng, 15, false);
    }
  }, [activeLat, activeLng, hasSelectedCoords, setMapLocation]);

  // Handle search input typing: instant local matching
  const handleSearchInputChange = (val) => {
    setSearchQuery(val);
    if (!val.trim() || readOnly) {
      setSearchResults([]);
      setIsDropdownOpen(false);
      return;
    }

    const q = val.toLowerCase().trim();
    const localMatches = HYDERABAD_LOCALITIES.filter(
      (item) => item.name.toLowerCase().includes(q) || item.area.toLowerCase().includes(q)
    ).slice(0, 5);

    setSearchResults(localMatches);
    setIsDropdownOpen(true);
  };

  // Remote Nominatim search with 350ms debounce
  useEffect(() => {
    if (!searchQuery.trim() || readOnly) {
      return;
    }

    const q = searchQuery.toLowerCase().trim();
    const localMatches = HYDERABAD_LOCALITIES.filter(
      (item) => item.name.toLowerCase().includes(q) || item.area.toLowerCase().includes(q)
    ).slice(0, 5);

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery + ', Hyderabad, Telangana'
        )}&viewbox=78.15,17.65,78.70,17.15&bounded=1&limit=6&addressdetails=1`;

        const res = await fetch(url, {
          headers: { 'Accept-Language': 'en' },
          signal: controller.signal,
        });

        if (res.ok) {
          const data = await res.json();
          const remoteResults = data.map((item) => {
            const shortName = item.name || item.display_name.split(',')[0];
            const areaName = item.display_name.split(',').slice(1, 4).join(',').trim();
            return {
              name: shortName,
              area: areaName || 'Hyderabad, Telangana',
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
            };
          });

          const combined = [...localMatches];
          for (const rem of remoteResults) {
            if (!combined.some((c) => Math.hypot(c.lat - rem.lat, c.lng - rem.lng) < 0.005)) {
              combined.push(rem);
            }
          }
          setSearchResults(combined.slice(0, 7));
        }
      } catch (fetchErr) {
        console.debug('Nominatim search note:', fetchErr?.message);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, readOnly]);

  // Handle selecting an autocomplete place
  const handleSelectPlace = (place) => {
    setSearchQuery(place.name);
    setIsDropdownOpen(false);
    setLocationError('');

    setMapLocation(place.lat, place.lng, 16, false);

    if (onLocationSelect) {
      isInternalUpdateRef.current = true;
      onLocationSelect({
        lat: Math.round(place.lat * 100000) / 100000,
        lng: Math.round(place.lng * 100000) / 100000,
        address: `${place.name}, ${place.area}`,
      });
    }
  };

  // Browser Geolocation ("Use My Location" per Requirement 7)
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocatingUser(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setIsLocatingUser(false);
        setMapLocation(lat, lng, 16, true);
      },
      (err) => {
        setIsLocatingUser(false);
        console.warn('Geolocation permission or network error:', err.message);
        setLocationError('Could not retrieve your location. Please select or search on the map.');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="hyderabad-map-wrapper">
      {/* Header bar / Search box */}
      {!readOnly && showSearch && (
        <div className="hyderabad-map-search-bar">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="map-search-input"
              placeholder="Search Hyderabad locality (e.g. Charminar, Gachibowli, Madhapur, Kukatpally)..."
              value={searchQuery}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              onFocus={() => {
                if (searchQuery.trim() && searchResults.length > 0) setIsDropdownOpen(true);
              }}
            />
            {isSearching && <Loader2 size={16} className="search-loading animate-spin" />}
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setIsDropdownOpen(false);
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* "Use My Location" Button (Explicit Click Only) */}
          <button
            type="button"
            className="btn-use-my-location"
            onClick={handleUseMyLocation}
            disabled={isLocatingUser}
            title="Locate via device GPS"
          >
            {isLocatingUser ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Locating...</span>
              </>
            ) : (
              <>
                <Navigation size={15} />
                <span>My Location</span>
              </>
            )}
          </button>

          {/* Autocomplete Dropdown */}
          {isDropdownOpen && searchResults.length > 0 && (
            <div className="map-search-dropdown animate-fade-in">
              {searchResults.map((res, idx) => (
                <div
                  key={`${res.name}-${idx}`}
                  className="search-dropdown-item"
                  onClick={() => handleSelectPlace(res)}
                >
                  <MapPin size={16} className="dropdown-pin-icon" />
                  <div className="dropdown-item-texts">
                    <span className="dropdown-place-name">{res.name}</span>
                    <span className="dropdown-place-area">{res.area}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Locality Chips for Instant City Navigation */}
      {!readOnly && (
        <div className="hyderabad-quick-chips-row">
          <span className="chips-label">Popular Localities:</span>
          {['Charminar', 'Gachibowli', 'Madhapur', 'Kukatpally', 'Secunderabad', 'LB Nagar'].map((locName) => {
            const loc = HYDERABAD_LOCALITIES.find((l) => l.name === locName);
            return (
              <button
                key={locName}
                type="button"
                className="locality-chip-btn"
                onClick={() => loc && handleSelectPlace(loc)}
              >
                {locName}
              </button>
            );
          })}
        </div>
      )}

      {/* Error / Loading feedback */}
      {locationError && (
        <div className="map-feedback-banner error-banner">
          <span>{locationError}</span>
        </div>
      )}

      {isReverseGeocoding && (
        <div className="map-feedback-banner info-banner">
          <Loader2 size={13} className="animate-spin" />
          <span>Identifying street address from map pin...</span>
        </div>
      )}

      {/* Main Leaflet Map Canvas */}
      <div
        ref={mapContainerRef}
        className="hyderabad-map-canvas"
        style={{ height, width: '100%', borderRadius: '10px' }}
      />

      {/* Map Footer Bar with Pin Coordinates & Google Maps Link */}
      <div className="hyderabad-map-footer">
        <div className="map-coord-status">
          <MapPin size={14} color="#e11d48" />
          {hasSelectedCoords ? (
            <span>
              <strong>Hyderabad Pin:</strong> {activeLat.toFixed(5)}° N, {activeLng.toFixed(5)}° E
              {!readOnly && <span className="hint-tag"> (Click map or drag pin to adjust)</span>}
            </span>
          ) : (
            <span className="hint-tag">Click anywhere on the Hyderabad map or search above to set location</span>
          )}
        </div>

        {hasSelectedCoords && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${activeLat},${activeLng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="map-external-link"
            title="Open in external Google Maps"
          >
            <span>External Map</span>
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
