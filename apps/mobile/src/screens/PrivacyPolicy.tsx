import React from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const PrivacyPolicy = () => {
    // JavaScript to hide common navbar/header elements
    const hideNavbarJS = `
        (function() {
            var selectors = [
                'header', 'nav', '.header', '.navbar', '#header', '#navbar', 
                '.site-header', '.elementor-location-header', '.top-bar'
            ];
            selectors.forEach(function(selector) {
                var elements = document.querySelectorAll(selector);
                elements.forEach(function(el) {
                    el.style.display = 'none';
                });
            });
            // Adjust body padding if needed
            document.body.style.paddingTop = '0';
            document.body.style.marginTop = '0';
        })();
        true; // note: this is required, or it will sometimes fail on Android
    `;

    return (
        <SafeAreaView style={styles.container}>
            <WebView
                source={{ uri: "https://vivamama.in/privacy-policy/" }}
                injectedJavaScript={hideNavbarJS}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                scalesPageToFit={true}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
});

export default PrivacyPolicy;
