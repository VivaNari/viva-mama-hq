import React, { useState } from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { recordError } from '../../analytics';
import { recordBabyArrived, recordLabourStarted } from '../../api/journey.api';
import { FLOW_SLUGS } from '../../constants/chat';
import { globalStyles } from '../../public/styles';
import { journeyStyles as styles } from '../../public/styles/journeyStyles';
import { FlowType } from '../../types/chat.types';
import { DeliveryOutcomeEnum, DeliveryTypeEnum } from '../../types/user.types';
import { JourneyPosition } from '../../utils/journeyPosition';
import { showLogError } from '../../utils/motherLogHelpers';
import CustomDatePicker from '../CustomDatePicker';
import StillBirthSupportModal from '../profile/StillBirthSupportModal';

type Pregnant = Extract<JourneyPosition, { kind: 'pregnant' }>;

const SHOW_FROM_WEEK = 37;

const pad = (value: number) => String(value).padStart(2, '0');
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const showsDeliveryPrompt = (position: Pregnant): boolean =>
    position.week >= SHOW_FROM_WEEK || position.awaitingBirth || position.inLabour;

interface OptionProps {
    label: string;
    selected: boolean;
    onPress: () => void;
}

const Option: React.FC<OptionProps> = ({ label, selected, onPress }) => (
    <TouchableOpacity
        style={[styles.option, selected && styles.optionOn]}
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
    >
        <Text style={[styles.optionText, globalStyles.fontSemiBold]}>{label}</Text>
    </TouchableOpacity>
);

/**
 * "My labour has started" and "My baby is here", from week 37. The second saves the real
 * birth date, so her postnatal timing starts from the right day. A due date that passed with
 * no word from her asks the same question in plain terms.
 */
