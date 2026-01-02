import React from 'react';
import {
	TouchableOpacity,
	Text,
	ActivityIndicator,
	StyleSheet,
} from 'react-native';

import { globalStyles } from '../../public/styles/globalStyles';
import { colors } from '../../public/assets/colors';
import { SubscribeButtonProps } from '../../types/subscription.types';
import { formatSubscribeButtonText } from '../../utils/paymentHelpers';

export const SubscribeButton: React.FC<SubscribeButtonProps> = ({
	price,
	isLoading,
	disabled,
	onPress,
}) => {
	const buttonText = formatSubscribeButtonText(price);
	const isDisabled = disabled || isLoading;
	console.log(buttonText, isDisabled);
	return (
		<TouchableOpacity
			activeOpacity={0.8}
			onPress={onPress}
			disabled={isDisabled}
			style={[styles.touchable]}
			accessibilityRole="button"
			accessibilityLabel={buttonText}
			accessibilityState={{ disabled: isDisabled }}
		>
			{isLoading && (
				<ActivityIndicator
					size={20}
					color={colors.white}
					style={styles.loader}
				/>
			)}
			<Text style={[styles.text, globalStyles.fontBold]}>
				{formatSubscribeButtonText(price)}
			</Text>
		</TouchableOpacity>

	);
};

const styles = StyleSheet.create({
	gradient: {
		borderRadius: 40,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 14,
		height: 56,
		backgroundColor: colors.purple,
	},
	gradientDisabled: {
		opacity: 0.7,
	},
	touchable: {
		borderRadius: 40,
		justifyContent: 'center',
		alignItems: 'center',
		padding: 10,
		height: 56,
		flexDirection: 'row',
		backgroundColor: colors.purple,
		width: '100%',
	},
	loader: {
		marginRight: 8,
	},
	text: {
		color: colors.white,
		fontSize: 18,
		textAlign: 'center',
	},
});