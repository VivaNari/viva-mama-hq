import React from 'react';

import { ChatBubbleProps } from '../../types/chat.types';
import { isAiMessage } from '../../utils/messageHelpers';
import { StaticBubble } from './StaticBubble';
import { AnimatedBubble } from './AnimatedBubble';

interface Props extends ChatBubbleProps {
	shouldAnimate: boolean;
}

export const ChatBubble: React.FC<Props> = ({
	isFirst,
	message,
	isLast,
	isAnimating,
	isFlowComplete,
	onOptionSelect,
	onMultiOptionToggle,
	selectedMultiOptions,
	onDatePickerOpen,
	onLmpDatePickerOpen,
	onNotPregnantSelect,
	onConsultExpert,
	onChatWithViva,
	onAnimationComplete,
	shouldAnimate,
	onBookmarkPress,
	isBookmarked,
	onFlagPress,
	onConnectExpert,
}) => {
	if (shouldAnimate && isAiMessage(message) && onAnimationComplete) {
		return (
			<AnimatedBubble
				message={message}
				onAnimationComplete={onAnimationComplete}
				onOptionSelect={onOptionSelect}
				onMultiOptionToggle={onMultiOptionToggle}
				selectedMultiOptions={selectedMultiOptions}
				onDatePickerOpen={onDatePickerOpen}
				onLmpDatePickerOpen={onLmpDatePickerOpen}
				onNotPregnantSelect={onNotPregnantSelect}
				onConsultExpert={onConsultExpert}
				onChatWithViva={onChatWithViva}
				onConnectExpert={onConnectExpert}
			/>
		);
	}

	return (
		<StaticBubble
			message={message}
			isFirst={isFirst}
			isLast={isLast}
			isAnimating={isAnimating}
			isFlowComplete={isFlowComplete}
			onOptionSelect={onOptionSelect}
			onMultiOptionToggle={onMultiOptionToggle}
			selectedMultiOptions={selectedMultiOptions}
			onDatePickerOpen={onDatePickerOpen}
			onLmpDatePickerOpen={onLmpDatePickerOpen}
			onNotPregnantSelect={onNotPregnantSelect}
			onConsultExpert={onConsultExpert}
			onChatWithViva={onChatWithViva}
			onBookmarkPress={onBookmarkPress}
			isBookmarked={isBookmarked}
			onFlagPress={onFlagPress}
			onConnectExpert={onConnectExpert}
		/>
	);
};

export { StaticBubble } from './StaticBubble';
export { AnimatedBubble } from './AnimatedBubble';