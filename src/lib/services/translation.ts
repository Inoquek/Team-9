export interface TranslationResult {
  translatedText: string;
  detectedLanguage: string;
}

export class TranslationService {
  private static cache = new Map<string, string>();
  private static apiKey = import.meta.env.VITE_GOOGLE_TRANSLATE_API_KEY;
  private static baseUrl = 'https://translation.googleapis.com/language/translate/v2';

  /**
   * Translate text using Google Translate API
   */
  static async translate(
    text: string, 
    targetLang: string, 
    sourceLang: string = 'en'
  ): Promise<TranslationResult> {
    // Check cache first
    const cacheKey = `${text}_${sourceLang}_${targetLang}`;
    if (this.cache.has(cacheKey)) {
      return {
        translatedText: this.cache.get(cacheKey)!,
        detectedLanguage: sourceLang === 'auto' ? 'en' : sourceLang
      };
    }

    try {
      const response = await fetch(
        `${this.baseUrl}?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: text,
            target: targetLang,
            source: sourceLang,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Translation failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.data?.translations?.[0]?.translatedText) {
        const result: TranslationResult = {
          translatedText: data.data.translations[0].translatedText,
          detectedLanguage: data.data.translations[0].detectedSourceLanguage || sourceLang
        };

        // Cache the result
        this.cache.set(cacheKey, result.translatedText);
        
        return result;
      }
      
      throw new Error('No translation received');
    } catch (error) {
      console.error('Translation error:', error);
      
      // Return original text if translation fails
      return {
        translatedText: text,
        detectedLanguage: sourceLang === 'auto' ? 'en' : sourceLang
      };
    }
  }

  /**
   * Batch translate multiple texts
   */
  static async translateBatch(
    texts: string[], 
    targetLang: string, 
    sourceLang: string = 'en'
  ): Promise<TranslationResult[]> {
    const promises = texts.map(text => this.translate(text, targetLang, sourceLang));
    return Promise.all(promises);
  }

  /**
   * Clear translation cache
   */
  static clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  static getCacheSize(): number {
    return this.cache.size;
  }
}
