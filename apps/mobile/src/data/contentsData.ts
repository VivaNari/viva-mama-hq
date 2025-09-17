import { ICategory } from '../types/content.types';

export const contentsData: ICategory[] = [
  {
    id: 1,
    categoryName: 'Mother Growth',
    categoryThumbnailImage: require('../public/assets/images/mother_growth_thumbnail.png'),
    categoryIcon: require('../public/assets/images/mother_growth_icon.png'),
    subCategories: [
      {
        id: 101,
        subCategoryName: 'Pregnancy',
        contents: [
          {
            id: 1001,
            title: '5 simple breastfeeding positions for mothers',
            author: 'Mittali Khurana',
            thumbnailImage: require('../public/assets/images/single_article_breadcrumb.png'),
            isLiked: true,
            likes: 120,
            comments: 45,
            content:
              'Holding your baby in a proper breastfeeding position is important for both comfort and successful feeding. The cradle hold is one of the most common positions where the baby rests horizontally in your arms. The cross-cradle hold provides more head support and is especially helpful for newborns. The football hold positions the baby under your arm, making it easier for mothers recovering from a C-section. Side-lying is useful during nighttime feeding or when the mother needs rest. Lastly, the laid-back position allows the baby to self-latch while the mother reclines. Each position has its own benefits and mothers are encouraged to try different ones to find what works best for them and their babies.',
          },
          {
            id: 1002,
            title: 'Diet for a healthy pregnancy',
            author: 'Dr. Radhika Menon',
            thumbnailImage: require('../public/assets/images/single_article_breadcrumb.png'),
            isLiked: false,
            likes: 85,
            comments: 32,
            content:
              'A balanced pregnancy diet is crucial for the health of both mother and baby. Expectant mothers should focus on whole grains, lean proteins such as poultry, fish, and legumes, and a variety of fruits and vegetables that provide essential vitamins and minerals. Iron-rich foods like spinach, beans, and fortified cereals help prevent anemia, while calcium from milk, yogurt, and cheese supports the baby’s bone development. Folate, found in leafy greens and citrus fruits, is important to prevent birth defects. Staying hydrated with sufficient water intake and avoiding excess caffeine, alcohol, and highly processed foods is equally important. Small, frequent meals can also reduce nausea and keep energy levels stable throughout the day.',
          },
        ],
      },
      {
        id: 102,
        subCategoryName: 'Postpartum',
        contents: [
          {
            id: 1003,
            title: 'Postpartum recovery tips',
            author: 'Dr. Priya Sharma',
            thumbnailImage: require('../public/assets/images/single_article_breadcrumb.png'),
            isLiked: false,
            likes: 60,
            comments: 22,
            content:
              'Recovering after childbirth is a gradual process that requires patience, rest, and proper care. Mothers are encouraged to get adequate sleep, though it may be interrupted by the newborn’s schedule. Eating nutrient-dense foods and staying hydrated support faster healing and restore energy. Gentle exercises like walking can improve circulation and reduce stress. For mothers who experienced C-sections, avoiding heavy lifting is important until cleared by a doctor. Emotional recovery is equally critical; seeking help from family or support groups can ease feelings of being overwhelmed. Regular postpartum check-ups with healthcare providers ensure that the mother’s physical and emotional recovery is progressing well.',
          },
          {
            id: 1004,
            title: 'Postpartum mental health',
            author: 'Anjali Gupta',
            thumbnailImage: require('../public/assets/images/single_article_breadcrumb.png'),
            isLiked: true,
            likes: 140,
            comments: 51,
            content:
              'Many new mothers experience emotional ups and downs after childbirth. While “baby blues” are common and usually resolve within two weeks, some mothers may face postpartum depression, which is more serious and long-lasting. Symptoms can include persistent sadness, lack of energy, trouble bonding with the baby, feelings of worthlessness, or even thoughts of self-harm. It is important to understand that postpartum depression is not a weakness but a medical condition that requires support and treatment. Early intervention with counseling, therapy, or medication can make a significant difference. Families and partners should be attentive to signs of emotional distress and encourage mothers to seek professional help without delay.',
          },
        ],
      },
      {
        id: 103,
        subCategoryName: 'Breastfeeding',
        contents: [
          {
            id: 1005,
            title: 'Common breastfeeding challenges',
            author: 'Nisha Patel',
            thumbnailImage: require('../public/assets/images/single_article_breadcrumb.png'),
            isLiked: false,
            likes: 98,
            comments: 28,
            content:
              'Breastfeeding is natural but not always easy, and many mothers face challenges. Latching difficulties can cause discomfort and make feeding less effective. Low milk supply is another common concern, which can sometimes be improved with frequent feeding and proper hydration. Sore or cracked nipples may occur due to improper positioning, but adjusting the baby’s latch and using soothing creams can help. Some mothers also experience engorgement, where the breasts become overly full, leading to pain and difficulty for the baby to latch. Mastitis, an infection of the breast tissue, can cause fever and pain, requiring medical attention. With proper guidance from lactation consultants and healthcare providers, most of these issues can be managed successfully.',
          },
        ],
      },
    ],
  },
  {
    id: 2,
    categoryName: 'Child Growth',
    categoryThumbnailImage: require('../public/assets/images/child_growth_thumbnail.png'),
    categoryIcon: require('../public/assets/images/child_growth_icon.png.png'),
    subCategories: [
      {
        id: 201,
        subCategoryName: 'Newborn',
        contents: [
          {
            id: 2001,
            title: 'Caring for your newborn',
            author: 'Dr. Ramesh Iyer',
            thumbnailImage: require('../public/assets/images/single_article_breadcrumb.png'),
            isLiked: true,
            likes: 180,
            comments: 64,
            content:
              'Caring for a newborn can feel overwhelming, especially for first-time parents. Newborns require feeding every two to three hours, whether through breastfeeding or formula. Sleep is irregular in the first weeks, with babies sleeping for short periods throughout the day and night. Parents should focus on safe sleep practices, such as placing the baby on their back in a crib without pillows or loose bedding. Bathing should be gentle and only two to three times a week to avoid skin dryness. Skin-to-skin contact helps with bonding and regulating the baby’s temperature. Monitoring the baby’s health and growth with regular pediatric check-ups is essential for detecting any issues early.',
          },
        ],
      },
      {
        id: 202,
        subCategoryName: 'Nutrition',
        contents: [
          {
            id: 2002,
            title: 'Introducing solid foods',
            author: 'Dr. Kavita Rao',
            thumbnailImage: require('../public/assets/images/single_article_breadcrumb.png'),
            isLiked: false,
            likes: 95,
            comments: 30,
            content:
              'Introducing solid foods is an exciting milestone, usually recommended around six months of age. Signs of readiness include the ability to sit with support, showing interest in food, and losing the tongue-thrust reflex. The first foods should be soft, pureed, or mashed, such as iron-fortified cereals, pureed vegetables, fruits, and lentils. New foods should be introduced one at a time to monitor for allergies. Parents should avoid honey, cow’s milk, whole nuts, and foods high in sugar or salt in the first year. Gradually, textures can be advanced from purees to small, soft finger foods, helping the baby develop chewing skills and independence in eating.',
          },
        ],
      },
      {
        id: 203,
        subCategoryName: 'Milestones',
        contents: [
          {
            id: 2003,
            title: 'Baby’s first-year milestones',
            author: 'Dr. Sanjay Verma',
            thumbnailImage: require('../public/assets/images/single_article_breadcrumb.png'),
            isLiked: true,
            likes: 220,
            comments: 75,
            content:
              'The first year of a baby’s life is full of developmental milestones. By three months, most babies can lift their heads and smile socially. At six months, many can roll over, sit with support, and begin babbling. Around nine months, babies often crawl, recognize familiar faces, and use simple gestures like waving. By the first birthday, many can stand with assistance, take a few steps, and say their first words. These milestones vary for each child, and some may achieve them earlier or later than average. Parents should encourage development by providing a safe environment, engaging in play, and talking frequently to their baby.',
          },
        ],
      },
    ],
  },
  {
    id: 3,
    categoryName: 'Partner Growth',
    categoryThumbnailImage: require('../public/assets/images/partner_growth_thumbnail.png'),
    categoryIcon: require('../public/assets/images/partner_growth_icon.png'),
    subCategories: [
      {
        id: 301,
        subCategoryName: 'Emotional Support',
        contents: [
          {
            id: 3001,
            title: 'Supporting your partner during pregnancy',
            author: 'Rahul Singh',
            thumbnailImage: require('../public/assets/images/single_article_breadcrumb.png'),
            isLiked: true,
            likes: 105,
            comments: 40,
            content:
              'Pregnancy is not only a physical but also an emotional journey, and partners play a key role in providing support. Being present at doctor’s visits, helping with daily chores, and listening to concerns can reduce the mother’s stress. Encouraging open communication ensures that the mother feels valued and understood. Small gestures such as massages, preparing healthy meals, or simply offering companionship during walks can make a big difference. Emotional support also extends to respecting the mother’s changing needs and moods. A supportive partner helps strengthen the relationship and creates a nurturing environment for both the mother and the baby.',
          },
        ],
      },
      {
        id: 302,
        subCategoryName: 'Involvement',
        contents: [
          {
            id: 3002,
            title: 'Partner’s role in baby care',
            author: 'Dr. Sneha Kapoor',
            thumbnailImage: require('../public/assets/images/single_article_breadcrumb.png'),
            isLiked: false,
            likes: 70,
            comments: 21,
            content:
              'Partners can play an active role in baby care, which not only helps the mother but also strengthens the parent-child bond. Fathers or partners can participate in feeding, whether through bottle-feeding expressed milk or preparing formula. Diaper changes, bath time, and bedtime routines are other areas where they can contribute. Reading to the baby, singing lullabies, or simply holding and soothing the infant creates strong emotional connections. Active involvement also helps mothers get time to rest and recover. Studies show that babies with engaged fathers or partners have better emotional and cognitive development.',
          },
        ],
      },
      {
        id: 303,
        subCategoryName: 'Health & Lifestyle',
        contents: [
          {
            id: 3003,
            title: 'Managing stress as a new parent',
            author: 'Arjun Mehta',
            thumbnailImage: require('../public/assets/images/single_article_breadcrumb.png'),
            isLiked: false,
            likes: 65,
            comments: 18,
            content:
              'Becoming a new parent brings immense joy but also significant stress. The responsibilities of caring for a newborn, sleepless nights, and adjusting to new routines can feel overwhelming. Managing stress requires proactive steps such as ensuring adequate rest whenever possible, eating balanced meals, and engaging in physical activity like short walks or yoga. Open communication with a partner about shared responsibilities can reduce the feeling of being burdened. It is also important for parents to make time for themselves, whether through hobbies, meditation, or meeting friends. If stress becomes unmanageable or leads to persistent anxiety or depression, seeking professional guidance can make a big difference.',
          },
        ],
      },
    ],
  },
];
