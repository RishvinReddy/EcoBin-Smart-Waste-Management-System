import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en.json';
import hiTranslation from './locales/hi.json';
import teTranslation from './locales/te.json';

const resources = {
  en: { translation: enTranslation },
  hi: { translation: hiTranslation },
  te: { translation: teTranslation }
};

// Retrieve saved language from localStorage, or default to 'en'
const savedLanguage = localStorage.getItem('appLanguage') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage, 
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;
