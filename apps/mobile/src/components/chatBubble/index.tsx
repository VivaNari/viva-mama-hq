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
	onNotPregnantSelect,
	onAnimationComplete,
	shouldAnimate,
	onBookmarkPress,
	isBookmarked,
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
				onNotPregnantSelect={onNotPregnantSelect}
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
			onNotPregnantSelect={onNotPregnantSelect}
			onBookmarkPress={onBookmarkPress}
			isBookmarked={isBookmarked}
		/>
	);
};

export { StaticBubble } from './StaticBubble';
export { AnimatedBubble } from './AnimatedBubble';