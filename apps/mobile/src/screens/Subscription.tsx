import React from 'react';
import { StyleSheet } from 'react-native';
import { colors } from '../public/assets/colors';
import { useFirstTimeCheck } from '../hooks/useFirstTimeCheck';
import { CuratingPlanLoader } from '../components/subscriptions/CuratingPlan';
import SubscriptionDetails from '../components/subscriptions/SubscriptionDetails';
import { SafeAreaView } from 'react-native-safe-area-context';

const Subscription: React.FC = () => {
	const { isFirstTime, isLoading } = useFirstTimeCheck();

	if (isLoading && isFirstTime) {
		return <CuratingPlanLoader />;
	}

	return (
		<SafeAreaView style={styles.container}>
			<SubscriptionDetails />
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