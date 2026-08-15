import type { Locale } from '@/lib/i18n/config'

type FooterColumn = {
  title: string
  links: {
    label: string
    href: string
  }[]
}

export type PublicFooterCopy = {
  product: FooterColumn
  legal: FooterColumn
  cookiePreferences: string
  copyright: string
}

export type FaqItem = {
  question: string
  answer: string
  links?: {
    label: string
    href: string
  }[]
}

export type FaqSection = {
  title: string
  items: FaqItem[]
}

export type FaqPageCopy = {
  title: string
  description: string
  eyebrow: string
  intro: string
  sections: FaqSection[]
}

export type SupportPageCopy = {
  title: string
  description: string
  eyebrow: string
  intro: string
  contactTitle: string
  contactAvailable: string
  contactUnavailable: string
  sectionsTitle: string
  topics: string[]
  includeTitle: string
  includeItems: string[]
  neverSendTitle: string
  neverSendItems: string[]
}

export const publicFooterCopy: Record<Locale, PublicFooterCopy> = {
  az: {
    product: {
      title: 'Məhsul',
      links: [
        { label: 'Qiymətlər', href: '/pricing' },
        { label: 'FAQ', href: '/faq' },
        { label: 'Dəstək / Əlaqə', href: '/support' },
      ],
    },
    legal: {
      title: 'Hüquqi',
      links: [
        { label: 'Məxfilik siyasəti', href: '/privacy' },
        { label: 'İstifadə şərtləri', href: '/terms' },
        { label: 'Geri ödəniş və ləğv', href: '/refund' },
      ],
    },
    cookiePreferences: 'Kuki seçimləri',
    copyright: 'Bütün hüquqlar qorunur.',
  },
  en: {
    product: {
      title: 'Product',
      links: [
        { label: 'Pricing', href: '/pricing' },
        { label: 'FAQ', href: '/faq' },
        { label: 'Support / Contact', href: '/support' },
      ],
    },
    legal: {
      title: 'Legal',
      links: [
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Terms of Service', href: '/terms' },
        { label: 'Refund & Cancellation', href: '/refund' },
      ],
    },
    cookiePreferences: 'Cookie preferences',
    copyright: 'All rights reserved.',
  },
  ru: {
    product: {
      title: 'Продукт',
      links: [
        { label: 'Цены', href: '/pricing' },
        { label: 'FAQ', href: '/faq' },
        { label: 'Поддержка / Контакты', href: '/support' },
      ],
    },
    legal: {
      title: 'Правовая информация',
      links: [
        { label: 'Политика конфиденциальности', href: '/privacy' },
        { label: 'Условия использования', href: '/terms' },
        { label: 'Возврат и отмена', href: '/refund' },
      ],
    },
    cookiePreferences: 'Настройки cookies',
    copyright: 'Все права защищены.',
  },
}

type SiteFooterColumn = {
  title: string
  links: {
    key: string
    label: string
  }[]
}

export type SiteFooterCopy = {
  description: string
  product: SiteFooterColumn
  help: SiteFooterColumn
  legal: SiteFooterColumn
  cookiePreferences: string
  copyright: string
}

