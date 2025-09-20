import { useRoute } from "@react-navigation/native";
import React from "react";
import {
    Image,
    ScrollView,
    Text,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientButtonWithSlightRadius from "../components/GradientButtonWithSlightRadius";
import { expertData } from "../data/expertData";
import { globalStyles } from "../public/styles";
import { ContentDetailsStyles } from "../public/styles/contentStyles";
import { IExpert } from "../types/expert.types";


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
                <Text
                    style={[globalStyles.fontRegular]}
                >
                    Expert not found.

                </Text>
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
                        <Text style={[{
                            fontSize: 20,
                            fontWeight: 600
                        }, globalStyles.fontSemiBold]}>{expert.name}</Text>
                        <Text style={[{
                            fontSize: 12,
                            fontWeight: 400,
                            marginVertical: 4,
                            color: 'rgba(0, 0, 0, 0.6)'
                        }, globalStyles.fontRegular]}>{category}</Text>
                        <Text style={[{
                            fontSize: 12,
                            fontWeight: 500
                        }, globalStyles.fontRegular]}>{expert.remuneration}</Text>

                    </View>
                </View>
                <View>

                    <Text style={[{
                        fontSize: 12,
                        fontWeight: 500
                    }, globalStyles.fontRegular]}>{expert.description}</Text>
                </View>
            </ScrollView>

            <View
                style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    gap: 10,
                }}
            >
                <GradientButtonWithSlightRadius onPress={() => { }} title="Schedule Call" />
                <GradientButtonWithSlightRadius onPress={() => { }} title="Book on Whatsapp" />

            </View>
        </SafeAreaView>
    );
};

export default ExpertDetails;