const DeliveryPrompt: React.FC<{ position: Pregnant; onChanged: () => void }> = ({ position, onChanged }) => {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const [sheet, setSheet] = useState(false);
    const [date, setDate] = useState<Date | null>(null);
    const [pickingDate, setPickingDate] = useState(false);
    const [type, setType] = useState<DeliveryTypeEnum | null>(null);
    const [outcome, setOutcome] = useState<DeliveryOutcomeEnum | null>(null);
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState(false);
    const [welcome, setWelcome] = useState(false);
    const [support, setSupport] = useState(false);

    const startLabour = async () => {
        setSaving(true);
        try {
            await recordLabourStarted();
            onChanged();
        } catch (error) {
            showLogError(t, 'save', error, 'DeliveryPrompt.labour');
        } finally {
            setSaving(false);
        }
    };

    const saveBirth = async () => {
        if (!date || !type || !outcome) return;
        setSaving(true);
        setFailed(false);
        try {
            await recordBabyArrived({
                delivery_date: dateKey(date),
                delivery_type: type,
                delivery_outcome: outcome,
            });
            setSheet(false);
            if (outcome === DeliveryOutcomeEnum.STILL_BIRTH) setSupport(true);
            else setWelcome(true);
        } catch (error) {
            setFailed(true);
            recordError(error, 'DeliveryPrompt.birth');
        } finally {
            setSaving(false);
        }
    };

    /** Refreshing moves her on to the postpartum view, which unmounts this prompt. */
    const finish = (then?: () => void) => {
        setWelcome(false);
        setSupport(false);
        then?.();
        onChanged();
    };

    return (
        <View style={styles.prompt}>
            {position.awaitingBirth && !position.inLabour ? (
                <>
                    <Text style={[styles.promptTitle, globalStyles.fontBold]}>{t('journey.delivery.arrivedTitle')}</Text>
                    <Text style={[styles.cardBody, globalStyles.fontRegular]}>{t('journey.delivery.arrivedBody')}</Text>
                </>
            ) : null}

            <TouchableOpacity
                style={[styles.bigButton, styles.promptButton]}
                onPress={() => setSheet(true)}
                accessibilityRole="button"
            >
                <Text style={[styles.bigButtonText, globalStyles.fontSemiBold]}>{t('journey.delivery.babyHere')}</Text>
            </TouchableOpacity>

            {!position.inLabour ? (
                <TouchableOpacity
                    style={[styles.bigButton, styles.promptButtonQuiet]}
                    onPress={startLabour}
                    disabled={saving}
                    accessibilityRole="button"
                >
                    <Text style={[styles.bigButtonText, styles.promptButtonQuietText, globalStyles.fontSemiBold]}>
                        {t('journey.delivery.labourStarted')}
                    </Text>
                </TouchableOpacity>
            ) : null}

            <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
                <Pressable style={styles.sheetBackdrop} onPress={() => setSheet(false)}>
                    {/* Swallows taps so pressing the sheet itself never dismisses it. */}
                    <Pressable style={styles.sheet} onPress={() => {}}>
                        <Text style={[styles.sheetTitle, globalStyles.fontBold]}>{t('journey.delivery.sheetTitle')}</Text>

                        <Text style={[styles.sheetLabel, globalStyles.fontRegular]}>{t('journey.delivery.dateLabel')}</Text>
                        <Option
                            label={date ? date.toLocaleDateString() : t('journey.delivery.chooseDate')}
                            selected={!!date}
                            onPress={() => setPickingDate(true)}
                        />
                        <CustomDatePicker
                            show={pickingDate}
                            setShow={setPickingDate}
                            selectedDate={date}
                            onSelect={setDate}
                            maximumDate={new Date()}
                        />

                        <Text style={[styles.sheetLabel, globalStyles.fontRegular]}>{t('journey.delivery.typeLabel')}</Text>
                        <Option
                            label={t('journey.delivery.typeVaginal')}
                            selected={type === DeliveryTypeEnum.VAGINAL}
                            onPress={() => setType(DeliveryTypeEnum.VAGINAL)}
                        />
                        <Option
                            label={t('journey.delivery.typeCSection')}
                            selected={type === DeliveryTypeEnum.C_SECTION}
                            onPress={() => setType(DeliveryTypeEnum.C_SECTION)}
                        />

                        <Text style={[styles.sheetLabel, globalStyles.fontRegular]}>{t('journey.delivery.outcomeLabel')}</Text>
                        <Option
                            label={t('journey.delivery.outcomeLive')}
                            selected={outcome === DeliveryOutcomeEnum.LIVE_BIRTH}
                            onPress={() => setOutcome(DeliveryOutcomeEnum.LIVE_BIRTH)}
                        />
                        <Option
                            label={t('journey.delivery.outcomeStill')}
                            selected={outcome === DeliveryOutcomeEnum.STILL_BIRTH}
                            onPress={() => setOutcome(DeliveryOutcomeEnum.STILL_BIRTH)}
                        />

                        {failed ? (
                            <Text style={[styles.sheetError, globalStyles.fontRegular]}>{t('journey.delivery.saveError')}</Text>
                        ) : null}

                        <TouchableOpacity
                            style={[styles.bigButton, styles.promptButton, (!date || !type || !outcome || saving) && { opacity: 0.5 }]}
                            onPress={saveBirth}
                            disabled={!date || !type || !outcome || saving}
                            accessibilityRole="button"
                        >
                            <Text style={[styles.bigButtonText, globalStyles.fontSemiBold]}>{t('journey.delivery.save')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.linkButton} onPress={() => setSheet(false)} accessibilityRole="button">
                            <Text style={[styles.linkText, globalStyles.fontSemiBold]}>{t('journey.delivery.cancel')}</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal visible={welcome} transparent animationType="fade" onRequestClose={() => finish()}>
                <Pressable style={styles.sheetBackdrop} onPress={() => finish()}>
                    <Pressable style={styles.sheet} onPress={() => {}}>
                        <Text style={[styles.sheetTitle, globalStyles.fontBold]}>{t('journey.delivery.welcomeTitle')}</Text>
                        <Text style={[styles.cardBody, globalStyles.fontRegular]}>{t('journey.delivery.welcomeBody')}</Text>
                        <TouchableOpacity
                            style={[styles.bigButton, styles.promptButton]}
                            onPress={() =>
                                finish(() =>
                                    navigation.navigate('ChatWithVivaAI', { flowSlug: FLOW_SLUGS[FlowType.BABY_ONBOARDING] }),
                                )
                            }
                            accessibilityRole="button"
                        >
                            <Text style={[styles.bigButtonText, globalStyles.fontSemiBold]}>{t('journey.delivery.addBaby')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.linkButton} onPress={() => finish()} accessibilityRole="button">
                            <Text style={[styles.linkText, globalStyles.fontSemiBold]}>{t('journey.delivery.later')}</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>

            <StillBirthSupportModal
                visible={support}
                onConsultExpert={() => finish(() => navigation.navigate('Experts'))}
                onChatWithViva={() => finish(() => navigation.navigate('ChatWithVivaAI'))}
                onDismiss={() => finish()}
            />
        </View>
    );
};

export default DeliveryPrompt;
