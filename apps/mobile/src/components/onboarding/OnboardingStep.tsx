import React from "react";
import { View, Text } from "react-native";
import { IOnboardingStepProps, IPHQQuestion, AnswersMap } from "../../types";
import { globalStyles } from "../../public/styles";
import PHQInputRenderer from "./PHQInputRenderer";

interface Props extends IOnboardingStepProps {
    onAnswerChange: (qIndex: number, value: any) => void;
    answers: AnswersMap;
    stepIndex: number;
}

const OnboardingStep: React.FC<Props> = ({
    phqsPerStep,
    step,
    currentStep,
    onAnswerChange,
    answers,
    stepIndex,
}) => {
    return (
        <View
            style={{
                flex: 1,
            }}
        >
            {currentStep === step &&
                phqsPerStep.map((singlePhq: IPHQQuestion, index: number) => {
                    const key = `${stepIndex}-${index}`;
                    const currentAnswer = answers[key] ?? singlePhq.answer;

                    return (
                        <View key={index} style={{ backgroundColor: '#fff', marginVertical: 10, padding: 10, borderRadius: 6 }}>
                            <Text
                                style={[globalStyles.headingxl, globalStyles.fontSemiBold, { marginBottom: 10 }]}
                            >
                                {singlePhq.question}
                            </Text>
                            {singlePhq.isMultichoice && (
                                <Text style={[{ textAlign: 'center' }, globalStyles.fontRegular]}>(multiple choice)</Text>
                            )}
                            <PHQInputRenderer
                                question={{ ...singlePhq, answer: currentAnswer }}
                                onChange={(value) => onAnswerChange(index, value)}
                            />
                        </View>
                    );
                })
            }
        </View>
    );
};

export default OnboardingStep;
