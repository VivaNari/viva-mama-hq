import { IUser } from './user.types';

export interface ICheckInRecommendationResponse {
  data: ICheckInRecommendation[];
  message: string;
  statusCode: number;
  success: boolean;
}

export interface ICheckInRecommendation {
  finalScore: number;
  individualRecommendations: {
    physical: {
      recommendation: {
        title: string;
        goingWell: string;
        needsHelp?: string;
        celebrate?: string[];
        tips?: string[];
        next?: string[];
      };
      score: number;
      zone: 'RED' | 'YELLOW' | 'GREEN';
    };
    lactation: {
      recommendation: {
        title: string;
        goingWell: string;
        needsHelp?: string;
        celebrate?: string[];
        tips?: string[];
        next?: string[];
      };
      score: number;
      zone: 'RED' | 'YELLOW' | 'GREEN';
    };
    emotional: {
      recommendation: {
        title: string;
        goingWell: string;
        needsHelp?: string;
        celebrate?: string[];
        tips?: string[];
        next?: string[];
      };
      score: number;
      zone: 'RED' | 'YELLOW' | 'GREEN';
    };
  };
  tagline: string;
  week: number;
  zone: string;
}

export enum IndividualRecommendationEnum {
  PHYSICAL = 'physical',
  LACTATION = 'lactation',
  EMOTIONAL = 'emotional',
}
export enum IndividualRecommendationZoneEnum {
  RED = 'RED',
  YELLOW = 'YELLOW',
  GREEN = 'GREEN',
}

export interface IUserDataResponse {
  data: IUserAllData;
  message: string;
  statusCode: number;
  success: boolean;
}

export interface IUserAllData {
  NNWomanRecoveryScoreText: {
    description: string;
    title: string;
  };
  caremanager: {
    contact: string;
    name: string;
  };
  recoveryScoreBriefInfo: {
    green: string;
    red: string;
    yellow: string;
  };
  significance: {
    green: string;
    red: string;
    yellow: string;
  };
  user: IUser;
}

export interface ICheckInHistoryResponse {
  data: ICheckInHistory[];
  message: string;
  statusCode: number;
  success: boolean;
}

export interface ICheckInHistory {
  week: number;
  finalScore: number;
}
