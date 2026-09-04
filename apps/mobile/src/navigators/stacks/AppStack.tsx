
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import LanguageSelection from '../../screens/LanguageSelection';
// The legacy hardcoded-plan screen is replaced by the server-driven catalog.
import SubscriptionDetails from '../../screens/Subscription';
import { colors } from '../../public/assets/colors';
import { globalStyles } from '../../public/styles';
import AddPartner from '../../screens/AddPartner';
import ArticleContent from '../../screens/ArticleContent';
import ArticleDetails from '../../screens/ArticleDetails';
import CategoryArticles from '../../screens/CategoryArticles';
import CreatePost from '../../screens/CreatePost';
import EditProfile from '../../screens/EditProfile';
import ExpertDetails from '../../screens/ExpertDetails';
import FeedingLog from '../../screens/FeedingLog';
import FullReport from '../../screens/FullReport';
import MyProfile from '../../screens/MyProfile';
import Notifications from '../../screens/Notifications';
import Products from '../../screens/Products';
import RecommendationDetails from '../../screens/RecommendationDetails';
import Recommendations from '../../screens/Recommendations';
import SubCategoryArticles from '../../screens/SubCategoryArticles';
import VaccinationLog from '../../screens/VaccinationLog';
import VivaClubPost from '../../screens/VivaClubPost';
import VivaClubPostDetails from '../../screens/VivaClubPostDetails';
import { DashboardTabs } from '../tabs/DashboardTabs';
import ChatWithVivaAi from '../../screens/ChatWithVivaAI';
import ProductDetails from '../../screens/ProductDetails';
// The 'Services' route showed hardcoded plans and mock product data; it now renders
// the same server-driven catalog as SubscriptionDetails.
import Services from '../../screens/Subscription';
import ConsultationRating from '../../screens/ConsultationRating';
import MyConsultations from '../../screens/MyConsultations';
import MySubscription from '../../screens/MySubscription';
import BookmarkedMessages from '../../screens/BookmarkedMessages';
import AboutVivaMama from '../../screens/AboutVivaMama';
import AboutVivaAI from '../../screens/AboutVivaAI';
import Support from '../../screens/Support';
import AboutRecoveryScore from '../../screens/AboutRecoveryScore';
import MoodLog from '../../screens/MoodLog';

const Stack = createNativeStackNavigator();

const AppStack = () => {
    const { t } = useTranslation();
    const { hasSelectedLanguage, isLanguageReady } = useLanguage();

    // Wait for the saved-language read so we don't flash the dashboard before
    // routing pre-feature users (who never chose) to the mandatory gate.
    if (!isLanguageReady) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.pageBG }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const initialRouteName = hasSelectedLanguage ? "DashboardTabNavigator" : "LanguageSelection";

    return (
        <Stack.Navigator
            initialRouteName={initialRouteName}
            screenOptions={{
                animation: "fade_from_bottom",
                statusBarAnimation: "slide",
                headerShadowVisible: false,
                headerTitleStyle: { ...globalStyles.fontBold, fontSize: 18 },
                headerStyle: {
                    backgroundColor: colors.pageBG
                }
            }}
        >
            {/* Mandatory gate for users who predate the feature and never chose
                a language; replaces itself with the dashboard once chosen. */}
            <Stack.Screen
                name="LanguageSelection"
                component={LanguageSelection}
                options={{ headerShown: false }}
                initialParams={{ mode: "gate", next: "DashboardTabNavigator" }}
            />

            <Stack.Screen
                name="DashboardTabNavigator"
                component={DashboardTabs}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.recommendations')
                }}
                name="Recommendations"
                component={Recommendations}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.recommendationDetails')
                }}
                name="RecommendationDetails"
                component={RecommendationDetails}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.fullReport')
                }}
                name="FullReport"
                component={FullReport}
            />

            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.suggestedProducts'),
                }}
                name="Products"
                component={Products}
            />

            <Stack.Screen
                options={{
                    headerShown: false,
                    title: 'Product',
                }}
                name="ProductDetails"
                component={ProductDetails}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.content'),
                }}
                name="Content"
                component={ArticleContent}
            />
            <Stack.Screen
                options={{
                    headerShown: false,
                    title: "Viva AI"
                }}
                name="ChatWithVivaAI"
                component={ChatWithVivaAi as any}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.bookmarkedMessages')
                }}
                name="BookmarkedMessages"
                component={BookmarkedMessages}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.vivaClub'),
                }}
                name="VivaClub"
                component={VivaClubPost}
            />
            <Stack.Screen
                options={{
                    // The screen renders its own header so the comment box can sit inside a
                    // KeyboardAvoidingView that spans the full window (same as ChatWithVivaAI).
                    headerShown: false,
                    title: t('nav.vivaClubPost'),
                }}
                name="VivaClubPostDetails"
                component={VivaClubPostDetails}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.createPost'),
                }}
                name="CreatePost"
                component={CreatePost}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.articles'),
                }}
                name="CategoryArticles"
                component={CategoryArticles}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.articles'),
                }}
                name="SubCategoryArticles"
                component={SubCategoryArticles}
            />
            <Stack.Screen
                options={{
                    headerShown: false,
                    title: 'Article Details',
                }}
                name="ArticleDetails"
                component={ArticleDetails}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.expertDetails'),
                }}
                name="ExpertDetails"
                component={ExpertDetails}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.subscriptionDetails'),
                }}
                name="SubscriptionDetails"
                component={SubscriptionDetails}
            />
            <Stack.Screen
                options={{
                    headerShown: false,
                    title: "Services"
                }}
                name="Services"
                component={Services as any}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'My Profile',
                }}
                name="MyProfile"
                component={MyProfile}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.editProfile'),
                }}
                name="EditProfile"
                component={EditProfile}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.addPartner'),
                }}
                name="AddPartner"
                component={AddPartner}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.notifications'),
                }}
                name="Notifications"
                component={Notifications}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.aboutVivaMama'),
                }}
                name="AboutVivaMama"
                component={AboutVivaMama}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                }}
                name="AboutVivaAI"
                component={AboutVivaAI}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.support'),
                }}
                name="Support"
                component={Support}
            />
            {/* Infant screens */}
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.feedingLog'),
                }}
                name="FeedingLog"
                component={FeedingLog}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.vaccinationLog'),
                }}
                name="VaccinationLog"
                component={VaccinationLog}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.consultationRating'),
                }}
                name="ConsultationRating"
                component={ConsultationRating}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.myConsultations'),
                }}
                name="MyConsultations"
                component={MyConsultations}
            />
            {/* Registered here only, so the screen uses a literal `edges` array rather
                than useScreenEdges — there is no second context for it to resolve. */}
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.mySubscription'),
                }}
                name="MySubscription"
                component={MySubscription}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.aboutRecoveryScore'),
                }}
                name="AboutRecoveryScore"
                component={AboutRecoveryScore}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t('nav.moodLog'),
                }}
                name="MoodLog"
                component={MoodLog}
            />
        </Stack.Navigator>
    );
}

export default AppStack;