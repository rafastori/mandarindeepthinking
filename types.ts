import { Timestamp } from 'firebase/firestore';

export interface Keyword {
    id: string;
    word: string;
    pinyin: string;
    meaning: string;
    language?: 'zh' | 'de';
}

export interface StudyItem {
    id: number | string;
    chinese: string;
    pinyin: string;
    translation: string;
    tokens: string[];
    keywords: Keyword[];
    language?: 'zh' | 'de';
    createdAt?: any;
    type?: 'text' | 'word';
    originalSentence?: string;
}

export interface StatsHistory {
    word: string;
    date: string;
    time: string;
    type: 'general' | 'pronunciation';
}

export interface Stats {
    correct: number;
    wrong: number;
    history: StatsHistory[];
    wordCounts: Record<string, number>;
}

export interface Player {
  id: string;
  name: string;
  avatarUrl?: string;
  score?: number; 
}

export interface GameCard {
    word: string;
    pinyin: string;
    meaning: string;
    example: string;
}

export interface GameRoom {
  id: string;
  name: string;
  players: Player[];
  hostId: string;
  createdAt: any;
  
  // CORREÇÃO AQUI: Adicionado 'regenerating'
  status: 'lobby' | 'review' | 'playing' | 'finished' | 'regenerating';
  
  config?: {
      topic: string;
      lang: 'zh' | 'de';
      diff: string;
  };
  
  targetScore: number; 
  teamScore: number;   
  
  deck: GameCard[];        
  currentCardIndex?: number;
  roundAnswers?: Record<string, boolean>; 
}

declare global {
    interface Window {
        pinyinPro: {
            pinyin: (text: string, options?: any) => any;
        };
        webkitSpeechRecognition: any;
        SpeechRecognition: any;
    }
}