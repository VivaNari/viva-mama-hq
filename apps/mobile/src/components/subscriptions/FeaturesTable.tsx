import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet } from 'react-native';

import { globalStyles } from '../../public/styles';
import { colors } from '../../public/assets/colors';
import { IService } from '../../types/subscription.types';

/**
 * A feature is not simply in or out of a plan. Viva Lite grants no consultation
 * credits, but its users can still book — they pay the per-session fee instead. A red
 * cross would tell them the door is shut, so that case gets its own state.
 */
export type FeatureState = boolean | 'PAY_PER_SESSION';

interface FeaturesTableProps {
	selectedPlan: IService | null;
	featureRows: string[];
	featuresMatrix: Record<string, FeatureState[]>;
	/** Optional supporting line per feature, positional against `featureRows`. */
	featureCaptions?: string[];
}

export const FeaturesTable: React.FC<FeaturesTableProps> = ({
	selectedPlan,
	featureRows,
	featuresMatrix,
	featureCaptions,
}) => {
	const { t } = useTranslation();
	if (!selectedPlan) {
		return null;
	}

	return (
		<View style={styles.container}>
			<View style={styles.table}>
				<View style={[styles.row, styles.headerRow]}>
					<View style={[styles.cell, styles.featureCell]}>
						<Text style={[globalStyles.fontBold, styles.headerText]}>
							{t('subscription.features')}
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

				{featureRows.map((feature: string, featureIndex: number) => {
					if (
						selectedPlan.id === 'LITE' &&
						(feature === 'subscription.featureRows.f3' ||
							feature === 'subscription.featureRows.f4' ||
							feature === 'subscription.featureRows.f5' ||
							feature === 'subscription.featureRows.f6' ||
							feature === 'subscription.featureRows.f7' ||
							feature === 'subscription.featureRows.f10')
					) {
						return null;
					}

					const state = featuresMatrix[selectedPlan.id]?.[featureIndex];

					return (
						<View key={feature} style={styles.row}>
							<View style={[styles.cell, styles.featureCell, styles.dataCell]}>
								<Text style={[globalStyles.fontSemiBold, styles.featureText]}>
									{t(feature)}
								</Text>
								{featureCaptions?.[featureIndex] ? (
									<Text style={[globalStyles.fontRegular, styles.captionText]}>
										{t(featureCaptions[featureIndex])}
									</Text>
								) : null}
							</View>
							<View style={[styles.cell, styles.planCell, styles.dataCell]}>
								{state === 'PAY_PER_SESSION' ? (
									// Words rather than a symbol: there is no glyph that reads as
									// "available, but you pay for it".
									<Text
										style={[globalStyles.fontSemiBold, styles.payPerSession]}
										numberOfLines={2}
									>
										{t('subscription.payPerSessionMark')}
									</Text>
								) : (
									<Text style={[styles.checkmark, state === true && styles.checkmarkOn]}>
										{state === true ? '✓' : '×'}
									</Text>
								)}
							</View>
						</View>
					);
				})}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		marginVertical: 20,
	},
	table: {
		borderWidth: 0.2,
		borderColor: colors.darkPurple,
		borderRadius: 8,
		overflow: 'hidden',
	},
	row: {
		flexDirection: 'row',
		borderBottomColor: colors.darkPurple,
		borderBottomWidth: 0.5,
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
	// Kept as narrow as the widest marker allows — every point this column takes comes
	// straight out of the feature text beside it, which already wraps to several lines.
	planCell: {
		width: 96,
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
	captionText: {
		fontSize: 12,
		lineHeight: 17,
		color: colors.darkGray,
		marginTop: 3,
	},
	checkmark: {
		fontSize: 24,
		color: colors.redBadgeText,
	},
	checkmarkOn: {
		fontSize: 18,
		color: colors.greenBadgeText,
	},
	payPerSession: {
		fontSize: 11,
		lineHeight: 15,
		color: colors.darkGray,
		textAlign: 'center',
	},
});