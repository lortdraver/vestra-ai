import type { Locale } from '@/lib/i18n/config'
import type { AdminRangePreset } from './admin'

export type AdminAnalyticsCopy = {
  title: string
  subtitle: string
  rangeLabel: string
  rangeOptions: Record<AdminRangePreset, string>
  sections: {
    users: string
    activity: string
    activation: string
    product: string
    subscriptions: string
    charts: string
    funnel: string
    retention: string
    insights: string
    health: string
    userTable: string
    externalTools: string
    securityLogs: string
    auditLogs: string
  }
  labels: {
    totalUsers: string
    verifiedUsers: string
    newUsersToday: string
    newUsers7d: string
    newUsers30d: string
    dau: string
    wau: string
    mau: string
    dauMau: string
    activatedUsers: string
    activationRate: string
    totalActiveWardrobeItems: string
    averageWardrobeSize: string
    wardrobeItems7d: string
    wardrobeItems30d: string
    stylistGenerations: string
    stylistFailureRate: string
    aiFailureRate: string
    outfitsCreated: string
    plannerSchedules: string
    wearLogs: string
    freeUsers: string
    premiumUsers: string
    trialUsers: string
    registered: string
    emailVerified: string
    firstWardrobe: string
    firstStylist: string
    firstSaved: string
    activeDefinition: string
    retentionExplanation: string
    topCategories: string
    topSubtypes: string
    topColors: string
    topStyles: string
    topSeasons: string
    stylistSuccessRate: string
    aiSuccessRate: string
    backgroundSuccessRate: string
    registrationDate: string
    verifiedState: string
    plan: string
    wardrobeCount: string
    lastActivity: string
    stylistCount: string
    googleAnalytics: string
    clarity: string
  }
  states: {
    verified: string
    unverified: string
    noData: string
    noActivity: string
    notEnoughData: string
    approximation: string
    operational: string
    openGoogleAnalytics: string
    openClarity: string
    noLogs: string
  }
  plans: {
    free: string
    premium: string
    trial: string
  }
  charts: {
    newUsers: string
    activeUsers: string
    stylistGenerations: string
    wardrobeItems: string
  }
}

