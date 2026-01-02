import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { globalStyles } from '../../public/styles';
import { colors } from '../../public/assets/colors';
import { IService } from '../../types/subscription.types';

interface FeaturesTableProps {
	selectedPlan: IService | null;
	featureRows: string[];
	featuresMatrix: Record<string, boolean[]>;
}

export const FeaturesTable: React.FC<FeaturesTableProps> = ({
	selectedPlan,
	featureRows,
	featuresMatrix,
}) => {
	console.log('Selected Plan in FeaturesTable:', selectedPlan);
	if (!selectedPlan) {
		return null;
	}

	return (
		<View style={styles.container}>
			<View style={styles.table}>
				<View style={[styles.row, styles.headerRow]}>
					<View style={[styles.cell, styles.featureCell]}>
						<Text style={[globalStyles.fontBold, styles.headerText]}>
							Features
						</Text>
					</View>
					<View style={[styles.cell, styles.planCell]}>
						<Text
							style={[globalStyles.fontBold, styles.headerText, styles.centerText]}
							numberOfLines={2}
						>
							{selectedPlan.title}
						</Text>
					</View>
				</View>

				{featureRows.map((feature: string, featureIndex: number) => (
					<View key={feature} style={styles.row}>
						<View style={[styles.cell, styles.featureCell, styles.dataCell]}>
							<Text style={[globalStyles.fontSemiBold, styles.featureText]}>
								{feature}
							</Text>
						</View>
						<View style={[styles.cell, styles.planCell, styles.dataCell]}>
							<Text style={[styles.checkmark, featuresMatrix[selectedPlan.id]?.[featureIndex] && { color: 'green', fontSize: 18 }]}>
								{featuresMatrix[selectedPlan.id]?.[featureIndex] ? '✓' : '×'}
							</Text>
						</View>
					</View>
				))}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		marginVertical: 20,
	},
	table: {
		borderWidth: 0.8,
		borderColor: colors.darkPurple,
		borderRadius: 8,
		overflow: 'hidden',
	},
	row: {
		flexDirection: 'row',
		borderBottomColor: colors.darkPurple,
		borderBottomWidth: 1,
	},
	headerRow: {
		backgroundColor: colors.lightPurple,
	},
	cell: {
		paddingVertical: 12,
		paddingHorizontal: 8,
		justifyContent: 'center',
	},
	featureCell: {
		flex: 1,
	},
	planCell: {
		width: 150,
		alignItems: 'center',
	},
	dataCell: {
		borderTopWidth: 1,
		borderTopColor: colors.border,
	},
	headerText: {
		fontSize: 15,
		color: colors.darkPurple,
		fontWeight: '600',
	},
	centerText: {
		textAlign: 'center',
	},
	featureText: {
		fontSize: 14,
		color: colors.black,
	},
	checkmark: {
		fontSize: 24,
		color: "red",
	},
});