import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import SegmentedToggle from '../components/logs/SegmentedToggle';
import { useCapability } from '../context/SubscriptionContext';
import { colors } from '../public/assets/colors';
import { Capability } from '../types/entitlements.types';
import ArticleContent from './ArticleContent';
import Products from './Products';

type LibrarySection = 'articles' | 'products';

/**
 * The Library tab: articles and products under one roof.
 *
 * Some referral programs suppress products entirely for the mothers they refer. The
 * server is the enforcement, since it returns an empty list, but a section that only ever
 * shows "nothing here" reads as a broken app, so the toggle goes too and she sees articles.
 *
 * Products mounts only when she opens it, so its list-view analytics event still means
 * that she looked at products rather than that she opened the Library.
 */
const Library: React.FC = () => {
    const { t } = useTranslation();
    const productsLocked = useCapability(Capability.PRODUCTS_VIEW).locked;
    const [selected, setSelected] = useState<LibrarySection>('articles');

    const section: LibrarySection = productsLocked ? 'articles' : selected;

    return (
        <View style={{ flex: 1, backgroundColor: colors.white }}>
            {productsLocked ? null : (
                <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
                    <SegmentedToggle
                        variant="tab"
                        value={section}
                        onChange={setSelected}
                        options={[
                            { key: 'articles', label: t('content.libraryArticles') },
                            { key: 'products', label: t('nav.tabProducts') },
                        ]}
                    />
                </View>
            )}
            <View style={{ flex: 1 }}>
                {section === 'articles' ? <ArticleContent /> : <Products />}
            </View>
        </View>
    );
};

export default Library;
