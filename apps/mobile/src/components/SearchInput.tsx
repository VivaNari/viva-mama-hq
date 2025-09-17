import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import React from 'react';
import { TextInput, View } from 'react-native';
import { colors } from '../public/assets/colors';


const SearchInput = () => {
    return (
        <View
            style={{
                borderColor: colors.purple,
                borderWidth: 2,
                marginBottom: 30,
                borderRadius: 20,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 10
            }}
        >
            <TextInput
                inputMode="text"
                placeholderTextColor={colors.black}
                cursorColor={colors.black}
                placeholder={"Search"}
                selectTextOnFocus={true}
                style={{ paddingVertical: 50, paddingHorizontal: 20, color: colors.black, flex: 1 }}
            />
            <MaterialDesignIcons name="magnify" color={colors.black} size={24} />
        </View>
    )
}

export default SearchInput