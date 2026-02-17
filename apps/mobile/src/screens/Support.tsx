import Lucide from '@react-native-vector-icons/lucide';
import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { createSupport } from '../api/createSupport';
import GradientButtonWithSlightRadius from '../components/GradientButtonWithSlightRadius';
import { colors } from '../public/assets/colors';
import { globalStyles } from '../public/styles';

const SUPPORT_CATEGORIES = [
    { id: 'technical', label: 'Technical Issue', icon: 'monitor' },
    { id: 'medical', label: 'Medical Query', icon: 'stethoscope' },
    { id: 'feedback', label: 'Feedback', icon: 'message-square' },
    { id: 'other', label: 'Other', icon: 'headset' },
];

const Support = () => {
    const [selectedCategory, setSelectedCategory] = useState('technical');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!message.trim()) {
            Toast.show({
                type: 'error',
                text1: 'Required',
                text2: 'Please enter a message before submitting.',
                position: 'bottom'
            });
            return;
        }

        try {
            setLoading(true);
            const response = await createSupport(selectedCategory, message);

            if (response.success) {
                Toast.show({
                    type: 'success',
                    text1: 'Submitted',
                    text2: 'Your support request has been received. We will get back to you soon!',
                    position: 'bottom'
                });
                setMessage('');
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: response.message || 'Failed to submit support request.',
                    position: 'bottom'
                });
            }
        } catch (error) {
            console.error("Error submitting support:", error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Something went wrong. Please try again later.',
                position: 'bottom'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    style={{ flex: 1 }}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.iconCircle}>
                            <Lucide name="headset" size={32} color={colors.purple} />
                        </View>
                        <Text style={[styles.title, globalStyles.fontBold]}>How can we help?</Text>
                        <Text style={[styles.subtitle, globalStyles.fontRegular]}>
                            Choose a category and tell us what you need. Our team will get back to you as soon as possible.
                        </Text>
                    </View>

                    {/* Category Selection */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionLabel, globalStyles.fontSemiBold]}>Select Category</Text>
                        <View style={styles.categoryContainer}>
                            {SUPPORT_CATEGORIES.map((cat) => (
                                <TouchableOpacity
                                    key={cat.id}
                                    style={[
                                        styles.categoryItem,
                                        selectedCategory === cat.id && styles.categoryItemActive
                                    ]}
                                    onPress={() => setSelectedCategory(cat.id)}
                                    activeOpacity={0.7}
                                >
                                    <Lucide
                                        name={cat.icon as any}
                                        // name=""
                                        size={20}
                                        color={selectedCategory === cat.id ? colors.white : colors.darkGray}
                                    />
                                    <Text style={[
                                        styles.categoryLabel,
                                        globalStyles.fontMedium,
                                        selectedCategory === cat.id && styles.categoryLabelActive
                                    ]}>
                                        {cat.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Message Input */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionLabel, globalStyles.fontSemiBold]}>Your Message</Text>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={[styles.textInput, globalStyles.fontRegular]}
                                placeholder="Describe your issue or query here..."
                                placeholderTextColor={colors.darkGray}
                                multiline
                                numberOfLines={6}
                                textAlignVertical="top"
                                value={message}
                                onChangeText={setMessage}
                            />
                        </View>
                    </View>

                    <GradientButtonWithSlightRadius
                        onPress={handleSubmit}
                        title="Submit Request"
                        fullRounded
                        disabled={loading}
                    />

                    {/* Contact Info */}
                    <View style={styles.footer}>
                        <Text style={[styles.footerText, globalStyles.fontRegular]}>
                            You can also reach us at:
                        </Text>
                        <Text style={[styles.contactEmail, globalStyles.fontSemiBold]}>
                            connect@vivamama.in
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F9F9FB',
    },
    scrollContent: {
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
        marginTop: 10,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.purple + '40',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 24,
        color: colors.darkPurple,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: colors.darkGray,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 10,
    },
    section: {
        marginBottom: 24,
    },
    sectionLabel: {
        fontSize: 16,
        color: colors.darkPurple,
        marginBottom: 12,
    },
    categoryContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    categoryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.white,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#EEEEEE',
        gap: 8,
    },
    categoryItemActive: {
        backgroundColor: colors.purple,
        borderColor: colors.purple,
    },
    categoryLabel: {
        fontSize: 14,
        color: colors.darkGray,
    },
    categoryLabelActive: {
        color: colors.white,
    },
    inputContainer: {
        backgroundColor: colors.white,
        borderRadius: 5,
        padding: 16,
        borderWidth: 1,
        borderColor: '#EEEEEE',
        minHeight: 150,
    },
    textInput: {
        fontSize: 16,
        color: colors.black,
    },
    submitButtonContainer: {
        marginTop: 8,
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: colors.purple,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    submitButton: {
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
    },
    submitButtonText: {
        fontSize: 18,
        color: colors.white,
    },
    footer: {
        marginTop: 40,
        alignItems: 'center',
        marginBottom: 20,
    },
    footerText: {
        fontSize: 14,
        color: colors.darkGray,
        marginBottom: 4,
    },
    contactEmail: {
        fontSize: 16,
        color: colors.purple,
    },
});

export default Support;