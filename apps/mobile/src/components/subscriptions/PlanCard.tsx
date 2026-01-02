import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { globalStyles } from "../../public/styles/globalStyles";
import { colors } from '../../public/assets/colors';
import { PlanCardProps } from '../../types/subscription.types';
import { formatPrice } from '../../utils/paymentHelpers';

export const PlanCard: React.FC<PlanCardProps> = ({
	plan,
	billingCycle,
	isSelected,
	onSelect,
	disabled = false,
}) => {
	const handlePress = useCallback(() => {
		if (!disabled) {
			onSelect(plan);
		}
	}, [disabled, onSelect, plan]);

	const priceText = formatPrice(
		billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice,
		billingCycle
	);

	return (
		<TouchableOpacity
			style={[
				styles.container,
				isSelected && styles.containerSelected,
				disabled && styles.containerDisabled,
			]}
			activeOpacity={0.8}
			onPress={handlePress}
			disabled={disabled}
			accessibilityRole="radio"
			accessibilityLabel={`${plan.title} plan, ${priceText}`}
			accessibilityState={{ selected: isSelected, disabled }}
		>
			<View style={styles.infoContainer}>
				<Text style={[styles.title, globalStyles.fontSemiBold, isSelected && styles.titleSelected,]}>
					{plan.title}
				</Text>
				{billingCycle === 'yearly' && plan.yearlyLabel && (
					<Text style={[styles.subtitle, globalStyles.fontRegular]}>
						{plan.yearlyLabel}
					</Text>
				)}
			</View>

			<Text style={[styles.price, globalStyles.fontSemiBold]}>
				{priceText}
			</Text>
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 10,
		paddingHorizontal: 10,
		marginTop: 12,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: colors.border,
		backgroundColor: colors.white,
	},
	containerSelected: {
		borderColor: colors.purple,
		backgroundColor: colors.lightPurple,
	},
	containerDisabled: {
		opacity: 0.5,
	},
	infoContainer: {
		flex: 1,
	},
	title: {
		fontSize: 16,
		color: colors.black,
	},
	titleSelected: {
		fontSize: 16,
		color: colors.purple,
	},
	subtitle: {
		fontSize: 12,
		color: "#4e4e4e",
		marginTop: 2,
	},
	price: {
		fontSize: 18,
		color: "#4e4e4e",
	},
});