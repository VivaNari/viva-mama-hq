import React from 'react';
import { StyleSheet } from 'react-native';
import { colors } from '../public/assets/colors';
import { useFirstTimeCheck } from '../hooks/useFirstTimeCheck';
import { CuratingPlanLoader } from '../components/subscriptions/CuratingPlan';
// Replaces the old hardcoded two-plan view (servicesData.ts: Viva Basic / Viva
// Signature, monthly-yearly). Plans, prices and credit counts now come from the server.
import PlanCatalog from '../components/subscriptions/PlanCatalog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useScreenEdges } from '../hooks/useScreenEdges';

const Subscription: React.FC = () => {
	const { isFirstTime, isLoading } = useFirstTimeCheck();
	// This file backs two routes: "SubscriptionDetails" (header) and "Services"
	// (no header), so the top edge has to be resolved at runtime.
	const edges = useScreenEdges();

	if (isLoading && isFirstTime) {
		return <CuratingPlanLoader />;
	}

	return (
		<SafeAreaView style={styles.container} edges={edges}>
			<PlanCatalog />
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.white,
	},
});

export default Subscription;