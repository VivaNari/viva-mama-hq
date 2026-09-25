import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import {
    FlatList,
    ImageBackground,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { partnerData } from "../data/partnerData";
import { globalStyles } from "../public/styles";
import { styles } from "../public/styles/addPartnerStyles";
import Clipboard from "@react-native-clipboard/clipboard";
import { AnalyticsEvent, track } from "../analytics";


const AddPartner = () => {
    const { t } = useTranslation();
    const handleCopy = (data: string) => {
        console.log("Copied:", partnerData.code);
        Clipboard.setString(data)
        // Copying the invite code is the only observable "sharing" moment — the
        // partner actually joining happens on their device, not this one.
        track(AnalyticsEvent.REFERRAL_CODE_SHARED, { method: 'clipboard' });
    };

    return (
        <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>
            <ScrollView>
                {/* Top Section with BG */}
                <ImageBackground
                    source={require("../public/assets/images/Wave.png")}
                    resizeMode="cover"
                    style={[{
                        height: 'auto',
                        width: '100%',
                    }, styles.headerWrapper]}
                >
                    <View
                        style={{
                            padding: 20,
                            paddingTop: 70
                        }}
                    >
                        <Text style={[styles.headerTitle, globalStyles.fontBold]}>{t(partnerData.title)}</Text>
                        <Text style={[styles.headerSubtitle, globalStyles.fontRegular]}>{t('addPartner.benefitsHeading')}</Text>

                        {partnerData.benefits.map((benefit) => (
                            <Text key={benefit.id} style={[styles.benefitText, globalStyles.fontRegular]}>
                                • {t(benefit.text)}
                            </Text>
                        ))}
                    </View>
                </ImageBackground>

                <View
                    style={[globalStyles.container, { flex: 1 }]}
                >
                    <View style={styles.card}>
                        <View style={styles.codeRow}>
                            <Text style={[styles.label, globalStyles.fontMedium]}>{t('addPartner.yourCode')}</Text>
                            <TouchableOpacity style={styles.codeBox} onPress={() => handleCopy(partnerData.code)}>
                                <Text style={[styles.code, globalStyles.fontSemiBold]}>{partnerData.code}</Text>
                                <MaterialDesignIcons name="content-copy" size={18} color="#fff" style={{ marginLeft: 20 }} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <Text style={[styles.sensitiveText, globalStyles.fontRegular]}>
                        {t('addPartner.sensitiveData')}
                    </Text>

                    {/* Steps Section */}
                    <View style={[styles.card, { marginTop: 20 }]}>
                        <Text style={[styles.stepsTitle, globalStyles.fontMedium]}>{t('addPartner.stepsHeading')}</Text>
                        <FlatList
                            data={partnerData.steps}
                            keyExtractor={(item) => item.id.toString()}
                            scrollEnabled={false}
                            renderItem={({ item }) => (
                                <View style={styles.stepItem}>
                                    <Text style={[styles.stepTitle, globalStyles.fontRegular]}>{t(item.title)}</Text>
                                    <Text style={[styles.stepDescription, globalStyles.fontLight]}>{t(item.description)}</Text>
                                </View>
                            )}
                        />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default AddPartner;


