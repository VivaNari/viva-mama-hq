import React, { useCallback, useMemo, useState } from 'react';
import { Linking } from 'react-native';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';

import { getHealthRecordFileUrl } from '../../api/healthRecords.api';
import { IMessageAttachment } from '../../types/chat.types';
import { IHealthRecord } from '../../types/healthRecords.types';
import ImageViewerModal, { TResolveImageUrl } from '../chatAttachments/ImageViewerModal';

/**
 * Opening a record's files: photos in the in-app zoomable viewer, a PDF in the phone's
 * own viewer through a short-lived link (never a third-party viewer).
 */
export const useRecordViewer = () => {
    const { t } = useTranslation();
    const [viewer, setViewer] = useState<{ recordId: string; images: IMessageAttachment[]; index: number } | null>(
        null,
    );

    const open = useCallback(
        async (record: Pick<IHealthRecord, 'id' | 'files'>, index = 0) => {
            const first = record.files[0];
            if (!first) return;
            if (first.kind === 'PDF') {
                try {
                    const { url } = await getHealthRecordFileUrl(record.id, first.id);
                    await Linking.openURL(url);
                } catch {
                    Toast.show({ type: 'error', text1: t('healthRecords.couldNotOpen'), position: 'bottom' });
                }
                return;
            }
            setViewer({
                recordId: record.id,
                index,
                images: record.files.map(f => ({
                    id: f.id,
                    kind: 'IMAGE',
                    width: f.width ?? undefined,
                    height: f.height ?? undefined,
                })) as IMessageAttachment[],
            });
        },
        [t],
    );

    const resolveUrl = useMemo<TResolveImageUrl>(
        () => image => getHealthRecordFileUrl(viewer?.recordId ?? '', image.id),
        [viewer?.recordId],
    );

    const element = (
        <ImageViewerModal
            visible={!!viewer}
            images={viewer?.images ?? []}
            initialIndex={viewer?.index ?? 0}
            onClose={() => setViewer(null)}
            resolveUrl={resolveUrl}
        />
    );

    return { open, element };
};
