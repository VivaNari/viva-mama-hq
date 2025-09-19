import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import React from "react";
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


const AddPartner = () => {
    const handleCopy = (data: string) => {
        console.log("Copied:", partnerData.code);
        Clipboard.setString(data)

    };

    return (
        <SafeAreaView style={{ flex: 1 }}>
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
                        <Text style={styles.headerTitle}>{partnerData.title}</Text>
                        <Text style={styles.headerSubtitle}>Benefits of adding your partner</Text>

                        {partnerData.benefits.map((benefit) => (
                            <Text key={benefit.id} style={styles.benefitText}>
                                • {benefit.text}
                            </Text>
                        ))}
                    </View>
                </ImageBackground>

                <View
                    style={[globalStyles.container, { flex: 1 }]}
                >
                    <View style={styles.card}>
                        <View style={styles.codeRow}>
                            <Text style={styles.label}>Your code</Text>
                            <TouchableOpacity style={styles.codeBox} onPress={() => handleCopy(partnerData.code)}>
                                <Text style={styles.code}>{partnerData.code}</Text>
                                <MaterialDesignIcons name="content-copy" size={18} color="#fff" style={{ marginLeft: 20 }} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <Text style={styles.sensitiveText}>
                        Please be careful this is your sensitive data
                    </Text>

                    {/* Steps Section */}
                    <View style={[styles.card, { marginTop: 20 }]}>
                        <Text style={styles.stepsTitle}>Steps to connect your partner</Text>
                        <FlatList
                            data={partnerData.steps}
                            keyExtractor={(item) => item.id.toString()}
                            scrollEnabled={false}
                            renderItem={({ item }) => (
                                <View style={styles.stepItem}>
                                    <Text style={styles.stepTitle}>{item.title}</Text>
                                    <Text style={styles.stepDescription}>{item.description}</Text>
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


