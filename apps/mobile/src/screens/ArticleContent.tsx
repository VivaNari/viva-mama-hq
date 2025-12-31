import React, { useEffect, useMemo, useState } from 'react'
import { FlatList, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getUserContents } from '../api/getUserContents'
import { ArticleCard } from '../components/ArticleCard'
import SearchInput from '../components/SearchInput'
import { useAuth } from '../context/AuthContext'
import { globalStyles } from '../public/styles'
import { IUserContent, IUserContentresponse } from '../types/content.types'

const ArticleContent = () => {
    const [searchData, setSearchData] = useState<string>("");
    const [userContentsData, setUserContentsData] = useState<IUserContent[]>([]);
    const { userId } = useAuth();

    useEffect(() => {
        (async () => {
            const getContents: IUserContentresponse = await getUserContents();
            setUserContentsData(getContents.data);
        })()
    }, [userId])
    useEffect(() => {
        console.log("searchData", searchData);
    }, [searchData])

    const filteredData = useMemo(() => {
        if (!searchData.trim()) return userContentsData;

        return userContentsData.filter(content => content.featuredTitle.toLowerCase().includes(searchData.toLowerCase()))
    }, [searchData, userContentsData]);

    return (
        <SafeAreaView style={[globalStyles.container]}>
            <FlatList
                data={filteredData.slice(1)}
                keyExtractor={(item) => item._id.toString()}
                renderItem={({ item }) => (
                    <ArticleCard
                        key={item._id.toString()}
                        item={item}

                    />
                )}
                scrollEnabled={true}
                nestedScrollEnabled={false}
                columnWrapperStyle={{
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    paddingBottom: 20
                }}
                numColumns={2}
                ListHeaderComponent={
                    <>

                        {/* Search */}
                        <View style={{}}>
                            <SearchInput setSearchData={setSearchData} marginBottom={5} />
                        </View>
                        <FlatList
                            data={filteredData.slice(0, 1)}
                            keyExtractor={(item) => item._id.toString()}
                            renderItem={({ item }) => (
                                <ArticleCard
                                    key={item._id.toString()}
                                    item={item}
                                    width='full'
                                />
                            )}
                            scrollEnabled={false}
                            nestedScrollEnabled={false}
                        />
                    </>
                }
                style={{
                    paddingTop: 20
                }}
            />
        </SafeAreaView>
    )
}

export default ArticleContent