export const siteFooterCopy: Record<Locale, SiteFooterCopy> = {
  az: {
    description: 'AI ilə çalışan şəxsi qarderob və stil köməkçiniz.',
    product: {
      title: 'Məhsul',
      links: [
        { key: 'home', label: 'Ana səhifə' },
        { key: 'wardrobe', label: 'Qarderob' },
        { key: 'stylist', label: 'AI Stilist' },
        { key: 'planner', label: 'Planlayıcı' },
        { key: 'savedLooks', label: 'Saxlanılan kombinlər' },
        { key: 'pricing', label: 'Qiymətlər' },
      ],
    },
    help: {
      title: 'Kömək',
      links: [
        { key: 'faq', label: 'FAQ' },
        { key: 'support', label: 'Dəstək' },
        { key: 'feedback', label: 'Problem bildir / rəy göndər' },
      ],
    },
    legal: {
      title: 'Hüquqi',
      links: [
        { key: 'privacy', label: 'Məxfilik siyasəti' },
        { key: 'terms', label: 'İstifadə şərtləri' },
        { key: 'refund', label: 'Geri ödəniş və ləğv siyasəti' },
      ],
    },
    cookiePreferences: 'Kuki seçimləri',
    copyright: 'Bütün hüquqlar qorunur.',
  },
  en: {
    description: 'Your AI-powered personal wardrobe and styling assistant.',
    product: {
      title: 'Product',
      links: [
        { key: 'home', label: 'Home' },
        { key: 'wardrobe', label: 'Wardrobe' },
        { key: 'stylist', label: 'AI Stylist' },
        { key: 'planner', label: 'Planner' },
        { key: 'savedLooks', label: 'Saved Looks' },
        { key: 'pricing', label: 'Pricing' },
      ],
    },
    help: {
      title: 'Help',
      links: [
        { key: 'faq', label: 'FAQ' },
        { key: 'support', label: 'Support' },
        { key: 'feedback', label: 'Report a problem / Feedback' },
      ],
    },
    legal: {
      title: 'Legal',
      links: [
        { key: 'privacy', label: 'Privacy Policy' },
        { key: 'terms', label: 'Terms of Service' },
        { key: 'refund', label: 'Refund / Cancellation Policy' },
      ],
    },
    cookiePreferences: 'Cookie preferences',
    copyright: 'All rights reserved.',
  },
  ru: {
    description: 'Ваш AI-помощник для гардероба и персонального стиля.',
    product: {
      title: 'Продукт',
      links: [
        { key: 'home', label: 'Главная' },
        { key: 'wardrobe', label: 'Гардероб' },
        { key: 'stylist', label: 'AI Стилист' },
        { key: 'planner', label: 'Планировщик' },
        { key: 'savedLooks', label: 'Сохраненные образы' },
        { key: 'pricing', label: 'Цены' },
      ],
    },
    help: {
      title: 'Помощь',
      links: [
        { key: 'faq', label: 'FAQ' },
        { key: 'support', label: 'Поддержка' },
        { key: 'feedback', label: 'Сообщить о проблеме / отзыв' },
      ],
    },
    legal: {
      title: 'Правовая информация',
      links: [
        { key: 'privacy', label: 'Политика конфиденциальности' },
        { key: 'terms', label: 'Условия использования' },
        { key: 'refund', label: 'Политика возврата и отмены' },
      ],
    },
    cookiePreferences: 'Настройки cookies',
    copyright: 'Все права защищены.',
  },
}

export const supportCopy: Record<Locale, SupportPageCopy> = {
  az: {
    title: 'Dəstək və əlaqə',
    description:
      'Vestra hesabı, qarderob yükləmələri, AI stilist, planlayıcı, abunəlik və səhv hesabatları üçün dəstək.',
    eyebrow: 'Dəstək',
    intro:
      'Problem yaşayırsınızsa, mövzunu seçin və qısa, təhlükəsiz məlumat paylaşın ki, məsələni daha tez anlayaq.',
    contactTitle: 'Əlaqə',
    contactAvailable: 'Dəstək üçün yazın:',
    contactUnavailable:
      'Hazırda ictimai əlaqə ünvanı aktiv deyil. Zəhmət olmasa daha sonra yenidən yoxlayın.',
    sectionsTitle: 'Nə üçün yaza bilərsiniz',
    topics: [
      'Hesab və giriş problemləri',
      'Qarderob və şəkil yükləmə problemləri',
      'AI Stilist problemləri',
      'Planlayıcı və hava problemləri',
      'Abunəlik və ödəniş problemləri',
      'Səhv hesabatı',
      'Ümumi rəy',
    ],
    includeTitle: 'Hesabatda bunları əlavə edin',
    includeItems: [
      'Qısa təsvir',
      'Nə etməyə çalışırdınız',
      'Brauzer və cihaz',
      'Faydalıdırsa ekran görüntüsü',
    ],
    neverSendTitle: 'Bunları göndərməyin',
    neverSendItems: [
      'Şifrələr',
      'Kart nömrələri',
      'API açarları',
      'Autentifikasiya tokenləri',
    ],
  },
  en: {
    title: 'Support and contact',
    description:
      'Support for Vestra account access, wardrobe uploads, AI stylist, planner, subscriptions, and bug reports.',
    eyebrow: 'Support',
    intro:
      'If something is not working, choose the topic and share a short, safe description so we can understand the issue faster.',
    contactTitle: 'Contact',
    contactAvailable: 'For support, write to:',
    contactUnavailable:
      'The public contact address is not available right now. Please check again later.',
    sectionsTitle: 'What you can contact us about',
    topics: [
      'Account and login problems',
      'Wardrobe and image upload problems',
      'AI Stylist problems',
      'Planner and weather problems',
      'Subscription and payment problems',
      'Bug report',
      'General feedback',
    ],
    includeTitle: 'Helpful details to include',
    includeItems: [
      'Short description',
      'What you were trying to do',
      'Browser and device',
      'Screenshot if useful',
    ],
    neverSendTitle: 'Do not send',
    neverSendItems: [
      'Passwords',
      'Card numbers',
      'API keys',
      'Authentication tokens',
    ],
  },
  ru: {
    title: 'Поддержка и контакты',
    description:
      'Поддержка по входу в аккаунт, загрузке гардероба, AI Стилисту, планировщику, подпискам и баг-репортам.',
    eyebrow: 'Поддержка',
    intro:
      'Если что-то не работает, выберите тему и отправьте короткое безопасное описание, чтобы мы быстрее поняли проблему.',
    contactTitle: 'Контакт',
    contactAvailable: 'Для поддержки напишите:',
    contactUnavailable:
      'Публичный контактный адрес сейчас недоступен. Пожалуйста, проверьте позже.',
    sectionsTitle: 'С чем можно обратиться',
    topics: [
      'Проблемы с аккаунтом и входом',
      'Проблемы с гардеробом и загрузкой изображений',
      'Проблемы с AI Стилистом',
      'Проблемы с планировщиком и погодой',
      'Проблемы с подпиской и оплатой',
      'Сообщение об ошибке',
      'Общая обратная связь',
    ],
    includeTitle: 'Что полезно указать',
    includeItems: [
      'Короткое описание',
      'Что вы пытались сделать',
      'Браузер и устройство',
      'Скриншот, если он полезен',
    ],
    neverSendTitle: 'Не отправляйте',
    neverSendItems: [
      'Пароли',
      'Номера карт',
      'API-ключи',
      'Токены авторизации',
    ],
  },
}

