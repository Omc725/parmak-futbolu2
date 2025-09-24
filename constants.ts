import { Difficulty, Team } from './types';

export const TEAMS: Team[] = [
    { name: 'Galatasaray', abbr: 'GS', color1: '#FDB913', color2: '#A30008' },
    { name: 'Fenerbahçe', abbr: 'FB', color1: '#003366', color2: '#FFCC00' },
    { name: 'Beşiktaş', abbr: 'BJK', color1: '#000000', color2: '#FFFFFF' },
    { name: 'Trabzonspor', abbr: 'TS', color1: '#8B0000', color2: '#87CEEB' },
    { name: 'Başakşehir', abbr: 'İBFK', color1: '#FF6600', color2: '#003366' },
    { name: 'Adana Demirspor', abbr: 'ADS', color1: '#003366', color2: '#418FDE' },
    { name: 'Alanyaspor', abbr: 'ALA', color1: '#FF6600', color2: '#008000' },
    { name: 'Antalyaspor', abbr: 'ANT', color1: '#FF0000', color2: '#FFFFFF' },
    { name: 'Sivasspor', abbr: 'SİV', color1: '#FF0000', color2: '#FFFFFF' },
    { name: 'Konyaspor', abbr: 'KON', color1: '#008000', color2: '#FFFFFF' },
    { name: 'Kayserispor', abbr: 'KAY', color1: '#FF0000', color2: '#FFFF00' },
    { name: 'Gaziantep FK', abbr: 'GFK', color1: '#DE0000', color2: '#000000' }
];

export const DIFFICULTY_LEVELS: { id: Difficulty; label: string }[] = [
    { id: 'very-easy', label: 'Çok Kolay' },
    { id: 'easy', label: 'Kolay' },
    { id: 'normal', label: 'Normal' },
    { id: 'hard', label: 'Zor' },
    { id: 'very-hard', label: 'Çok Zor' },
];

export const AI_SPEED_MULTIPLIERS: { [key in Difficulty]: number } = {
  'very-easy': 0.04,
  'easy': 0.07,
  'normal': 0.1,
  'hard': 0.13,
  'very-hard': 0.16
};

export const GAME_DURATION = 90;
export const HALF_TIME = 45;
export const OVERTIME_DURATION = 15;