const copy: Record<Locale, AdminAnalyticsCopy> = {
  az: {
    title: 'Admin analitikasi',
    subtitle:
      'Vestra-n\u0131n daxili m\u0259hsul g\u00f6st\u0259ricil\u0259ri, aktivasiya hunisi, saxlanma v\u0259 sistem keyfiyy\u0259ti.',
    rangeLabel: 'D\u00f6vr',
    rangeOptions: {
      today: 'Bu g\u00fcn',
      '7d': '7 g\u00fcn',
      '30d': '30 g\u00fcn',
      '90d': '90 g\u00fcn',
    },
    sections: {
      users: '\u0130stifad\u0259\u00e7il\u0259r',
      activity: 'Aktivlik',
      activation: 'Aktivasiya',
      product: 'M\u0259hsul',
      subscriptions: 'Abun\u0259likl\u0259r',
      charts: 'Qrafikl\u0259r',
      funnel: 'Aktivasiya hunisi',
      retention: 'Saxlanma',
      insights: 'Moda insight-lar\u0131',
      health: 'Sistem sa\u011flaml\u0131\u011f\u0131',
      userTable: '\u0130stifad\u0259\u00e7i c\u0259dv\u0259li',
      externalTools: 'Xarici al\u0259tl\u0259r',
      securityLogs: 'T\u0259hl\u00fck\u0259sizlik hadis\u0259l\u0259ri',
      auditLogs: 'Audit hadis\u0259l\u0259ri',
    },
    labels: {
      totalUsers: '\u00dcmumi istifad\u0259\u00e7i',
      verifiedUsers: 'T\u0259sdiql\u0259nmi\u015f istifad\u0259\u00e7i',
      newUsersToday: 'Bu g\u00fcn yeni',
      newUsers7d: 'Son 7 g\u00fcn yeni',
      newUsers30d: 'Son 30 g\u00fcn yeni',
      dau: 'DAU',
      wau: 'WAU',
      mau: 'MAU',
      dauMau: 'DAU / MAU',
      activatedUsers: 'Aktivasiya olunmu\u015f istifad\u0259\u00e7i',
      activationRate: 'Aktivasiya faizi',
      totalActiveWardrobeItems: 'Aktiv qarderob geyimi',
      averageWardrobeSize: 'Orta qarderob h\u0259cmi',
      wardrobeItems7d: '7 g\u00fcnd\u0259 yarad\u0131lan geyim',
      wardrobeItems30d: '30 g\u00fcnd\u0259 yarad\u0131lan geyim',
      stylistGenerations: 'Stilist generasiyalar\u0131',
      stylistFailureRate: 'Stilist x\u0259ta faizi',
      aiFailureRate: 'AI analiz x\u0259ta faizi',
      outfitsCreated: 'Yarad\u0131lan kombinl\u0259r',
      plannerSchedules: 'Planlay\u0131c\u0131 qeydl\u0259ri',
      wearLogs: 'Geyinm\u0259 qeydl\u0259ri',
      freeUsers: 'Free istifad\u0259\u00e7il\u0259r',
      premiumUsers: 'Premium istifad\u0259\u00e7il\u0259r',
      trialUsers: 'S\u0131naq istifad\u0259\u00e7il\u0259ri',
      registered: 'Qeydiyyat',
      emailVerified: 'E-po\u00e7t t\u0259sdiqi',
      firstWardrobe: '\u0130lk qarderob geyimi',
      firstStylist: '\u0130lk stilist n\u0259tic\u0259si',
      firstSaved: '\u0130lk saxlan\u0131lan kombin',
      activeDefinition: 'Aktiv istifad\u0259\u00e7i t\u0259rifi',
      retentionExplanation:
        'Aktiv istifad\u0259\u00e7i m\u0259nali m\u0259hsul hadis\u0259si yarad\u0131b: qarderob, analiz, stilist, planner, kombin v\u0259 ya geyinm\u0259.',
      topCategories: '\u018fn \u00e7ox kateqoriyalar',
      topSubtypes: '\u018fn \u00e7ox alt tipl\u0259r',
      topColors: '\u018fn \u00e7ox r\u0259ng ail\u0259l\u0259ri',
      topStyles: '\u018fn \u00e7ox stil teql\u0259ri',
      topSeasons: '\u018fn \u00e7ox m\u00f6vs\u00fcm teql\u0259ri',
      stylistSuccessRate: 'Stilist u\u011fur faizi',
      aiSuccessRate: 'AI analiz u\u011fur faizi',
      backgroundSuccessRate: 'Fon silm\u0259 u\u011fur faizi',
      registrationDate: 'Qeydiyyat tarixi',
      verifiedState: 'T\u0259sdiq',
      plan: 'Plan',
      wardrobeCount: 'Qarderob say\u0131',
      lastActivity: 'Son m\u0259nal\u0131 aktivlik',
      stylistCount: 'Stilist say\u0131',
      googleAnalytics: 'Google Analytics',
      clarity: 'Microsoft Clarity',
    },
    states: {
      verified: 'T\u0259sdiql\u0259nib',
      unverified: 'T\u0259sdiql\u0259nm\u0259yib',
      noData: 'H\u0259l\u0259 m\u0259lumat yoxdur.',
      noActivity: 'Aktivlik yoxdur',
      notEnoughData: 'Kifay\u0259t q\u0259d\u0259r m\u0259lumat yoxdur',
      approximation: 'T\u0259xmini: hadis\u0259 + operativ m\u0259lumat',
      operational: 'M\u0259hsul analitikasi, trafik deyil',
      openGoogleAnalytics: 'GA4-a ke\u00e7',
      openClarity: 'Clarity-y\u0259 ke\u00e7',
      noLogs: 'H\u0259l\u0259 qeyd yoxdur.',
    },
    plans: {
      free: 'Free',
      premium: 'Premium',
      trial: 'S\u0131naq',
    },
    charts: {
      newUsers: 'Yeni istifad\u0259\u00e7il\u0259r',
      activeUsers: 'Aktiv istifad\u0259\u00e7il\u0259r',
      stylistGenerations: 'Stilist generasiyalar\u0131',
      wardrobeItems: 'Yarad\u0131lan qarderob geyiml\u0259ri',
    },
  },
  en: {
    title: 'Admin analytics',
    subtitle:
      'Internal Vestra product metrics, activation funnel, retention, and system quality.',
    rangeLabel: 'Range',
    rangeOptions: {
      today: 'Today',
      '7d': '7 days',
      '30d': '30 days',
      '90d': '90 days',
    },
    sections: {
      users: 'Users',
      activity: 'Activity',
      activation: 'Activation',
      product: 'Product',
      subscriptions: 'Subscriptions',
      charts: 'Charts',
      funnel: 'Activation funnel',
      retention: 'Retention',
      insights: 'Fashion insights',
      health: 'System health',
      userTable: 'User table',
      externalTools: 'External tools',
      securityLogs: 'Security events',
      auditLogs: 'Audit events',
    },
    labels: {
      totalUsers: 'Total users',
      verifiedUsers: 'Verified users',
      newUsersToday: 'New users today',
      newUsers7d: 'New users last 7 days',
      newUsers30d: 'New users last 30 days',
      dau: 'DAU',
      wau: 'WAU',
      mau: 'MAU',
      dauMau: 'DAU / MAU',
      activatedUsers: 'Activated users',
      activationRate: 'Activation rate',
      totalActiveWardrobeItems: 'Active wardrobe items',
      averageWardrobeSize: 'Average wardrobe size',
      wardrobeItems7d: 'Wardrobe items created in 7 days',
      wardrobeItems30d: 'Wardrobe items created in 30 days',
      stylistGenerations: 'Stylist generations',
      stylistFailureRate: 'Stylist failure rate',
      aiFailureRate: 'AI analysis failure rate',
      outfitsCreated: 'Outfits created',
      plannerSchedules: 'Planner schedules',
      wearLogs: 'Wear logs',
      freeUsers: 'Free users',
      premiumUsers: 'Premium users',
      trialUsers: 'Trial users',
      registered: 'Registered',
      emailVerified: 'Email verified',
      firstWardrobe: 'First wardrobe item',
      firstStylist: 'First stylist generation',
      firstSaved: 'First saved outfit',
      activeDefinition: 'What counts as active',
      retentionExplanation:
        'An active user triggers a meaningful product event: wardrobe, analysis, stylist, planner, outfit, or wear activity.',
      topCategories: 'Top categories',
      topSubtypes: 'Top subtypes',
      topColors: 'Top color families',
      topStyles: 'Top style tags',
      topSeasons: 'Top seasons',
      stylistSuccessRate: 'Stylist success rate',
      aiSuccessRate: 'AI analysis success rate',
      backgroundSuccessRate: 'Background removal success rate',
      registrationDate: 'Registration date',
      verifiedState: 'Verified',
      plan: 'Plan',
      wardrobeCount: 'Wardrobe items',
      lastActivity: 'Last meaningful activity',
      stylistCount: 'Stylist generations',
      googleAnalytics: 'Google Analytics',
      clarity: 'Microsoft Clarity',
    },
    states: {
      verified: 'Verified',
      unverified: 'Unverified',
      noData: 'No data yet.',
      noActivity: 'No activity',
      notEnoughData: 'Not enough data',
      approximation: 'Approximation: event + operational state',
      operational: 'Product analytics, not traffic acquisition',
      openGoogleAnalytics: 'Open GA4',
      openClarity: 'Open Clarity',
      noLogs: 'No records yet.',
    },
    plans: {
      free: 'Free',
      premium: 'Premium',
      trial: 'Trial',
    },
    charts: {
      newUsers: 'New users',
      activeUsers: 'Active users',
      stylistGenerations: 'Stylist generations',
      wardrobeItems: 'Wardrobe items created',
    },
  },
  ru: {
    title:
      '\u0410\u0434\u043c\u0438\u043d-\u0430\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0430',
    subtitle:
      '\u0412\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0435 \u043c\u0435\u0442\u0440\u0438\u043a\u0438 \u043f\u0440\u043e\u0434\u0443\u043a\u0442\u0430 Vestra, \u0432\u043e\u0440\u043e\u043d\u043a\u0430 \u0430\u043a\u0442\u0438\u0432\u0430\u0446\u0438\u0438, \u0443\u0434\u0435\u0440\u0436\u0430\u043d\u0438\u0435 \u0438 \u043a\u0430\u0447\u0435\u0441\u0442\u0432\u043e \u0441\u0438\u0441\u0442\u0435\u043c\u044b.',
    rangeLabel: '\u041f\u0435\u0440\u0438\u043e\u0434',
    rangeOptions: {
      today: '\u0421\u0435\u0433\u043e\u0434\u043d\u044f',
      '7d': '7 \u0434\u043d\u0435\u0439',
      '30d': '30 \u0434\u043d\u0435\u0439',
      '90d': '90 \u0434\u043d\u0435\u0439',
    },
    sections: {
      users:
        '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438',
      activity: '\u0410\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u044c',
      activation: '\u0410\u043a\u0442\u0438\u0432\u0430\u0446\u0438\u044f',
      product: '\u041f\u0440\u043e\u0434\u0443\u043a\u0442',
      subscriptions: '\u041f\u043e\u0434\u043f\u0438\u0441\u043a\u0438',
      charts: '\u0413\u0440\u0430\u0444\u0438\u043a\u0438',
      funnel:
        '\u0412\u043e\u0440\u043e\u043d\u043a\u0430 \u0430\u043a\u0442\u0438\u0432\u0430\u0446\u0438\u0438',
      retention: '\u0423\u0434\u0435\u0440\u0436\u0430\u043d\u0438\u0435',
      insights:
        '\u041c\u043e\u0434\u043d\u044b\u0435 \u0438\u043d\u0441\u0430\u0439\u0442\u044b',
      health:
        '\u0421\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435 \u0441\u0438\u0441\u0442\u0435\u043c\u044b',
      userTable:
        '\u0422\u0430\u0431\u043b\u0438\u0446\u0430 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439',
      externalTools:
        '\u0412\u043d\u0435\u0448\u043d\u0438\u0435 \u0438\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442\u044b',
      securityLogs:
        '\u0421\u043e\u0431\u044b\u0442\u0438\u044f \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u0438',
      auditLogs: 'Audit \u0441\u043e\u0431\u044b\u0442\u0438\u044f',
    },
    labels: {
      totalUsers:
        '\u0412\u0441\u0435\u0433\u043e \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0435\u0439',
      verifiedUsers:
        '\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u043d\u044b\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438',
      newUsersToday:
        '\u041d\u043e\u0432\u044b\u0435 \u0441\u0435\u0433\u043e\u0434\u043d\u044f',
      newUsers7d:
        '\u041d\u043e\u0432\u044b\u0435 \u0437\u0430 7 \u0434\u043d\u0435\u0439',
      newUsers30d:
        '\u041d\u043e\u0432\u044b\u0435 \u0437\u0430 30 \u0434\u043d\u0435\u0439',
      dau: 'DAU',
      wau: 'WAU',
      mau: 'MAU',
      dauMau: 'DAU / MAU',
      activatedUsers:
        '\u0410\u043a\u0442\u0438\u0432\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438',
      activationRate:
        '\u0414\u043e\u043b\u044f \u0430\u043a\u0442\u0438\u0432\u0430\u0446\u0438\u0438',
      totalActiveWardrobeItems:
        '\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0435 \u0432\u0435\u0449\u0438 \u0433\u0430\u0440\u0434\u0435\u0440\u043e\u0431\u0430',
      averageWardrobeSize:
        '\u0421\u0440\u0435\u0434\u043d\u0438\u0439 \u0440\u0430\u0437\u043c\u0435\u0440 \u0433\u0430\u0440\u0434\u0435\u0440\u043e\u0431\u0430',
      wardrobeItems7d:
        '\u0412\u0435\u0449\u0438, \u0441\u043e\u0437\u0434\u0430\u043d\u043d\u044b\u0435 \u0437\u0430 7 \u0434\u043d\u0435\u0439',
      wardrobeItems30d:
        '\u0412\u0435\u0449\u0438, \u0441\u043e\u0437\u0434\u0430\u043d\u043d\u044b\u0435 \u0437\u0430 30 \u0434\u043d\u0435\u0439',
      stylistGenerations:
        '\u0413\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u0438 \u0441\u0442\u0438\u043b\u0438\u0441\u0442\u0430',
      stylistFailureRate:
        '\u0414\u043e\u043b\u044f \u043e\u0448\u0438\u0431\u043e\u043a \u0441\u0442\u0438\u043b\u0438\u0441\u0442\u0430',
      aiFailureRate:
        '\u0414\u043e\u043b\u044f \u043e\u0448\u0438\u0431\u043e\u043a AI-\u0430\u043d\u0430\u043b\u0438\u0437\u0430',
      outfitsCreated:
        '\u0421\u043e\u0437\u0434\u0430\u043d\u043d\u044b\u0435 \u043e\u0431\u0440\u0430\u0437\u044b',
      plannerSchedules:
        '\u0417\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0435 \u043e\u0431\u0440\u0430\u0437\u044b',
      wearLogs:
        '\u0417\u0430\u043f\u0438\u0441\u0438 \u043e \u043d\u043e\u0441\u043a\u0435',
      freeUsers:
        'Free \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438',
      premiumUsers:
        'Premium \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438',
      trialUsers:
        '\u041f\u0440\u043e\u0431\u043d\u044b\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438',
      registered:
        '\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044f',
      emailVerified:
        '\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435 email',
      firstWardrobe:
        '\u041f\u0435\u0440\u0432\u0430\u044f \u0432\u0435\u0449\u044c \u0433\u0430\u0440\u0434\u0435\u0440\u043e\u0431\u0430',
      firstStylist:
        '\u041f\u0435\u0440\u0432\u0430\u044f \u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u044f \u0441\u0442\u0438\u043b\u0438\u0441\u0442\u0430',
      firstSaved:
        '\u041f\u0435\u0440\u0432\u044b\u0439 \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0439 \u043e\u0431\u0440\u0430\u0437',
      activeDefinition:
        '\u0427\u0442\u043e \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044f \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u044c\u044e',
      retentionExplanation:
        '\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0439 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u0441\u043e\u0432\u0435\u0440\u0448\u0430\u0435\u0442 \u0437\u043d\u0430\u0447\u0438\u043c\u043e\u0435 \u043f\u0440\u043e\u0434\u0443\u043a\u0442\u043e\u0432\u043e\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435: \u0433\u0430\u0440\u0434\u0435\u0440\u043e\u0431, \u0430\u043d\u0430\u043b\u0438\u0437, \u0441\u0442\u0438\u043b\u0438\u0441\u0442, planner, \u043e\u0431\u0440\u0430\u0437 \u0438\u043b\u0438 \u043d\u043e\u0441\u043a\u0430.',
      topCategories:
        '\u0422\u043e\u043f \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438',
      topSubtypes:
        '\u0422\u043e\u043f \u043f\u043e\u0434\u0442\u0438\u043f\u044b',
      topColors:
        '\u0422\u043e\u043f \u0446\u0432\u0435\u0442\u043e\u0432\u044b\u0435 \u0441\u0435\u043c\u0435\u0439\u0441\u0442\u0432\u0430',
      topStyles:
        '\u0422\u043e\u043f \u0441\u0442\u0438\u043b\u0435\u0432\u044b\u0435 \u0442\u0435\u0433\u0438',
      topSeasons: '\u0422\u043e\u043f \u0441\u0435\u0437\u043e\u043d\u044b',
      stylistSuccessRate:
        '\u0423\u0441\u043f\u0435\u0448\u043d\u043e\u0441\u0442\u044c \u0441\u0442\u0438\u043b\u0438\u0441\u0442\u0430',
      aiSuccessRate:
        '\u0423\u0441\u043f\u0435\u0448\u043d\u043e\u0441\u0442\u044c AI-\u0430\u043d\u0430\u043b\u0438\u0437\u0430',
      backgroundSuccessRate:
        '\u0423\u0441\u043f\u0435\u0448\u043d\u043e\u0441\u0442\u044c \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u044f \u0444\u043e\u043d\u0430',
      registrationDate:
        '\u0414\u0430\u0442\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438',
      verifiedState:
        '\u0412\u0435\u0440\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u044f',
      plan: '\u041f\u043b\u0430\u043d',
      wardrobeCount:
        '\u0412\u0435\u0449\u0435\u0439 \u0432 \u0433\u0430\u0440\u0434\u0435\u0440\u043e\u0431\u0435',
      lastActivity:
        '\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u044f\u044f \u0437\u043d\u0430\u0447\u0438\u043c\u0430\u044f \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u044c',
      stylistCount:
        '\u0413\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u0439 \u0441\u0442\u0438\u043b\u0438\u0441\u0442\u0430',
      googleAnalytics: 'Google Analytics',
      clarity: 'Microsoft Clarity',
    },
    states: {
      verified:
        '\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043d',
      unverified:
        '\u041d\u0435 \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043d',
      noData:
        '\u0414\u0430\u043d\u043d\u044b\u0445 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.',
      noActivity:
        '\u0410\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u0438 \u043d\u0435\u0442',
      notEnoughData:
        '\u041d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u0434\u0430\u043d\u043d\u044b\u0445',
      approximation:
        '\u041f\u0440\u0438\u0431\u043b\u0438\u0436\u0435\u043d\u0438\u0435: \u0441\u043e\u0431\u044b\u0442\u0438\u044f + \u043e\u043f\u0435\u0440\u0430\u0446\u0438\u043e\u043d\u043d\u043e\u0435 \u0441\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u0435',
      operational:
        '\u041f\u0440\u043e\u0434\u0443\u043a\u0442\u043e\u0432\u0430\u044f \u0430\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0430, \u0430 \u043d\u0435 \u0442\u0440\u0430\u0444\u0438\u043a',
      openGoogleAnalytics: '\u041e\u0442\u043a\u0440\u044b\u0442\u044c GA4',
      openClarity: '\u041e\u0442\u043a\u0440\u044b\u0442\u044c Clarity',
      noLogs:
        '\u0417\u0430\u043f\u0438\u0441\u0435\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.',
    },
    plans: {
      free: 'Free',
      premium: 'Premium',
      trial: '\u041f\u0440\u043e\u0431\u043d\u044b\u0439',
    },
    charts: {
      newUsers:
        '\u041d\u043e\u0432\u044b\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438',
      activeUsers:
        '\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438',
      stylistGenerations:
        '\u0413\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u0438 \u0441\u0442\u0438\u043b\u0438\u0441\u0442\u0430',
      wardrobeItems:
        '\u0421\u043e\u0437\u0434\u0430\u043d\u043d\u044b\u0435 \u0432\u0435\u0449\u0438 \u0433\u0430\u0440\u0434\u0435\u0440\u043e\u0431\u0430',
    },
  },
}

export function getAdminAnalyticsCopy(locale: Locale) {
  return copy[locale]
}
