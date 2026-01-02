import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { IPHQQuestion } from "../../types";
import { colors } from "../../public/assets/colors";
import { globalStyles } from "../../public/styles";
import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";

interface Props {
    question: IPHQQuestion;
    onChange: (value: any) => void;
}

const PHQInputRenderer: React.FC<Props> = ({ question, onChange }) => {
    const [showDatePicker, setShowDatePicker] = useState(false);

    switch (question.answerType) {
        case "text":
            return (
                <TextInput
                    inputMode="text"
                    selectionColor={colors.darkPurple}
                    placeholderTextColor={colors.white}
                    cursorColor={colors.white}
                    placeholder={question.placeholder}
                    style={[globalStyles.input, globalStyles.fontRegular]}
                    value={typeof question.answer === "string" ? question.answer : ""}
                    onChangeText={onChange}

                />

            );

        case "numeric":
            return (
                <TextInput
                    inputMode="numeric"
                    selectionColor={colors.darkPurple}
                    placeholderTextColor={colors.white}
                    placeholder={question.placeholder}
                    style={[globalStyles.input, globalStyles.fontRegular]}
                    keyboardType="numeric"
                    value={
                        typeof question.answer === "number"
                            ? String(question.answer)
                            : ""
                    }
                    onChangeText={(val) => onChange(Number(val))}
                />
            );

        case "select":
            return (
                <View style={{ marginVertical: 8 }}>
                    {question.options.map((opt) => {
                        const isSelected = question.isMultichoice
                            ? Array.isArray(question.answer) &&
                            (question.answer as (string | number)[]).includes(opt.value)
                            : question.answer === opt.value;

                        return (
                            <TouchableOpacity
                                activeOpacity={0.8}
                                key={opt.value}
                                onPress={() => {
                                    if (question.isMultichoice) {
                                        const current = Array.isArray(question.answer)
                                            ? (question.answer as (string | number)[])
                                            : [];
                                        if (current.includes(opt.value)) {
                                            onChange(current.filter((v) => v !== opt.value));
                                        } else {
                                            onChange([...current, opt.value]);
                                        }
                                    } else {
                                        onChange(opt.value);
                                    }
                                }}
                                style={[isSelected ? globalStyles.inputSelected : globalStyles.input]}
                            >
                                <Text
                                    style={[{
                                        color: colors.white,
                                    }, globalStyles.fontRegular]}
                                >
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            );

        case "datetime":
            return (
                <View>
                    <TouchableOpacity
                        style={[globalStyles.input, { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }]}
                        onPress={() => setShowDatePicker(true)}
                    >
                        <Text style={[{ color: colors.white }, globalStyles.fontRegular]}>
                            {question.answer
                                ? new Date(question.answer as string).toLocaleDateString()
                                : "Select Date"}

                        </Text>
                        <MaterialDesignIcons name="calendar-month-outline" color={colors.white} size={20} />
                    </TouchableOpacity>

                    {showDatePicker && (
                        <DateTimePicker
                            value={
                                typeof question.answer === "string" &&
                                    !isNaN(Date.parse(question.answer))
                                    ? new Date(question.answer)
                                    : new Date()
                            }
                            mode="date"
                            onChange={(_, date) => {
                                setShowDatePicker(false);
                                if (date) {
                                    onChange(date.toISOString());
                                }
                            }}
                        />
                    )}
                </View>
            );

        default:
            return null;
    }
};

export default PHQInputRenderer;
