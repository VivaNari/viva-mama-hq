import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    fontSize: 30,
    color: '#1F2937',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: '#E0E7FF',
  },
  activeTab: {
    backgroundColor: '#4338CA',
  },
  tabText: {
    color: '#4338CA',
    fontWeight: '600',
    fontSize: 14,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  contentContainer: {
    marginVertical: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
  },
  cardQuestion: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 24,
  },
  vaccineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  vaccineInfo: {
    flex: 1,
    marginRight: 16,
  },
  vaccineName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  vaccineDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
});
