
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as React from 'react';
import SubscriptionDetails from '../../components/SubscriptionDetails';
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
import PrivacyPolicy from '../../screens/PrivacyPolicy';
import Products from '../../screens/Products';
import RecommendationDetails from '../../screens/RecommendationDetails';
import Recommendations from '../../screens/Recommendations';
import SubCategoryArticles from '../../screens/SubCategoryArticles';
import TermsOfUse from '../../screens/TermsOfUse';
import VaccinationLog from '../../screens/VaccinationLog';
import VivaClubPost from '../../screens/VivaClubPost';
import VivaClubPostDetails from '../../screens/VivaClubPostDetails';
import { DashboardTabs } from '../tabs/DashboardTabs';
import ChatWithVivaAi from '../../screens/ChatWithVivaAI';

const Stack = createNativeStackNavigator();

const AppStack = () => {
    return (
        <Stack.Navigator
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
            
            <Stack.Screen
                name="DashboardTabNavigator"
                component={DashboardTabs}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: "Recommendations"
                }}
                name="Recommendations"
                component={Recommendations}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: "Recommendation Detials"
                }}
                name="RecommendationDetails"
                component={RecommendationDetails}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: "Full Report"
                }}
                name="FullReport"
                component={FullReport}
            />

            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Suggested Products',
                }}
                name="Products"
                component={Products}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Content',
                }}
                name="Content"
                component={ArticleContent}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: "Viva AI"
                }}
                name="ChatWithVivaAI"
                component={ChatWithVivaAi as any}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Viva Club',
                }}
                name="VivaClub"
                component={VivaClubPost}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Viva Club Post',
                }}
                name="VivaClubPostDetails"
                component={VivaClubPostDetails}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Create Post',
                }}
                name="CreatePost"
                component={CreatePost}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Articles',
                }}
                name="CategoryArticles"
                component={CategoryArticles}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Articles',
                }}
                name="SubCategoryArticles"
                component={SubCategoryArticles}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Article Details',
                }}
                name="ArticleDetails"
                component={ArticleDetails}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Expert Details',
                }}
                name="ExpertDetails"
                component={ExpertDetails}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Subscription Details',
                }}
                name="SubscriptionDetails"
                component={SubscriptionDetails}
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
                    title: 'Edit Profile',
                }}
                name="EditProfile"
                component={EditProfile}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Add Partner',
                }}
                name="AddPartner"
                component={AddPartner}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Notifications',
                }}
                name="Notifications"
                component={Notifications}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Terms of Use',
                }}
                name="TermsOfUse"
                component={TermsOfUse}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Privacy Policy',
                }}
                name="PrivacyPolicy"
                component={PrivacyPolicy}
            />
            {/* Infant screens */}
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Feeding Log',
                }}
                name="FeedingLog"
                component={FeedingLog}
            />
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Vaccination Log',
                }}
                name="VaccinationLog"
                component={VaccinationLog}
            />
        </Stack.Navigator>
    );
}

export default AppStack;