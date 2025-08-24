import React from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Globe } from 'lucide-react';

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage, isTranslating, restoreEnglish } = useLanguage();

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'zh-TW' : 'en';
    setLanguage(newLang);
  };

  const handleRefresh = () => {
    if (language === 'en') {
      restoreEnglish();
    }
  };

  const getButtonText = () => {
    if (isTranslating) {
      return 'Translating...';
    }
    if (language === 'en') {
      return 'EN';
    }
    return '繁體中文';
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={toggleLanguage}
        disabled={isTranslating}
        className="flex items-center gap-2"
      >
        <Globe className="h-4 w-4" />
        {getButtonText()}
      </Button>
      
      {/* Manual refresh button for English */}
      {language === 'en' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          className="h-8 w-8 p-0"
          title="Refresh English text"
        >
          🔄
        </Button>
      )}
    </div>
  );
};
