import { FlowType } from '../types/chat.types';
import { FLOW_SLUGS } from '../constants/chat';

interface FlowConfig {
	flowType: FlowType;
	flowSlug: string;
}

/**
 * Resolves the flow type and slug based on route params and onboarding status
 */
export const resolveFlowConfig = (
	routeFlowSlug: string | undefined,
	isFullyOnboarded: boolean
): FlowConfig => {
	// If route has a flow slug, it's a check-in flow
	if (routeFlowSlug) {
		return {
			flowType: FlowType.CHECKIN,
			flowSlug: FLOW_SLUGS[FlowType.CHECKIN],
		};
	}

	// If not fully onboarded, it's the onboarding flow
	if (!isFullyOnboarded) {
		return {
			flowType: FlowType.ONBOARDING,
			flowSlug: FLOW_SLUGS[FlowType.ONBOARDING],
		};
	}

	// Otherwise, it's the chatbot flow
	return {
		flowType: FlowType.CHATBOT,
		flowSlug: FLOW_SLUGS[FlowType.CHATBOT],
	};
};

/**
 * Check if the flow type requires saving chat history
 */
export const shouldSaveHistory = (flowType: FlowType): boolean => {
	return flowType !== FlowType.CHATBOT;
};

/**
 * Check if the flow should redirect after completion
 */
export const getCompletionRedirect = (
	flowType: FlowType
): { screen: string; delay: number } | null => {
	switch (flowType) {
		case FlowType.ONBOARDING:
			return { screen: 'Services', delay: 5000 };
		case FlowType.CHECKIN:
			return null; // Just show toast, no redirect
		case FlowType.CHATBOT:
			return null;
		default:
			return null;
	}
};

/**
 * Get completion message based on flow type
 */
export const getCompletionMessage = (
	flowType: FlowType
): { title: string; message: string } => {
	switch (flowType) {
		case FlowType.ONBOARDING:
			return {
				title: 'Complete',
				message: 'Your onboarding questionnaire is completed! You will be redirected soon',
			};
		case FlowType.CHECKIN:
			return {
				title: 'Complete',
				message: 'Weekly Check In Completed!',
			};
		default:
			return {
				title: 'Complete',
				message: 'Flow completed successfully',
			};
	}
};