import { Dimensions, StyleSheet } from 'react-native';
import { colors } from '../assets/colors';
const { width } = Dimensions.get('window');

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff9fb' },
  header: { fontSize: 28, fontWeight: '800', marginBottom: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    alignSelf: 'center',
    marginBottom: 12,
  },
  segmentRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: colors.subscriptionTabInactiveBG,
    borderRadius: 6,
    overflow: 'hidden',
  },
  segmentBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  segmentBtnActive: {
    backgroundColor: colors.subscriptionTabActiveBG,
  },
  segmentText: { fontWeight: '700' },
  segmentTextActive: { color: '#fff' },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.SubscriptionOptionsBG,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(139,92,246,0.35)',
  },
  planRowSelected: {
    backgroundColor: colors.SubscriptionOptionsBG,
    borderColor: colors.subscriptionTabActiveBG,
  },
  planTitle: { fontSize: 20, fontWeight: '800' },
  planSub: { fontSize: 12, color: '#4b2a6a', marginTop: 6 },
  planPrice: { fontSize: 16, fontWeight: '700', marginLeft: 12 },

  productItem: {
    width: (width - 18 * 2 - 16) / 2,
    marginTop: 12,
  },
  productThumb: {
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f1e7ff',
  },
  productName: { marginTop: 8 },
  seeMoreBtn: {
    marginTop: 14,
    alignSelf: 'center',
    width: '90%',
    paddingVertical: 14,
    borderRadius: 30,
    backgroundColor: '#6f42c1',
    alignItems: 'center',
  },
  seeMoreText: { color: 'white', fontWeight: '700', fontSize: 16 },
});

export const subscriptionsDetailsStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff9fb' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 6,
  },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '800' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    alignSelf: 'center',
    marginBottom: 12,
  },

  segmentRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: '#efebf8',
    borderRadius: 12,
    overflow: 'hidden',
  },
  segmentBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  segmentBtnActive: {
    backgroundColor: '#8b5cf6',
  },
  segmentText: { fontWeight: '700' },
  segmentTextActive: { color: '#fff' },

  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#efe6ff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(139,92,246,0.35)',
  },
  planTitle: { fontSize: 18, fontWeight: '800' },
  planSub: { fontSize: 12, color: '#4b2a6a', marginTop: 6 },
  planPrice: { fontSize: 15, fontWeight: '700', marginLeft: 12 },

  table: { marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#f6edff',
    borderBottomWidth: 1,
    borderColor: '#f0e7ff',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tableHeader: { backgroundColor: '#f1e7ff' },
  cell: { paddingHorizontal: 8, justifyContent: 'center' },
  cell2: { paddingHorizontal: 8, justifyContent: 'center', width: '30%' },

  continueBtn: {
    paddingVertical: 15,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#5b21b6',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  continueText: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
