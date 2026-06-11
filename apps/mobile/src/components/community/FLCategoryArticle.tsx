import { Dimensions, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../public/assets/colors";
import { globalStyles } from "../../public/styles";
import { IContent } from "../../types/content.types";

const { width } = Dimensions.get("window");

const FLCategoryArticle = ({ item, navigation }: { item: IContent, navigation: { navigate: any } }) => {
    return (
        <View
            style={{
                width: (width - 60) / 2, // adjust for padding & gap
                marginBottom: 15,
            }}
        >
            <TouchableOpacity
                activeOpacity={0.8}
                style={{
                    borderRadius: 20,
                    overflow: 'hidden',
                }}
                onPress={() => navigation.navigate('ArticleDetails', { articleId: item.id })}
            >
                <ImageBackground
                    source={item.thumbnailImage}
                    resizeMode="cover"
                    style={{
                        height: 180,
                        width: '100%',
                        borderRadius: 20,
                        // overflow: 'hidden'
                        justifyContent: "flex-end",
                    }}>
                    <View style={{
                        ...StyleSheet.absoluteFillObject,
                        backgroundColor: "rgba(0,0,0,0.4)",
                    }} />
                    <Text style={[{
                        color: colors.white,
                        paddingHorizontal: 15,
                        fontSize: 13,
                        paddingVertical: 4,
                    }, globalStyles.fontLight]}>
                        {item.title}
                    </Text>
                </ImageBackground>
            </TouchableOpacity>
        </View>
    )
}

export default FLCategoryArticle;