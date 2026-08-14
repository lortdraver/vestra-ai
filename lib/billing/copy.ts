import type { Locale } from '@/lib/i18n/config'

export const billingCopy = {
  az: {
    title: 'Vestra Pro',
    subtitle:
      'Qarderobunuzu, AI stilisti və hava uyğun planlamanı daha geniş limitlərlə istifadə edin.',
    free: 'Free',
    proMonthly: 'Pro aylıq',
    proAnnual: 'Pro illik',
    monthlyPrice: '$4.99/ay',
    annualPrice: '$39.99/il',
    annualSavings: 'Aylıq plana nisbətən təxminən 33% qənaət',
    upgrade: 'Pro-ya keç',
    manage: 'Abunəliyi idarə et',
    signIn: 'Daxil olun və checkout-a davam edin',
    currentPlan: 'Cari plan',
    processing: 'Checkout hazırlanır...',
    configuredLater:
      'Paddle sandbox dəyişənləri tamamlandıqdan sonra checkout açılacaq.',
    checkoutFailed: 'Checkout başlatmaq olmadı.',
    portalFailed: 'Billing portalını açmaq olmadı.',
    ends: 'Bitmə tarixi {date}',
    nextBilling: 'Növbəti ödəniş {date}',
    processingWebhook:
      'Ödənişdən sonra Pro statusu təsdiqlənmiş webhook gələndə aktiv olacaq.',
    features: {
      free: ['30 geyim', 'Həftədə 5 stilist sorğusu', '10 saxlanılan kombin'],
      pro: [
        '300 geyim',
        'Yüksək fair-use AI limitləri',
        '2-3 stilist namizədi',
        'Tam hava uyğun planlama',
      ],
    },
  },
  en: {
    title: 'Vestra Pro',
    subtitle:
      'Use your wardrobe, AI stylist, and weather-aware planner with higher production limits.',
    free: 'Free',
    proMonthly: 'Pro Monthly',
    proAnnual: 'Pro Annual',
    monthlyPrice: '$4.99/month',
    annualPrice: '$39.99/year',
    annualSavings: 'Save about 33% compared with monthly',
    upgrade: 'Upgrade to Pro',
    manage: 'Manage subscription',
    signIn: 'Sign in to continue to checkout',
    currentPlan: 'Current plan',
    processing: 'Preparing checkout...',
    configuredLater:
      'Checkout will open after Paddle sandbox variables are configured.',
    checkoutFailed: 'Unable to start checkout.',
    portalFailed: 'Unable to open the billing portal.',
    ends: 'Ends {date}',
    nextBilling: 'Next billing {date}',
    processingWebhook:
      'After payment, Pro activates only after Vestra receives the verified webhook.',
    features: {
      free: [
        '30 wardrobe items',
        '5 stylist requests per week',
        '10 saved outfits',
      ],
      pro: [
        '300 wardrobe items',
        'High fair-use AI limits',
        '2-3 stylist candidates',
        'Full weather-aware planning',
      ],
    },
  },
  ru: {
    title: 'Vestra Pro',
    subtitle:
      'Используйте гардероб, AI-стилиста и погодный планировщик с расширенными лимитами.',
    free: 'Free',
    proMonthly: 'Pro на месяц',
    proAnnual: 'Pro на год',
    monthlyPrice: '$4.99/месяц',
    annualPrice: '$39.99/год',
    annualSavings: 'Экономия около 33% по сравнению с помесячной оплатой',
    upgrade: 'Перейти на Pro',
    manage: 'Управлять подпиской',
    signIn: 'Войдите, чтобы перейти к оплате',
    currentPlan: 'Текущий план',
    processing: 'Готовим checkout...',
    configuredLater:
      'Checkout откроется после настройки Paddle sandbox переменных.',
    checkoutFailed: 'Не удалось запустить checkout.',
    portalFailed: 'Не удалось открыть billing portal.',
    ends: 'Закончится {date}',
    nextBilling: 'Следующее списание {date}',
    processingWebhook:
      'После оплаты Pro активируется только после проверенного webhook в Vestra.',
    features: {
      free: [
        '30 вещей',
        '5 запросов стилисту в неделю',
        '10 сохранённых образов',
      ],
      pro: [
        '300 вещей',
        'Высокие fair-use лимиты AI',
        '2-3 варианта от стилиста',
        'Полное погодное планирование',
      ],
    },
  },
} satisfies Record<Locale, Record<string, unknown>>

export function getBillingCopy(locale: Locale) {
  return billingCopy[locale]
}
