import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, Text } from "react-native";
import { phqdata } from "../data/phqData";
import OnboardingStep from "../components/onboarding/OnboardingStep";
import LinearGradient from "react-native-linear-gradient";
import { colors } from "../public/assets/colors";
import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import { AnswerValue, AnswersMap, IOnboardingStep } from "../types";
import { globalStyles, onboardingStyles } from "../public/styles";
import { SafeAreaView } from "react-native-safe-area-context";

const OnboardingSteps = ({ navigation }: { navigation: { navigate: any } }) => {
    const [currentStep, setCurrentStep] = useState<number>(1);

    // 👇 Only answers are stored
    const [answers, setAnswers] = useState<AnswersMap>({});

    // 👇 function to update an answer
    const updateAnswer = (
        stepIndex: number,
        questionIndex: number,
        value: AnswerValue
    ) => {
        const key = `${stepIndex}-${questionIndex}`;
        setAnswers((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    useEffect(() => {
        console.log("Current Answers:", answers);
    }, [answers])

    return (
        <SafeAreaView style={[globalStyles.container]}>
            {/* Progress bar */}
            <View
                style={{
                    backgroundColor: colors.offWhite,
                    borderRadius: 10,
                    marginTop: 20,
                }}
            >
                <LinearGradient
                    colors={[colors.primary, colors.secondary]}
                    style={{
                        height: 10,
                        borderRadius: 10,
                        width: `${(currentStep / phqdata.length) * 100}%`,
                    }}
                />
            </View>
            <View style={{ marginTop: 30 }}>
                {
                    currentStep == 1 && (
                        <View>
                            <Text style={onboardingStyles.welcomeText}>Welcome</Text>
                            <Text style={onboardingStyles.welcomeTextCaption}>to Viva nari</Text>
                        </View>
                    )
                }
            </View>

            {/* Steps */}
            <ScrollView style={{ flex: 1, marginTop: "40%" }}>
                <View>
                    {phqdata.map((stepData: IOnboardingStep, index: number) => (
                        <OnboardingStep
                            key={index}
                            phqsPerStep={stepData.phq}
                            step={index + 1}
                            phqLength={phqdata.length}
                            currentStep={currentStep}
                            onAnswerChange={(qIndex, value) =>
                                updateAnswer(index, qIndex, value)
                            }
                            answers={answers}
                            stepIndex={index}
                        />
                    ))}
                </View>
            </ScrollView>

            {/* Navigation buttons */}
            <View
                style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                {currentStep !== 1 ? (
                    <TouchableOpacity
                        onPress={() => setCurrentStep(currentStep - 1)}
                        style={{ marginVertical: 20, height: 45, width: 45 }}
                    >
                        <LinearGradient
                            colors={[colors.primary, colors.secondary]}
                            style={{
                                height: "100%",
                                width: "100%",
                                borderRadius: 40,
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            <MaterialDesignIcons name="arrow-left" color="#fff" size={20} />
                        </LinearGradient>
                    </TouchableOpacity>
                ) : (
                    <View style={{ height: 45, width: 45 }} />
                )}

                {currentStep < phqdata.length ? (
                    <TouchableOpacity
                        onPress={() => setCurrentStep(currentStep + 1)}
                        style={{ marginVertical: 20, height: 45, width: 45 }}
                    >
                        <LinearGradient
                            colors={[colors.primary, colors.secondary]}
                            style={{
                                height: "100%",
                                width: "100%",
                                borderRadius: 40,
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            <MaterialDesignIcons name="arrow-right" color="#fff" size={20} />
                        </LinearGradient>
                    </TouchableOpacity>
                ) : (
                    // Navigate to dashboard
                    <TouchableOpacity
                        onPress={() => navigation.navigate("DashboardTabNavigator")}
                        style={{ marginVertical: 20, height: 45, width: 45 }}
                    >
                        <LinearGradient
                            colors={[colors.primary, colors.secondary]}
                            style={{
                                height: "100%",
                                width: "100%",
                                borderRadius: 40,
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            <MaterialDesignIcons name="arrow-right" color="#fff" size={20} />
                        </LinearGradient>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
};

export default OnboardingSteps;
