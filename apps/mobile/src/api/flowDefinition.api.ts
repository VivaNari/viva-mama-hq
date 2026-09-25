import { FLOW_DEFINITION_URL } from "../constants/endpoints";
import { NodeType } from "../types/chat.types";
import apiClientInterceptor from "./apiClientInterceptor";

/**
 * A selectable option on a QUESTION_SINGLE / QUESTION_MULTI node. `value` is the
 * enum token persisted in `onboarding_data` (e.g. "c_section", "anemia"); `label`
 * is the localized display text.
 */
export interface IFlowDefinitionOption {
  key?: string;
  label: string;
  value: string;
  score: number | null;
}

export interface IFlowDefinitionNode {
  id: string;
  indicator?: string;
  nodeType: NodeType | string;
  text: string;
  educationalMessage?: string;
  whyThisMatters?: string;
  options: IFlowDefinitionOption[];
}

export interface IFlowDefinition {
  slug: string;
  name: string;
  version: number;
  status: string;
  startNodeId: string;
  nodes: IFlowDefinitionNode[];
}

/**
 * Fetch a PUBLISHED flow definition by slug. Auth + active language (`?lang=`)
 * are injected by the axios interceptor, so nodes/options come back localized.
 */
export const getFlowDefinition = async (
  slug: string,
): Promise<IFlowDefinition> => {
  const response = await apiClientInterceptor().get(FLOW_DEFINITION_URL(slug));
  return response.data.data as IFlowDefinition;
};
