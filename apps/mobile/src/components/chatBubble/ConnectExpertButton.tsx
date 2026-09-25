import Lucide from '@react-native-vector-icons/lucide';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles/globalStyles';
import { ISuggestedExpert } from '../../types/chat.types';
import { bubbleStyles } from './styles';

interface ConnectExpertButtonProps {
    suggestedExperts?: ISuggestedExpert[];
    onConnectExpert?: (expertId: string) => void;
}

/**
 * Shortcut to the expert the AI just recommended, so she doesn't have to go and
 * find them by name in the Experts tab.
 *
 * The suggestion is resolved server-side against the experts this user is allowed
 * to see, so whatever arrives here is safe to deep-link. Renders nothing when the
 * answer named no one — which is the normal case for most replies.
 */
export const ConnectExpertButton: React.FC<ConnectExpertButtonProps> = ({
    suggestedExperts,
    onConnectExpert,
}) => {
    const { t } = useTranslation();

    const expert = suggestedExperts?.[0];
    if (!expert?.expertId || !onConnectExpert) {
        return null;
    }

    return (
        <View style={bubbleStyles.optionsContainer}>
            <TouchableOpacity
                style={[
                    bubbleStyles.optionButton,
                    bubbleStyles.specialOptionButton,
                    { flexDirection: 'row', justifyContent: 'center', gap: 6 },
                ]}
                onPress={() => onConnectExpert(expert.expertId)}
                accessibilityRole="button"
                accessibilityLabel={t('chat.connectWithExpert', { name: expert.name })}
            >
                <Lucide name="calendar-check" size={16} color={colors.white} />
                <Text
                    style={[
                        bubbleStyles.optionButtonText,
                        bubbleStyles.specialOptionText,
                        globalStyles.fontSemiBold,
                    ]}
                >
                    {t('chat.connectWithExpert', { name: expert.name })}
                </Text>
            </TouchableOpacity>
        </View>
    );
};
