import { IUser } from "./user.types";

export interface ICheckInRecommendationResponse {
  data: ICheckInRecommendation[];
  message: string;
  statusCode: number;
  success: boolean;
}

/**
 * A red-flag answer from the latest check-in. `indicator` and `answerLabel`
 * arrive already localized from the server (resolved off the flow definition),
 * so they are rendered as-is and never translated in the app.
 */
export interface IEmergencyConcern {
  nodeId: string;
  indicator: string;
  answerLabel: string;
}

export interface IEmergencyAlert {
  /** Id of the check-in row this alert belongs to — what "dismiss" targets. */
  recommendationHistoryId: string;
  week: number;
  concerns: IEmergencyConcern[];
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
      zone: "RED" | "YELLOW" | "GREEN";
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
      zone: "RED" | "YELLOW" | "GREEN";
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
      zone: "RED" | "YELLOW" | "GREEN";
    };
  };
  tagline: string;
  week: number;
  zone: string;
  /** Null whenever this check-in raised nothing, or she already dismissed it. */
  emergencyAlert?: IEmergencyAlert | null;
}

export enum IndividualRecommendationEnum {
  PHYSICAL = "physical",
  LACTATION = "lactation",
  EMOTIONAL = "emotional",
}
export enum IndividualRecommendationZoneEnum {
  RED = "RED",
  YELLOW = "YELLOW",
  GREEN = "GREEN",
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
    id: string;
    /**
     * Pay-per-session fee in rupees, charged when the user has no care-manager credit.
     * Optional because an app build can outlive the server response that added it.
     */
    remuneration?: number;
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
