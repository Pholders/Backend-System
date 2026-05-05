const https = require('https');

/**
 * Geocoding Service
 * Converts clinic addresses to latitude/longitude coordinates
 * Supports both manual coordinates and API-based geocoding
 */

class GeocodingService {
  /**
   * Geocode an address using Open-Meteo Geocoding API (free, no API key needed)
   * @param {string} address - Full clinic address
   * @returns {Promise<object>} { latitude, longitude, formatted_address }
   */
  static async geocodeAddress(address) {
    if (!address || typeof address !== 'string') {
      return { 
        success: false, 
        error: 'Invalid address provided' 
      };
    }

    return new Promise((resolve) => {
      try {
        const encodedAddress = encodeURIComponent(address);
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodedAddress}&count=1&language=en&format=json`;

        https.get(url, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.results && parsed.results.length > 0) {
                const result = parsed.results[0];
                resolve({
                  success: true,
                  latitude: result.latitude,
                  longitude: result.longitude,
                  formatted_address: `${result.name}, ${result.admin1 || ''}, ${result.country}`.trim()
                });
              } else {
                resolve({
                  success: false,
                  error: 'Address not found. Please provide more details or manual coordinates.'
                });
              }
            } catch (error) {
              console.error('Error parsing geocoding response:', error);
              resolve({
                success: false,
                error: 'Failed to parse geocoding response'
              });
            }
          });
        }).on('error', (error) => {
          console.error('Geocoding API error:', error);
          resolve({
            success: false,
            error: 'Geocoding service temporarily unavailable. Please provide manual coordinates.'
          });
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          resolve({
            success: false,
            error: 'Geocoding request timed out. Please provide manual coordinates.'
          });
        }, 5000);

      } catch (error) {
        console.error('Geocoding error:', error);
        resolve({
          success: false,
          error: 'Geocoding service error'
        });
      }
    });
  }

  /**
   * Validate coordinates
   * @param {number} latitude 
   * @param {number} longitude 
   * @returns {object} { valid, error }
   */
  static validateCoordinates(latitude, longitude) {
    if (latitude === undefined || longitude === undefined) {
      return { 
        valid: false, 
        error: 'Latitude and longitude are required' 
      };
    }

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return { 
        valid: false, 
        error: 'Coordinates must be numbers' 
      };
    }

    if (latitude < -90 || latitude > 90) {
      return { 
        valid: false, 
        error: 'Latitude must be between -90 and 90' 
      };
    }

    if (longitude < -180 || longitude > 180) {
      return { 
        valid: false, 
        error: 'Longitude must be between -180 and 180' 
      };
    }

    return { valid: true };
  }

  /**
   * Process clinic location data
   * Accepts either manual coordinates OR address for geocoding
   * @param {object} locationData - { latitude, longitude, clinic_address }
   * @returns {Promise<object>} { latitude, longitude, formatted_address, method }
   */
  static async processLocation(locationData) {
    const { latitude, longitude, clinic_address } = locationData;

    // Option 1: Manual coordinates provided
    if (latitude !== undefined && longitude !== undefined) {
      const validation = this.validateCoordinates(latitude, longitude);
      if (!validation.valid) {
        return { 
          success: false, 
          error: validation.error 
        };
      }

      return {
        success: true,
        latitude,
        longitude,
        formatted_address: clinic_address || 'Manual coordinates',
        method: 'manual'
      };
    }

    // Option 2: Address provided, geocode it
    if (clinic_address) {
      const geocoded = await this.geocodeAddress(clinic_address);
      if (geocoded.success) {
        return {
          success: true,
          latitude: geocoded.latitude,
          longitude: geocoded.longitude,
          formatted_address: geocoded.formatted_address,
          method: 'geocoded'
        };
      } else {
        return {
          success: false,
          error: geocoded.error
        };
      }
    }

    return {
      success: false,
      error: 'Either provide coordinates (latitude, longitude) or clinic_address for geocoding'
    };
  }
}

module.exports = GeocodingService;
