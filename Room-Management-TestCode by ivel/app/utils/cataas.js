// app/utils/cataas.js

const CATAAS_BASE_URL = 'https://cataas.com';

export class CataasService {
  // Get random cat image URL
  static getRandomCat() {
    return `${CATAAS_BASE_URL}/cat?${Date.now()}`; // Add timestamp to avoid caching
  }

  // Get cat with text
  static getCatWithText(text, options = {}) {
    const { size = 40, color = 'white' } = options;
    const encodedText = encodeURIComponent(text);
    return `${CATAAS_BASE_URL}/cat/says/${encodedText}?size=${size}&color=${color}&${Date.now()}`;
  }

  // Get cat by tag
  static getCatByTag(tag) {
    return `${CATAAS_BASE_URL}/cat?tag=${tag}&${Date.now()}`;
  }

  // Get cat with filter
  static getCatWithFilter(filter) {
    return `${CATAAS_BASE_URL}/cat?filter=${filter}&${Date.now()}`;
  }

  // Get multiple cats for room cards
  static getRoomCatImage(roomId) {
    const tags = ['cute', 'funny', 'sleepy', 'happy', 'curious'];
    const randomTag = tags[roomId % tags.length]; // Use roomId to determine tag
    return this.getCatByTag(randomTag);
  }
}

export default CataasService;