export const faqCopy: Record<Locale, FaqPageCopy> = {
  az: {
    title: 'FAQ',
    description:
      'Vestra, AI qarderob, stilist, planlayıcı, məxfilik və Vestra Pro haqqında cavablar.',
    eyebrow: 'Kömək mərkəzi',
    intro:
      'Vestra istifadə etməzdən və ya Pro plana keçməzdən əvvəl ən vacib suallara qısa cavablar.',
    sections: [
      {
        title: 'Ümumi',
        items: [
          {
            question: 'Vestra nədir?',
            answer:
              'Vestra sahib olduğunuz geyimləri rəqəmsal qarderoba əlavə etməyə, AI ilə analiz etməyə, kombin yaratmağa və nə geyinəcəyinizi planlamağa kömək edən şəxsi stil platformasıdır.',
          },
          {
            question: 'Vestra necə işləyir?',
            answer:
              'Geyim şəklini yükləyirsiniz, Vestra fonu emal edir, geyim məlumatlarını AI ilə təhlil edir və qarderobunuzdakı real əşyalardan kombinlər təklif edir.',
          },
          {
            question: 'Vestra mobil cihazlarda işləyirmi?',
            answer:
              'Bəli. Vestra telefon, planşet və masaüstü brauzerlərdə işləmək üçün hazırlanıb.',
          },
          {
            question: 'Vestra hansı dilləri dəstəkləyir?',
            answer:
              'Vestra Azərbaycan dilini əsas dil kimi istifadə edir və ingilis və rus dillərini dəstəkləyir.',
          },
        ],
      },
      {
        title: 'Qarderob',
        items: [
          {
            question: 'Geyimləri necə əlavə edirəm?',
            answer:
              'Qarderob səhifəsində geyim şəklini seçirsiniz. İlkin yükləmədə ad və qeydlər istəyə bağlıdır, AI analizindən sonra məlumatları düzəldə bilərsiniz.',
          },
          {
            question: 'AI geyim analizi nə edir?',
            answer:
              'AI geyim növü, kateqoriya, rəng, material, mövsüm, stil və oxşar vizual məlumatları təxmin edir. Nəticələr yoxlama və düzəliş üçün göstərilir.',
          },
          {
            question: 'AI aşkar etdiyi məlumatları redaktə edə bilərəm?',
            answer:
              'Bəli. İstifadəçi düzəlişləri saxlanılır və tətbiq olunan yerlərdə AI nəticələrindən üstün tutulur.',
          },
          {
            question: 'Qarderob əşyalarını silə bilərəm?',
            answer:
              'Bəli. Özünüzə aid qarderob əşyalarını silə bilərsiniz. Tarixi qeydlər və bağlı məlumatlar təhlükəsiz şəkildə qorunur və ya ayrılır.',
          },
        ],
      },
      {
        title: 'AI Stilist',
        items: [
          {
            question: 'AI Stilist necə işləyir?',
            answer:
              'Stilist sorğunuzu, qarderob kateqoriyalarını, hava və stil siqnallarını nəzərə alaraq yalnız sizə aid geyimlərdən kombin təklif edir.',
          },
          {
            question: 'Vestra mənim öz qarderobumdan istifadə edir?',
            answer:
              'Bəli. Stilist mövcud qarderobunuzdakı əşyalarla işləyir və mövcud olmayan geyimləri uydurmamalıdır.',
          },
          {
            question: 'AI tövsiyələri həmişə mükəmməldirmi?',
            answer:
              'Xeyr. AI faydalı başlanğıc nöqtəsidir, amma səhv edə bilər. Geyim seçimi və şəxsi qərarlar sizdə qalır.',
          },
        ],
      },
      {
        title: 'Planlayıcı və hava',
        items: [
          {
            question: 'Kombin planlayıcısı necə işləyir?',
            answer:
              'Planlayıcı seçilmiş tarixlər üçün kombinləri saxlamağa və planlaşdırılmış geyimləri izləməyə kömək edir.',
          },
          {
            question: 'Hava tövsiyələrə necə təsir edir?',
            answer:
              'Hava məlumatı temperatur, yağış və mövsüm siqnalları ilə daha uyğun kombin seçməyə kömək edir.',
          },
          {
            question: 'Gələcək tarixlər üçün kombin planlaşdıra bilərəm?',
            answer:
              'Bəli. Gələcək günlər üçün kombin seçib planlayıcıda saxlaya bilərsiniz.',
          },
        ],
      },
      {
        title: 'Vestra Pro və billing',
        items: [
          {
            question: 'Vestra Pro nələri ehtiva edir?',
            answer:
              'Vestra Pro daha yüksək qarderob limitləri, daha geniş AI istifadəsi, əlavə stilist variantları və tam hava uyğun planlama üçün hazırlanıb.',
            links: [{ label: 'Qiymətlərə bax', href: '/pricing' }],
          },
          {
            question: 'Vestra Pro neçəyədir?',
            answer:
              'Cari nəzərdə tutulan qiymətlər aylıq €4.99 və illik €39.99-dur.',
            links: [{ label: 'Qiymətlər', href: '/pricing' }],
          },
          {
            question: 'Abunəlik təkrarlanır?',
            answer:
              'Bəli. Ödənişli plan seçilmiş aylıq və ya illik dövrə görə təkrarlanan abunəlik kimi işləyir.',
            links: [{ label: 'Şərtlər', href: '/terms' }],
          },
          {
            question: 'Abunəliyi necə ləğv edirəm?',
            answer:
              'Abunəliyi hesabdakı billing bölməsindən və ya Paddle billing portalından idarə edib ləğv edə bilərsiniz.',
            links: [{ label: 'Geri ödəniş və ləğv', href: '/refund' }],
          },
          {
            question: 'Ləğvdən sonra nə baş verir?',
            answer:
              'Adətən Pro girişi ödənilmiş cari dövrün sonuna qədər qalır. Yekun qaydalar refund və ləğv siyasətində izah olunur.',
            links: [{ label: 'Siyasətə bax', href: '/refund' }],
          },
          {
            question: 'Abunəliyi bərpa edə bilərəm?',
            answer:
              'Mövcud billing statusundan asılı olaraq abunəliyi bərpa etmək və ya yenidən Pro plana keçmək mümkündür.',
          },
          {
            question: 'Billing-i necə idarə edirəm?',
            answer:
              'Daxil olduqdan sonra hesabınızda Subscription / Plan bölməsindən billing portalını aça bilərsiniz.',
          },
          {
            question: 'Ödənişləri kim emal edir?',
            answer:
              'Ödənişli abunəliklər Paddle tərəfindən emal olunur. Vestra xam kart məlumatlarını saxlamır.',
            links: [
              { label: 'Məxfilik', href: '/privacy' },
              { label: 'Şərtlər', href: '/terms' },
            ],
          },
        ],
      },
      {
        title: 'Məxfilik',
        items: [
          {
            question: 'Məlumatlarım necə istifadə olunur?',
            answer:
              'Məlumatlar hesabı qorumaq, qarderob və stilist funksiyalarını işlətmək, dəstək göstərmək və məhsulu yaxşılaşdırmaq üçün istifadə olunur.',
            links: [{ label: 'Məxfilik siyasəti', href: '/privacy' }],
          },
          {
            question: 'Kuki seçimlərini necə dəyişə bilərəm?',
            answer:
              'Kuki seçimləri düyməsi vasitəsilə analitika razılığını istənilən vaxt dəyişə bilərsiniz.',
          },
          {
            question: 'Vestra ilə necə əlaqə saxlayım?',
            answer:
              'Dəstək səhifəsində problem növünü seçib nə baş verdiyini və hansı cihazdan istifadə etdiyinizi paylaşa bilərsiniz.',
            links: [{ label: 'Dəstək', href: '/support' }],
          },
        ],
      },
    ],
  },
  en: {
    title: 'FAQ',
    description:
      'Answers about Vestra, the AI wardrobe, stylist, planner, privacy, and Vestra Pro.',
    eyebrow: 'Help center',
    intro:
      'Short answers to the most important questions before you use Vestra or upgrade to Pro.',
    sections: [
      {
        title: 'General',
        items: [
          {
            question: 'What is Vestra?',
            answer:
              'Vestra is a personal styling platform that helps you add clothes you already own to a digital wardrobe, analyze them with AI, create outfits, and plan what to wear.',
          },
          {
            question: 'How does Vestra work?',
            answer:
              'You upload a clothing photo, Vestra processes the image, analyzes clothing details with AI, and suggests outfits using real items from your wardrobe.',
          },
          {
            question: 'Is Vestra available on mobile?',
            answer:
              'Yes. Vestra is designed to work on phones, tablets, and desktop browsers.',
          },
          {
            question: 'What languages does Vestra support?',
            answer:
              'Vestra uses Azerbaijani as the default language and supports English and Russian.',
          },
        ],
      },
      {
        title: 'Wardrobe',
        items: [
          {
            question: 'How do I add clothes?',
            answer:
              'On the wardrobe page, select a clothing photo. Name and notes are optional during first upload, and you can correct the detected details after AI analysis.',
          },
          {
            question: 'What does AI clothing analysis do?',
            answer:
              'AI estimates clothing type, category, colors, material, season, style, and other visual details. Results are shown for review and correction.',
          },
          {
            question: 'Can I edit AI-detected information?',
            answer:
              'Yes. User corrections are stored and override AI values where Vestra uses corrected wardrobe data.',
          },
          {
            question: 'Can I delete wardrobe items?',
            answer:
              'Yes. You can delete wardrobe items you own. Historical records and related references are preserved or detached safely.',
          },
        ],
      },
      {
        title: 'AI Stylist',
        items: [
          {
            question: 'How does the AI Stylist work?',
            answer:
              'The stylist considers your request, wardrobe categories, weather, and style signals, then recommends outfits using only your own clothing items.',
          },
          {
            question: 'Does Vestra use my own wardrobe?',
            answer:
              'Yes. The stylist works from your saved wardrobe and should not invent items you do not own.',
          },
          {
            question: 'Are AI recommendations guaranteed to be perfect?',
            answer:
              'No. AI is a helpful starting point, but it can be wrong. You remain responsible for clothing choices and personal decisions.',
          },
        ],
      },
      {
        title: 'Planner and weather',
        items: [
          {
            question: 'How does the outfit planner work?',
            answer:
              'The planner helps you save outfits for selected dates and keep track of planned looks.',
          },
          {
            question: 'How does weather affect recommendations?',
            answer:
              'Weather data helps Vestra account for temperature, rain, and seasonal signals when suggesting suitable outfits.',
          },
          {
            question: 'Can I schedule outfits for future dates?',
            answer:
              'Yes. You can choose outfits for future days and save them in the planner.',
          },
        ],
      },
      {
        title: 'Vestra Pro and billing',
        items: [
          {
            question: 'What is included in Vestra Pro?',
            answer:
              'Vestra Pro is designed for higher wardrobe limits, expanded AI usage, additional stylist candidates, and full weather-aware planning.',
            links: [{ label: 'View pricing', href: '/pricing' }],
          },
          {
            question: 'How much does Vestra Pro cost?',
            answer:
              'The current intended pricing is €4.99 per month or €39.99 per year.',
            links: [{ label: 'Pricing', href: '/pricing' }],
          },
          {
            question: 'Is the subscription recurring?',
            answer:
              'Yes. Paid plans renew as a recurring monthly or yearly subscription according to the selected billing interval.',
            links: [{ label: 'Terms', href: '/terms' }],
          },
          {
            question: 'How do I cancel?',
            answer:
              'You can manage and cancel your subscription from the billing area in your account or through the Paddle billing portal.',
            links: [{ label: 'Refund and cancellation', href: '/refund' }],
          },
          {
            question: 'What happens after cancellation?',
            answer:
              'Pro access normally remains until the end of the paid billing period. Final rules are described in the refund and cancellation policy.',
            links: [{ label: 'Read policy', href: '/refund' }],
          },
          {
            question: 'Can I resume my subscription?',
            answer:
              'Depending on the billing status, you may be able to resume the subscription or upgrade again.',
          },
          {
            question: 'How do I manage billing?',
            answer:
              'After signing in, open Subscription / Plan from your account menu to access billing actions.',
          },
          {
            question: 'Who processes payments?',
            answer:
              'Paid subscriptions are processed by Paddle. Vestra does not store raw card details.',
            links: [
              { label: 'Privacy', href: '/privacy' },
              { label: 'Terms', href: '/terms' },
            ],
          },
        ],
      },
      {
        title: 'Privacy',
        items: [
          {
            question: 'How is my data used?',
            answer:
              'Data is used to operate the account, wardrobe, stylist, and planner features, protect the service, provide support, and improve Vestra.',
            links: [{ label: 'Privacy Policy', href: '/privacy' }],
          },
          {
            question: 'How can I change cookie preferences?',
            answer:
              'Use the Cookie preferences button to change analytics consent at any time.',
          },
          {
            question: 'How can I contact Vestra?',
            answer:
              'Use the support page and include what happened, what you were trying to do, and your device or browser.',
            links: [{ label: 'Support', href: '/support' }],
          },
        ],
      },
    ],
  },
  ru: {
    title: 'FAQ',
    description:
      'Ответы о Vestra, AI-гардеробе, стилисте, планировщике, приватности и Vestra Pro.',
    eyebrow: 'Центр помощи',
    intro:
      'Короткие ответы на важные вопросы перед использованием Vestra или переходом на Pro.',
    sections: [
      {
        title: 'Общее',
        items: [
          {
            question: 'Что такое Vestra?',
            answer:
              'Vestra - персональная fashion-платформа, которая помогает добавить вашу одежду в цифровой гардероб, анализировать вещи с AI, создавать образы и планировать, что надеть.',
          },
          {
            question: 'Как работает Vestra?',
            answer:
              'Вы загружаете фото вещи, Vestra обрабатывает изображение, анализирует детали одежды с AI и предлагает образы из реальных вещей вашего гардероба.',
          },
          {
            question: 'Vestra работает на мобильных устройствах?',
            answer:
              'Да. Vestra рассчитана на телефоны, планшеты и desktop-браузеры.',
          },
          {
            question: 'Какие языки поддерживает Vestra?',
            answer:
              'Основной язык Vestra - азербайджанский. Также поддерживаются английский и русский.',
          },
        ],
      },
      {
        title: 'Гардероб',
        items: [
          {
            question: 'Как добавить одежду?',
            answer:
              'На странице гардероба выберите фото вещи. Название и заметки при первой загрузке необязательны, а после AI-анализа вы можете исправить найденные данные.',
          },
          {
            question: 'Что делает AI-анализ одежды?',
            answer:
              'AI определяет тип вещи, категорию, цвета, материал, сезон, стиль и другие визуальные детали. Результаты можно проверить и исправить.',
          },
          {
            question: 'Можно редактировать данные, найденные AI?',
            answer:
              'Да. Исправления пользователя сохраняются и имеют приоритет там, где Vestra использует уточненные данные гардероба.',
          },
          {
            question: 'Можно удалить вещи из гардероба?',
            answer:
              'Да. Вы можете удалять свои вещи. Исторические записи и связанные ссылки сохраняются или отделяются безопасно.',
          },
        ],
      },
      {
        title: 'AI Стилист',
        items: [
          {
            question: 'Как работает AI Стилист?',
            answer:
              'Стилист учитывает ваш запрос, категории гардероба, погоду и стиль, затем рекомендует образы только из ваших вещей.',
          },
          {
            question: 'Vestra использует мой собственный гардероб?',
            answer:
              'Да. Стилист работает с сохраненным гардеробом и не должен придумывать вещи, которых у вас нет.',
          },
          {
            question: 'AI-рекомендации всегда идеальны?',
            answer:
              'Нет. AI - полезная отправная точка, но он может ошибаться. Вы отвечаете за выбор одежды и личные решения.',
          },
        ],
      },
      {
        title: 'Планировщик и погода',
        items: [
          {
            question: 'Как работает планировщик образов?',
            answer:
              'Планировщик помогает сохранить образы на выбранные даты и отслеживать запланированные варианты.',
          },
          {
            question: 'Как погода влияет на рекомендации?',
            answer:
              'Погода помогает учитывать температуру, дождь и сезонные сигналы при выборе подходящего образа.',
          },
          {
            question: 'Можно планировать образы на будущие даты?',
            answer:
              'Да. Вы можете выбрать образ на будущий день и сохранить его в планировщике.',
          },
        ],
      },
      {
        title: 'Vestra Pro и оплата',
        items: [
          {
            question: 'Что входит в Vestra Pro?',
            answer:
              'Vestra Pro рассчитан на повышенные лимиты гардероба, расширенное использование AI, дополнительные варианты от стилиста и полноценное планирование с учетом погоды.',
            links: [{ label: 'Посмотреть цены', href: '/pricing' }],
          },
          {
            question: 'Сколько стоит Vestra Pro?',
            answer:
              'Текущая планируемая цена - €4.99 в месяц или €39.99 в год.',
            links: [{ label: 'Цены', href: '/pricing' }],
          },
          {
            question: 'Подписка продлевается автоматически?',
            answer:
              'Да. Платные планы продлеваются как ежемесячная или ежегодная подписка в зависимости от выбранного периода оплаты.',
            links: [{ label: 'Условия', href: '/terms' }],
          },
          {
            question: 'Как отменить подписку?',
            answer:
              'Вы можете управлять подпиской и отменить ее в разделе оплаты аккаунта или через billing-портал Paddle.',
            links: [{ label: 'Возврат и отмена', href: '/refund' }],
          },
          {
            question: 'Что будет после отмены?',
            answer:
              'Обычно доступ Pro сохраняется до конца оплаченного периода. Финальные правила описаны в политике возвратов и отмены.',
            links: [{ label: 'Открыть политику', href: '/refund' }],
          },
          {
            question: 'Можно возобновить подписку?',
            answer:
              'В зависимости от статуса оплаты вы можете возобновить подписку или снова перейти на Pro.',
          },
          {
            question: 'Как управлять оплатой?',
            answer:
              'После входа откройте Subscription / Plan в меню аккаунта, чтобы перейти к действиям с оплатой.',
          },
          {
            question: 'Кто обрабатывает платежи?',
            answer:
              'Платные подписки обрабатывает Paddle. Vestra не хранит необработанные данные банковских карт.',
            links: [
              { label: 'Приватность', href: '/privacy' },
              { label: 'Условия', href: '/terms' },
            ],
          },
        ],
      },
      {
        title: 'Приватность',
        items: [
          {
            question: 'Как используются мои данные?',
            answer:
              'Данные используются для работы аккаунта, гардероба, стилиста и планировщика, защиты сервиса, поддержки и улучшения Vestra.',
            links: [{ label: 'Политика конфиденциальности', href: '/privacy' }],
          },
          {
            question: 'Как изменить настройки cookies?',
            answer:
              'Используйте кнопку настроек cookies, чтобы в любое время изменить согласие на аналитику.',
          },
          {
            question: 'Как связаться с Vestra?',
            answer:
              'Используйте страницу поддержки и опишите, что произошло, что вы пытались сделать, а также устройство или браузер.',
            links: [{ label: 'Поддержка', href: '/support' }],
          },
        ],
      },
    ],
  },
}
