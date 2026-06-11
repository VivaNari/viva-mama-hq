import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../public/assets/colors';
import VivaAILoader from '../../components/VivaPlanAnimation';

interface CuratingPlanLoaderProps {
}

export const CuratingPlanLoader: React.FC<CuratingPlanLoaderProps> = () => {
	return (
		<SafeAreaView style={styles.container}>
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