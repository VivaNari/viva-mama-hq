import RNDateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { Dispatch, Fragment, SetStateAction } from 'react'

interface ICustomDatePickerProps {
    show: boolean;
    setShow: Dispatch<SetStateAction<boolean>>;
    selectedDate: Date | null;
    onSelect: (date: Date) => void;
    minimumDate?: boolean;
    maximumDate?: Date;
}

const CustomDatePicker = ({
    show,
    setShow,
    selectedDate,
    onSelect,
    minimumDate = false,
    maximumDate
}: ICustomDatePickerProps) => {

    const handleChange = (event: DateTimePickerEvent, date?: Date) => {
        setShow(false);

        if (event.type === "set" && date) {
            onSelect(date);
        }
    };

    return (
        <Fragment>
            {show && (
                <RNDateTimePicker
                    value={selectedDate || new Date()}
                    mode="date"
                    display="default"
                    onChange={handleChange}
                    minimumDate={minimumDate ? new Date() : undefined}
                    maximumDate={maximumDate}
                />
            )}
        </Fragment>
    );
};

export default CustomDatePicker;