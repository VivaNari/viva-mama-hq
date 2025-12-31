import React from 'react';
import { View, StyleSheet } from 'react-native';

import { PlanSelectorProps, IService } from '../../types/subscription.types';
import { PlanCard } from './PlanCard';

export const PlanSelector: React.FC<PlanSelectorProps> = ({
	plans,
	selectedPlan,
	billingCycle,
	onPlanSelect,
	disabled = false,
}) => {
	return (
		<View style={styles.container}>
			{plans.map((plan: IService) => (
				<PlanCard
					key={plan.id}
					plan={plan}
					billingCycle={billingCycle}
					isSelected={selectedPlan?.id === plan.id}
					onSelect={onPlanSelect}
					disabled={disabled}
				/>
			))}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		marginTop: 4,
	},
});