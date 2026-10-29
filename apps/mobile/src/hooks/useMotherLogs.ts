import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { addMotherLog, deleteMotherLog, getMotherLogs } from '../api/motherLogs.api';
import { AppendLogType, MotherLog } from '../types/motherLog.types';
import { showLogError, todayKey } from '../utils/motherLogHelpers';

/**
 * Load, add and remove appended logs for one screen.
 *
 * `todayOnly` scopes the list to today (pumping sessions, meals); without it the list is
 * her most recent entries across days (recent readings). Reloaded on focus.
 */
export const useMotherLogs = ({
    types,
    todayOnly = false,
    limit = 100,
}: {
    types: AppendLogType[];
    todayOnly?: boolean;
    limit?: number;
}) => {
    const { t } = useTranslation();
    const [logs, setLogs] = useState<MotherLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const typesKey = types.join(',');

    const load = useCallback(async () => {
        try {
            const today = todayKey();
            const data = await getMotherLogs({
                types: typesKey.split(',') as AppendLogType[],
                limit,
                ...(todayOnly ? { from: today, to: today } : {}),
            });
            setLogs(data);
        } catch (error) {
            showLogError(t, 'load', error, `useMotherLogs.load.${typesKey}`);
        } finally {
            setLoading(false);
        }
    }, [limit, t, todayOnly, typesKey]);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load]),
    );

    /** Save an entry and put it at the top of the list. Resolves false on failure. */
    const add = async (logType: AppendLogType, fields: Record<string, any>): Promise<boolean> => {
        setSaving(true);
        try {
            const created = await addMotherLog(logType, fields);
            setLogs(prev => [created, ...prev]);
            return true;
        } catch (error) {
            showLogError(t, 'save', error, `useMotherLogs.add.${logType}`);
            return false;
        } finally {
            setSaving(false);
        }
    };

    /** Ask, then remove one of today's entries. */
    const confirmRemove = (log: MotherLog) =>
        Alert.alert(t('logs.common.removeTitle'), t('logs.common.removeBody'), [
            { text: t('logs.common.cancel'), style: 'cancel' },
            {
                text: t('logs.common.remove'),
                style: 'destructive',
                onPress: async () => {
                    const before = logs;
                    setLogs(prev => prev.filter(entry => entry._id !== log._id));
                    try {
                        await deleteMotherLog(log._id);
                    } catch (error) {
                        setLogs(before);
                        showLogError(t, 'delete', error, `useMotherLogs.remove.${log.logType}`);
                    }
                },
            },
        ]);

    /** Only today's entries can be removed; older ones are history. */
    const canRemove = (log: MotherLog) => log.logDate === todayKey();

    return { logs, loading, saving, add, confirmRemove, canRemove };
};
