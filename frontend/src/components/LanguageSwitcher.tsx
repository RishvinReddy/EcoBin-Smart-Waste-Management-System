import React from 'react';
import { useTranslation } from 'react-i18next';
import { FormControl, Select, MenuItem, SelectChangeEvent } from '@mui/material';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const handleChange = (event: SelectChangeEvent) => {
    const selectedLanguage = event.target.value as string;
    i18n.changeLanguage(selectedLanguage);
    localStorage.setItem('appLanguage', selectedLanguage);
  };

  return (
    <FormControl variant="standard" sx={{ minWidth: 100, ml: 2 }}>
      <Select
        value={i18n.language || 'en'}
        onChange={handleChange}
        disableUnderline
        sx={{ color: 'inherit', fontWeight: 'bold' }}
      >
        <MenuItem value="en">🇺🇸 English</MenuItem>
        <MenuItem value="hi">🇮🇳 हिन्दी</MenuItem>
        <MenuItem value="te">🇮🇳 తెలుగు</MenuItem>
      </Select>
    </FormControl>
  );
};

export default LanguageSwitcher;
