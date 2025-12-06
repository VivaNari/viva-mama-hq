import { StyleSheet } from 'react-native';

export const ContentDetailsStyles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 30,
  },
  image: {
    width: '100%',
    height: 220,
    resizeMode: 'cover',
  },
  textBlock: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    marginBottom: 6,
    color: '#000',
  },
  author: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
    borderBottomWidth: 1,
    borderBlockColor: '#bdbdbd',
    paddingBottom: 5,
    marginBottom: 15,
  },
  iconButton: {
    paddingVertical: 2,
  },
  content: {
    fontSize: 14.5,
    lineHeight: 22,
    color: '#333',
  },
});

export const styles = StyleSheet.create({
  headerImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  headerTitle: {
    fontSize: 16,
    paddingVertical: 12,
  },
  subCategoryBlock: {
    marginBottom: 12,
  },
});

export const SubCategoryStyles = StyleSheet.create({
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    paddingBottom: 12,
  },
  subCategoryBlock: {
    marginBottom: 12,
  },
});
