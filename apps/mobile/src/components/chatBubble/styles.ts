import { StyleSheet } from 'react-native';

import { colors } from '../../public/assets/colors';

export const bubbleStyles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		marginVertical: 10,
		marginHorizontal: 12,
		justifyContent: 'flex-start',
	},


	bubble: {
		borderRadius: 16,
		paddingHorizontal: 16,
		paddingVertical: 12,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.9,
		shadowRadius: 2,
		elevation: 6,
	},

	aiBubble: {
		backgroundColor: colors.white,
		borderTopLeftRadius: 4,
	},

	userBubble: {
		alignSelf: 'flex-end',
		backgroundColor: "#6F6AC4",
		borderTopRightRadius: 4,
	},

	messageText: {
		fontSize: 15,
		lineHeight: 22,
	},

	aiText: {
		color: colors.black,
	},

	userText: {
		color: colors.white,
	},

	optionsContainer: {
		marginTop: 12,
		gap: 8,
	},

	optionButton: {
		width: '85%',
		backgroundColor: colors.white,
		borderWidth: 1.5,
		borderColor: colors.secondary,
		borderRadius: 20,
		paddingVertical: 12,
		paddingHorizontal: 6,
		alignItems: 'center',
	},

	optionButtonSelected: {
		backgroundColor: colors.secondary,
		borderColor: colors.secondary,
	},

	optionButtonText: {
		fontSize: 14,
		color: colors.secondary,
		textAlign: 'center',
	},

	optionButtonTextSelected: {
		color: colors.white,
	},

	specialOptionButton: {
		backgroundColor: colors.primary,
		borderColor: colors.primary,
	},

	specialOptionText: {
		color: colors.white,
	},
});