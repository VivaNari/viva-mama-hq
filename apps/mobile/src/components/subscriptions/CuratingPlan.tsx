import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../public/assets/colors';
import VivaAILoader from '../../components/VivaPlanAnimation';
import { useScreenEdges } from '../../hooks/useScreenEdges';

interface CuratingPlanLoaderProps {
}

export const CuratingPlanLoader: React.FC<CuratingPlanLoaderProps> = () => {
	// This is the early-return branch of the Subscription screen, which backs both the
	// "SubscriptionDetails" route (header) and "Services" (no header) — so it needs the
	// same runtime resolution the screen's main return uses. Claiming the top inset
	// under a header pushed the vertically-centred loader visibly off centre.
	const edges = useScreenEdges();

	return (
		<SafeAreaView style={styles.container} edges={edges}>
			<VivaAILoader />
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.white,
	},
});