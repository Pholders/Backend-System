const https = require('https');

/**
 * Geolocation Service
 * Fetches geolocation data from IP address
 * Uses ip-api.com (free tier: 45 requests/minute)
 */

class GeolocationService {
  /**
   * Get geolocation from IP address
   * @param {string} ipAddress - IP address to geolocate
   * @returns {Promise<object>} Geolocation data
   */
  static async getLocationFromIP(ipAddress) {
    // Skip private/local IPs
    if (this.isPrivateIP(ipAddress)) {
      return {
        ip: ipAddress,
        country: 'Local',
        region: 'Private Network',
        city: 'N/A',
        latitude: null,
        longitude: null,
        timezone: 'N/A',
        isp: 'Private',
        is_private: true
      };
    }

    return new Promise((resolve) => {
      const url = `https://ip-api.com/json/${ipAddress}?fields=query,country,regionName,city,lat,lon,timezone,isp,status`;

      https.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            
            if (parsed.status === 'success') {
              resolve({
                ip: parsed.query,
                country: parsed.country,
                region: parsed.regionName || 'N/A',
                city: parsed.city || 'N/A',
                latitude: parsed.lat,
                longitude: parsed.lon,
                timezone: parsed.timezone,
                isp: parsed.isp,
                is_private: false
              });
            } else {
              resolve(this.defaultLocation(ipAddress));
            }
          } catch (error) {
            console.error('Error parsing geolocation data:', error);
            resolve(this.defaultLocation(ipAddress));
          }
        });
      }).on('error', (error) => {
        console.error('Geolocation lookup error:', error);
        resolve(this.defaultLocation(ipAddress));
      });

      // Set timeout to prevent hanging
      setTimeout(() => {
        resolve(this.defaultLocation(ipAddress));
      }, 5000);
    });
  }

  /**
   * Check if IP is private/local
   */
  static isPrivateIP(ip) {
    const privateRanges = [
      /^127\./,           // Loopback
      /^10\./,            // Private
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // Private
      /^192\.168\./,      // Private
      /^::1$/,            // IPv6 loopback
      /^fc00:/,           // IPv6 private
    ];

    return privateRanges.some(range => range.test(ip));
  }

  /**
   * Default location response for failures
   */
  static defaultLocation(ipAddress) {
    return {
      ip: ipAddress,
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
      latitude: null,
      longitude: null,
      timezone: 'Unknown',
      isp: 'Unknown',
      is_private: false
    };
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   * @param {number} lat1 - First latitude
   * @param {number} lon1 - First longitude
   * @param {number} lat2 - Second latitude
   * @param {number} lon2 - Second longitude
   * @returns {number} Distance in kilometers
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;

    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Check for impossible travel (too fast movement)
   * @param {object} lastLocation - Previous location
   * @param {object} currentLocation - Current location
   * @param {number} timeDiffMinutes - Time difference in minutes
   * @returns {object} Travel analysis
   */
  static checkImpossibleTravel(lastLocation, currentLocation, timeDiffMinutes) {
    if (!lastLocation || !currentLocation) {
      return { isImpossible: false, reason: 'Insufficient data' };
    }

    const distance = this.calculateDistance(
      lastLocation.latitude,
      lastLocation.longitude,
      currentLocation.latitude,
      currentLocation.longitude
    );

    if (!distance) {
      return { isImpossible: false, reason: 'Could not calculate distance' };
    }

    // Maximum realistic speed: 900 km/h (commercial jet)
    const maxSpeedKmH = 900;
    const maxDistanceKm = (maxSpeedKmH * timeDiffMinutes) / 60;

    const isImpossible = distance > maxDistanceKm;

    return {
      isImpossible,
      distance: Math.round(distance * 100) / 100,
      timeMinutes: timeDiffMinutes,
      requiredSpeed: Math.round((distance / timeDiffMinutes * 60) * 100) / 100,
      maxSpeed: maxSpeedKmH,
      reason: isImpossible ? `Distance of ${Math.round(distance)}km in ${timeDiffMinutes}min requires impossible speed` : 'Normal travel'
    };
  }
}

module.exports = GeolocationService;
