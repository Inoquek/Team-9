import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'en' | 'zh-TW'; // 'en' for English, 'zh-TW' for Traditional Chinese (Taiwan)

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isTranslating: boolean;
  translatePage: () => Promise<void>;
  restoreEnglish: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [originalTexts, setOriginalTexts] = useState<Map<string, string>>(new Map());

  // Load saved language preference
  useEffect(() => {
    const savedLang = localStorage.getItem('preferred-language') as Language;
    if (savedLang && (savedLang === 'en' || savedLang === 'zh-TW')) {
      setLanguageState(savedLang);
    }
  }, []);

  // Function to translate the entire page
  const translatePage = async () => {
    if (language === 'en') {
      return;
    }

    try {
      setIsTranslating(true);
      
      // Find all text nodes in the document
      const textNodes: Node[] = [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const text = node.textContent?.trim();
            if (text && text.length > 0 && text.length < 1000) {
              // Skip if parent has translate="no"
              const parent = node.parentElement;
              if (parent && parent.getAttribute('translate') === 'no') {
                return NodeFilter.FILTER_REJECT;
              }
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_REJECT;
          }
        }
      );

      let node;
      while (node = walker.nextNode()) {
        textNodes.push(node);
      }

      // Get unique texts to translate
      const textsToTranslate = [...new Set(
        textNodes
          .map(node => node.textContent?.trim())
          .filter(text => text && text.length > 0)
      )];

      if (textsToTranslate.length === 0) {
        return;
      }

      console.log(`Translating ${textsToTranslate.length} text elements`);

      // Import translation service dynamically to avoid issues
      const { TranslationService } = await import('@/lib/services/translation');
      
      // Batch translate all texts
      const results = await TranslationService.translateBatch(textsToTranslate, 'zh-TW', 'en');
      
      // Create a map of original text to translated text and track nodes
      const translationMap = new Map<string, string>();
      const newOriginalTexts = new Map<string, string>();
      
      results.forEach((result, index) => {
        const originalText = textsToTranslate[index];
        if (result.translatedText && result.translatedText !== originalText) {
          translationMap.set(originalText, result.translatedText);
          // Store original text for restoration
          newOriginalTexts.set(result.translatedText, originalText);
        }
      });

      // Apply translations to DOM and mark nodes for restoration
      textNodes.forEach(node => {
        const originalText = node.textContent?.trim();
        if (originalText && translationMap.has(originalText)) {
          const translatedText = translationMap.get(originalText)!;
          node.textContent = node.textContent?.replace(originalText, translatedText);
          // Mark this node as translated by adding a data attribute
          if (node.parentElement) {
            node.parentElement.setAttribute('data-translated', 'true');
            node.parentElement.setAttribute('data-original-text', originalText);
          }
        }
      });

      // Update the original texts map
      setOriginalTexts(newOriginalTexts);

    } catch (error) {
      console.error('Page translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  // Function to restore original English text
  const restoreEnglish = () => {
    try {
      console.log('Restoring English text...');
      
      // Method 1: Use data attributes to find translated elements
      const translatedElements = document.querySelectorAll('[data-translated="true"]');
      console.log(`Found ${translatedElements.length} translated elements to restore`);
      
      if (translatedElements.length > 0) {
        // Restore original text for all translated elements
        translatedElements.forEach(element => {
          const originalText = element.getAttribute('data-original-text');
          if (originalText) {
            // Find text nodes within this element and restore them
            const walker = document.createTreeWalker(
              element,
              NodeFilter.SHOW_TEXT,
              null
            );
            
            let textNode;
            while (textNode = walker.nextNode()) {
              const currentText = textNode.textContent;
              if (currentText && originalTexts.has(currentText.trim())) {
                const original = originalTexts.get(currentText.trim())!;
                textNode.textContent = currentText.replace(currentText.trim(), original);
              }
            }
            
            // Remove the translation markers
            element.removeAttribute('data-translated');
            element.removeAttribute('data-original-text');
          }
        });
      } else {
        // Method 2: Fallback - try to restore using the originalTexts map
        console.log('No data attributes found, trying fallback restoration...');
        
        // Find all text nodes and try to restore them
        const allTextNodes: Node[] = [];
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        let node;
        while (node = walker.nextNode()) {
          allTextNodes.push(node);
        }
        
        let restoredCount = 0;
        allTextNodes.forEach(textNode => {
          const currentText = textNode.textContent?.trim();
          if (currentText && originalTexts.has(currentText)) {
            const original = originalTexts.get(currentText)!;
            textNode.textContent = textNode.textContent?.replace(currentText, original);
            restoredCount++;
          }
        });
        
        console.log(`Fallback restoration: restored ${restoredCount} text nodes`);
      }

      // Clear the original texts map
      setOriginalTexts(new Map());
      
      console.log('English text restored');
      
    } catch (error) {
      console.error('Error restoring English text:', error);
    }
  };

  // Auto-translate page when language changes to Chinese
  useEffect(() => {
    console.log(`Language effect triggered: ${language}`);
    
    if (language === 'zh-TW') {
      console.log('Switching to Traditional Chinese, will translate page...');
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        console.log('Starting translation to Traditional Chinese...');
        translatePage();
      }, 500);
    } else if (language === 'en') {
      console.log('Switching to English, will restore text...');
      // Small delay to ensure state is updated before restoration
      setTimeout(() => {
        console.log('Starting restoration to English...');
        restoreEnglish();
      }, 100);
    }
  }, [language]);

  // Watch for new content and translate it automatically
  useEffect(() => {
    if (language !== 'zh-TW') return;

    const observer = new MutationObserver((mutations) => {
      let hasNewContent = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          hasNewContent = true;
        }
      });

      if (hasNewContent) {
        // Small delay to ensure content is fully rendered
        setTimeout(() => {
          translatePage();
        }, 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, [language]);

  const setLanguage = (lang: Language) => {
    console.log(`Language changing from ${language} to ${lang}`);
    setLanguageState(lang);
    localStorage.setItem('preferred-language', lang);
  };

  const value: LanguageContextType = {
    language,
    setLanguage,
    isTranslating,
    translatePage,
    restoreEnglish,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
