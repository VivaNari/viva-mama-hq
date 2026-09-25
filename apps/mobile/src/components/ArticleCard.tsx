import { useNavigation } from "@react-navigation/native";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { globalStyles } from "../public/styles";
import { ContentBodyTypeEnum, IContentBody, IUserContent } from "../types/content.types";
import DashboardCard from "./dashboard/DashboardCard";
import { colors } from "../public/assets/colors";
import { useSubscriptionContext } from "../context/SubscriptionContext";
import LockedOverlay from "./subscriptions/LockedOverlay";
import Lucide from "@react-native-vector-icons/lucide";
import { AnalyticsEvent, track } from "../analytics";

export const ArticleCard = ({ item, width }: { item: IUserContent, width?: string }) => {
    const navigation = useNavigation() as any;
    const { openPaywall } = useSubscriptionContext();

    // Decided by the server, which has already stripped `contentBody` from the payload.
    // The title and image are deliberately still shown: seeing that an article exists is
    // what makes the paywall persuasive rather than the list just looking short.
    const locked = item.isLocked === true;

    return (
        <View
            style={{
                paddingHorizontal: 1,
                width: width === 'full' ? 'auto' : '48%',
            }}
        >
            {/* Fills the height the grid row hands down, so both cards in a row end up
                the same size. flexGrow rather than flex: it leaves the basis on `auto`,
                so the full-width usage — whose parent has no height to hand down — still
                sizes to its content. */}
            <DashboardCard style={{ flexGrow: 1 }}>
                <LockedOverlay
                    locked={locked}
                    onPress={() => openPaywall()}
                    style={{ borderRadius: 8, flexGrow: 1 }}
                >
                    <TouchableOpacity
                        // A locked card must not open the detail screen.
                        onPress={() => {
                            if (locked) {
                                openPaywall();
                                return;
                            }
                            track(AnalyticsEvent.SELECT_CONTENT, {
                                content_type: 'article',
                                item_id: item._id,
                            });
                            navigation.navigate("ArticleDetails", { articleId: item._id });
                        }}
                        activeOpacity={0.8}
                        style={styles.articleCard}
                    >
                        <View
                            style={{
                                position: "relative",
                                width: "100%",
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            <Image source={{ uri: item.featuredImage }} style={{
                                ...styles.articleImage,
                                height: width === 'full' ? 250 : 150,
                                width: '100%',
                                borderRadius: 8,
                                resizeMode: 'contain'
                            }} />

                            {
                                item.contentBody?.find((item1: IContentBody) => item1.contentType === ContentBodyTypeEnum.VIDEO) && (
                                    <View
                                        style={{
                                            position: "absolute",
                                            padding: 10,
                                            borderRadius: 50,
                                            backgroundColor: colors.white,
                                            top: '50%',
                                            left: '50%',
                                            transform: [
                                                { translateX: '-50%' },
                                                { translateY: '-50%' },
                                            ],
                                        }}
                                    >
                                        <Lucide name="play" size={20} color={colors.darkPurple} />
                                    </View>
                                )
                            }
                        </View>

                        <View style={{ flex: 1, marginTop: 5, marginHorizontal: 8 }}>
                            <Text style={[styles.articleTitle, globalStyles.fontSemiBold]} numberOfLines={3}>
                                {item.featuredTitle}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </LockedOverlay>
            </DashboardCard>
        </View>
    );
};

const styles = StyleSheet.create({
    articleCard: {
        marginBottom: 12,
        flex: 1,
        alignItems: "center",
    },
    articleImage: {},
    articleTitle: {
        fontSize: 16,
    },
    articleDesc: {
        fontSize: 10,
        color: "#555",
        marginTop: 2,
    },
})