import { useRoute } from "@react-navigation/native";
import React from "react";
import {
    Image,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { expertData } from "../data/expertData";
import { globalStyles } from "../public/styles";
import { ContentDetailsStyles } from "../public/styles/contentStyles";
import { IExpert } from "../types/expert.types";
import LinearGradient from "react-native-linear-gradient";
import { colors } from "../public/assets/colors";


const ExpertDetails = () => {
    const route = useRoute<any>();
    const { expertId, category } = route.params;

    let expert: IExpert | undefined;

    for (const category of expertData) {
        const found = category.experts.find((c: IExpert) => c.id === expertId);
        if (found) {
            expert = found;
            break;
        }
    }

    if (!expert) {
        return (
            <SafeAreaView style={ContentDetailsStyles.center}>
                <Text>Expert not found.</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[globalStyles.container]}>
            <ScrollView contentContainerStyle={ContentDetailsStyles.scrollContent} horizontal={false}>

                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 15,
                        marginBottom: 20,
                    }}
                >
                    <Image
                        source={expert.avatar}
                        style={{ height: 150, width: 150, borderRadius: 10 }}
                    />
                    <View style={{ flex: 1 }}>
                        <Text style={{
                            fontSize: 22,
                            fontWeight: 600
                        }}>{expert.name}</Text>
                        <Text style={{
                            fontSize: 14,
                            fontWeight: 400,
                            marginVertical: 4,
                            color: 'rgba(0, 0, 0, 0.6)'
                        }}>{category}</Text>
                        <Text style={{
                            fontSize: 14,
                            fontWeight: 500
                        }}>{expert.remuneration}</Text>

                    </View>
                </View>
                <View>

                    <Text style={{
                        fontSize: 14,
                        fontWeight: 500
                    }}>{expert.description}</Text>
                </View>
            </ScrollView>

            <View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    gap: 10
                }}
            >
                <LinearGradient
                    colors={[colors.primary, colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    onMagicTap={() => { console.log("Hello") }}
                    style={{
                        borderRadius: 10,
                        justifyContent: "center",
                        alignItems: "center",
                        paddingVertical: 15,
                        paddingHorizontal: 10,
                        flex: 1,
                        marginTop: 10
                    }}
                >
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => { }}
                    >
                        <Text
                            style={{
                                color: colors.white
                            }}
                        >Schedule Call</Text>
                    </TouchableOpacity>
                </LinearGradient>
                <LinearGradient
                    colors={[colors.primary, colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                        borderRadius: 10,
                        justifyContent: "center",
                        alignItems: "center",
                        paddingVertical: 15,
                        paddingHorizontal: 10,
                        flex: 1,
                        marginTop: 10
                    }}
                >
                    <TouchableOpacity
                        activeOpacity={0.8}
                    >
                        <Text
                            style={{
                                color: colors.white,
                                fontSize: 14
                            }}
                        >Book on Whatsapp</Text>
                    </TouchableOpacity>
                </LinearGradient>
            </View>
        </SafeAreaView>
    );
};

export default ExpertDetails;


