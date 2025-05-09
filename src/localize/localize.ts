import * as en from './languages/en.json';
import * as de from './languages/de.json';
import * as fr from './languages/fr.json';
import * as he from './languages/he.json';
import * as ko from './languages/ko.json';
import * as nl from './languages/nl.json';
import * as pl from './languages/pl.json';
import * as pt from './languages/pt.json';
import * as ru from './languages/ru.json';
import * as sk from './languages/sk.json';


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const languages: any = {
  en: en,
  de: de,
  fr: fr,
  he: he,
  ko: ko,
  nl: nl,
  pl: pl,
  pt: pt,
  ru: ru,
  sk: sk,
};

let currentLanguage = 'en';

export function setLanguage(hass?: { language: string }): void {
  if (hass?.language) {
    currentLanguage = hass.language.split('-')[0];
  } else {
    currentLanguage = localStorage.getItem('selectedLanguage')?.replace(/['"-_]+/g, '') || 'en';
  }
}

export function localize(string: string, search = '', replace = ''): string {
  let translated: string;

  try {
    translated = string.split('.').reduce((o, i) => o[i], languages[currentLanguage]);
  } catch (e) {
    translated = string.split('.').reduce((o, i) => o[i], languages['en']);
  }

  if (translated === undefined) translated = string.split('.').reduce((o, i) => o[i], languages['en']);

  if (search !== '' && replace !== '') {
    translated = translated.replace(search, replace);
  }
  return translated;
}
