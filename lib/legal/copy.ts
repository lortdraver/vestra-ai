import type { Locale } from '@/lib/i18n/config'
import { getPrivacyContact } from '@/lib/privacy/copy'

type LegalSection = {
  title: string
  body: string[]
}

type LegalDocumentCopy = {
  title: string
  description: string
  eyebrow: string
  effectiveDate: string
  ownerReviewNotice: string
  contactLabel: string
  contactValue: string
  sections: LegalSection[]
}

type PublicLegalCopy = {
  privacy: string
  terms: string
  refund: string
  cookiePreferences: string
}

export function getPublicLegalCopy(locale: Locale): PublicLegalCopy {
  return {
    az: {
      privacy: 'Məxfilik',
      terms: 'Şərtlər',
      refund: 'Geri ödəniş və ləğv',
      cookiePreferences: 'Kuki seçimləri',
    },
    en: {
      privacy: 'Privacy',
      terms: 'Terms',
      refund: 'Refunds and cancellation',
      cookiePreferences: 'Cookie preferences',
    },
    ru: {
      privacy: 'Приватность',
      terms: 'Условия',
      refund: 'Возвраты и отмена',
      cookiePreferences: 'Настройки cookies',
    },
  }[locale]
}

export function getTermsCopy(
  locale: Locale,
  contactEmail?: string | null,
): LegalDocumentCopy {
  const contact = getPrivacyContact(locale, contactEmail)

  return {
    az: {
      title: 'İstifadə şərtləri',
      description:
        'Vestra hesabları, AI qarderob funksiyaları, Free və Pro planları üçün ilkin istifadə şərtləri.',
      eyebrow: 'Vestra şərtləri',
      effectiveDate: 'Layihə versiyası: 15 avqust 2026',
      ownerReviewNotice:
        'Bu sənəd canlı buraxılışdan əvvəl sahib və hüquq mütəxəssisi tərəfindən tamamlanmalı olan layihə mətndir. Hüquqi şəxs, ünvan, yurisdiksiya və vergi məlumatları hələ əlavə edilməyib.',
      contactLabel: 'Əlaqə',
      contactValue: contact,
      sections: [
        {
          title: 'Xidmət',
          body: [
            'Vestra istifadəçilərə sahib olduqları geyimləri rəqəmsal qarderoba əlavə etməyə, AI analizi aparmağa, kombinlər yaratmağa və geyim planları qurmağa kömək edir.',
          ],
        },
        {
          title: 'Hesab istifadəsi',
          body: [
            'Hesab məlumatlarınızın təhlükəsizliyinə görə cavabdehsiniz. Başqasının hesabına icazəsiz giriş, sui-istifadə və ya xidməti pozan fəaliyyətlər qadağandır.',
          ],
        },
        {
          title: 'Free və Pro planları',
          body: [
            'Vestra Free məhdud funksiyalar təqdim edir. Vestra Pro əlavə limitlər və premium funksiyalar təqdim edə bilər.',
            'Ödənişli abunəliklər Paddle tərəfindən emal olunur. Vestra xam kart məlumatlarını saxlamır.',
          ],
        },
        {
          title: 'Abunəlik, yenilənmə və ləğv',
          body: [
            'Ödənişli planlar seçilmiş aylıq və ya illik dövrə görə təkrarlanan əsasda yenilənə bilər.',
            'Abunəliyi ləğv etdikdə, giriş adətən cari ödəniş dövrünün sonuna qədər qalır. Dəqiq qaydalar Paddle hesablaşma axını və tətbiq olunan qanunlara görə tamamlanmalıdır.',
          ],
        },
        {
          title: 'Qəbul edilən istifadə',
          body: [
            'Zərərli fayllar, icazəsiz şəxsi məlumatlar, hüquqları pozan məzmun və xidməti yükləyən avtomatlaşdırılmış sui-istifadə qadağandır.',
          ],
        },
        {
          title: 'AI tövsiyələri',
          body: [
            'AI tərəfindən verilən geyim və stil tövsiyələri məlumat xarakterlidir və peşəkar, tibbi, hüquqi və ya maliyyə məsləhəti deyil.',
            'AI səhv edə bilər. İstifadəçi geyim seçimi və şəxsi qərarları üçün məsul qalır.',
          ],
        },
        {
          title: 'Əlçatanlıq və dəyişikliklər',
          body: [
            'Vestra xidməti davamlı saxlamağa çalışır, lakin kəsintisiz və ya səhvsiz işləmə zəmanəti vermir.',
            'Funksiyalar, limitlər və planlar məhsul inkişaf etdikcə dəyişə bilər.',
          ],
        },
        {
          title: 'Hesabın dayandırılması',
          body: [
            'Qayda pozuntusu, təhlükəsizlik riski və ya qanuni tələb olduqda hesab məhdudlaşdırıla və ya dayandırıla bilər.',
          ],
        },
        {
          title: 'Əqli mülkiyyət',
          body: [
            'Vestra brendi, proqram təminatı və məhsul dizaynı Vestra-ya və ya müvafiq sahiblərinə məxsusdur. Yüklədiyiniz geyim şəkillərinə hüquqlarınız sizdə qalır.',
          ],
        },
        {
          title: 'Məhdudiyyətlər və məxfilik',
          body: [
            'Məsuliyyət məhdudiyyətləri, yurisdiksiya və məcburi istehlakçı hüquqları canlı buraxılışdan əvvəl hüquqi baxışla tamamlanmalıdır.',
            'Məlumatların emalı Məxfilik siyasətində izah olunur.',
          ],
        },
      ],
    },
    en: {
      title: 'Terms of Service',
      description:
        'Draft terms for Vestra accounts, AI wardrobe features, and Free and Pro plans.',
      eyebrow: 'Vestra terms',
      effectiveDate: 'Draft version: August 15, 2026',
      ownerReviewNotice:
        'This is a draft that must be completed by the owner and legal counsel before public launch. Legal entity, address, jurisdiction, and tax details have not been inserted yet.',
      contactLabel: 'Contact',
      contactValue: contact,
      sections: [
        {
          title: 'Service',
          body: [
            'Vestra helps users add clothes they already own to a digital wardrobe, analyze items with AI, generate outfits, and plan what to wear.',
          ],
        },
        {
          title: 'Account use',
          body: [
            'You are responsible for keeping your account secure. Unauthorized access, abuse, or activity that disrupts the service is prohibited.',
          ],
        },
        {
          title: 'Free and Pro plans',
          body: [
            'Vestra Free provides limited functionality. Vestra Pro may provide higher limits and premium features.',
            'Paid subscriptions are processed by Paddle. Vestra does not store raw card details.',
          ],
        },
        {
          title: 'Subscriptions, renewal, and cancellation',
          body: [
            'Paid plans may renew on a recurring monthly or yearly basis according to the selected billing interval.',
            'When a subscription is canceled, access normally remains until the end of the current billing period. Final rules must be completed according to Paddle billing flow and applicable law.',
          ],
        },
        {
          title: 'Acceptable use',
          body: [
            'Malicious files, unauthorized personal data, rights-infringing content, and automated abuse that burdens the service are prohibited.',
          ],
        },
        {
          title: 'AI recommendations',
          body: [
            'AI outfit and style recommendations are informational and are not professional, medical, legal, or financial advice.',
            'AI may be wrong. Users remain responsible for clothing choices and personal decisions.',
          ],
        },
        {
          title: 'Availability and changes',
          body: [
            'Vestra works to keep the service available, but does not guarantee uninterrupted or error-free operation.',
            'Features, limits, and plans may change as the product evolves.',
          ],
        },
        {
          title: 'Account termination',
          body: [
            'Accounts may be restricted or terminated for policy violations, security risks, or legal requirements.',
          ],
        },
        {
          title: 'Intellectual property',
          body: [
            'The Vestra brand, software, and product design belong to Vestra or their respective owners. Rights in wardrobe photos you upload remain with you.',
          ],
        },
        {
          title: 'Limitations and privacy',
          body: [
            'Liability limits, jurisdiction, and mandatory consumer rights must be finalized through legal review before public launch.',
            'Data processing is explained in the Privacy Policy.',
          ],
        },
      ],
    },
    ru: {
      title: 'Условия использования',
      description:
        'Черновые условия для аккаунтов Vestra, AI-гардероба и планов Free и Pro.',
      eyebrow: 'Условия Vestra',
      effectiveDate: 'Черновая версия: 15 августа 2026',
      ownerReviewNotice:
        'Это черновой текст, который владелец и юрист должны завершить перед публичным запуском. Юридическое лицо, адрес, юрисдикция и налоговые данные еще не добавлены.',
      contactLabel: 'Контакт',
      contactValue: contact,
      sections: [
        {
          title: 'Сервис',
          body: [
            'Vestra помогает пользователям добавлять одежду, которой они уже владеют, в цифровой гардероб, анализировать вещи с помощью AI, создавать образы и планировать, что надеть.',
          ],
        },
        {
          title: 'Использование аккаунта',
          body: [
            'Вы отвечаете за безопасность своего аккаунта. Несанкционированный доступ, злоупотребления и действия, нарушающие работу сервиса, запрещены.',
          ],
        },
        {
          title: 'Планы Free и Pro',
          body: [
            'Vestra Free предоставляет ограниченные функции. Vestra Pro может предоставлять повышенные лимиты и премиум-функции.',
            'Платные подписки обрабатываются Paddle. Vestra не хранит необработанные данные банковских карт.',
          ],
        },
        {
          title: 'Подписка, продление и отмена',
          body: [
            'Платные планы могут продлеваться автоматически каждый месяц или год в зависимости от выбранного периода оплаты.',
            'При отмене подписки доступ обычно сохраняется до конца текущего оплаченного периода. Финальные правила должны быть уточнены с учетом Paddle и применимого законодательства.',
          ],
        },
        {
          title: 'Допустимое использование',
          body: [
            'Запрещены вредоносные файлы, несанкционированные персональные данные, контент, нарушающий права, и автоматизированные злоупотребления, перегружающие сервис.',
          ],
        },
        {
          title: 'AI-рекомендации',
          body: [
            'AI-рекомендации по одежде и стилю носят информационный характер и не являются профессиональной, медицинской, юридической или финансовой консультацией.',
            'AI может ошибаться. Пользователь самостоятельно отвечает за выбор одежды и личные решения.',
          ],
        },
        {
          title: 'Доступность и изменения',
          body: [
            'Vestra стремится поддерживать доступность сервиса, но не гарантирует непрерывную или безошибочную работу.',
            'Функции, лимиты и планы могут меняться по мере развития продукта.',
          ],
        },
        {
          title: 'Прекращение аккаунта',
          body: [
            'Аккаунты могут быть ограничены или прекращены при нарушении правил, рисках безопасности или юридических требованиях.',
          ],
        },
        {
          title: 'Интеллектуальная собственность',
          body: [
            'Бренд Vestra, программное обеспечение и дизайн продукта принадлежат Vestra или соответствующим владельцам. Права на загруженные фотографии гардероба остаются у вас.',
          ],
        },
        {
          title: 'Ограничения и приватность',
          body: [
            'Ограничения ответственности, юрисдикция и обязательные права потребителей должны быть финализированы после юридической проверки перед публичным запуском.',
            'Обработка данных описана в Политике конфиденциальности.',
          ],
        },
      ],
    },
  }[locale]
}

export function getRefundCopy(
  locale: Locale,
  contactEmail?: string | null,
): LegalDocumentCopy {
  const contact = getPrivacyContact(locale, contactEmail)

  return {
    az: {
      title: 'Geri ödəniş və ləğv siyasəti',
      description:
        'Vestra Pro abunəliklərinin ləğvi, yenilənməsi və geri ödənişləri üçün ilkin siyasət.',
      eyebrow: 'Hesablaşma',
      effectiveDate: 'Layihə versiyası: 15 avqust 2026',
      ownerReviewNotice:
        'Bu layihə mətndir. Geri ödəniş hüquqları, yurisdiksiya və istehlakçı qaydaları canlı buraxılışdan əvvəl sahib və hüquq mütəxəssisi tərəfindən təsdiqlənməlidir.',
      contactLabel: 'Geri ödəniş üçün əlaqə',
      contactValue: contact,
      sections: [
        {
          title: 'Təkrarlanan hesablaşma',
          body: [
            'Vestra Pro aylıq və ya illik təkrarlanan abunəlik kimi təklif oluna bilər.',
            'Ödənişlər Paddle tərəfindən emal olunur. Vestra xam kart məlumatlarını saxlamır.',
          ],
        },
        {
          title: 'Ləğv',
          body: [
            'Abunəliyi hesablaşma portalından ləğv edə bilərsiniz. Ləğv edildikdə giriş adətən cari ödəniş dövrünün sonuna qədər qalır.',
          ],
        },
        {
          title: 'Geri ödəniş sorğuları',
          body: [
            'Geri ödəniş sorğuları göstərilən əlaqə kanalı ilə göndərilməlidir. Sorğular Paddle emalı, tətbiq olunan qanunlar və Vestra-nın yekun siyasəti əsasında nəzərdən keçiriləcək.',
          ],
        },
        {
          title: 'Aylıq və illik planlar',
          body: [
            'Aylıq və illik planların geri ödəniş qaydaları canlı buraxılışdan əvvəl hüquqi baxışla dəqiqləşdirilməlidir.',
          ],
        },
        {
          title: 'Ödəniş problemləri',
          body: [
            'Ödəniş alınmadıqda hesab məhdudlaşdırıla, güzəşt müddəti tətbiq oluna və ya abunəlik dayandırıla bilər.',
          ],
        },
      ],
    },
    en: {
      title: 'Refund and Cancellation Policy',
      description:
        'Draft refund, renewal, and cancellation policy for Vestra Pro subscriptions.',
      eyebrow: 'Billing',
      effectiveDate: 'Draft version: August 15, 2026',
      ownerReviewNotice:
        'This is a draft. Refund rights, jurisdiction, and consumer rules must be confirmed by the owner and legal counsel before public launch.',
      contactLabel: 'Refund contact',
      contactValue: contact,
      sections: [
        {
          title: 'Recurring billing',
          body: [
            'Vestra Pro may be offered as a monthly or yearly recurring subscription.',
            'Payments are processed by Paddle. Vestra does not store raw card details.',
          ],
        },
        {
          title: 'Cancellation',
          body: [
            'You can cancel through the billing portal. When canceled, access normally remains until the end of the current billing period.',
          ],
        },
        {
          title: 'Refund requests',
          body: [
            'Refund requests should be sent through the listed contact channel. Requests will be reviewed based on Paddle processing, applicable law, and Vestra’s final policy.',
          ],
        },
        {
          title: 'Monthly and yearly plans',
          body: [
            'Refund rules for monthly and yearly plans must be finalized through legal review before public launch.',
          ],
        },
        {
          title: 'Payment issues',
          body: [
            'If payment cannot be collected, the account may be limited, receive a grace period, or have subscription access paused.',
          ],
        },
      ],
    },
    ru: {
      title: 'Политика возвратов и отмены',
      description:
        'Черновая политика возвратов, продления и отмены для подписок Vestra Pro.',
      eyebrow: 'Оплата',
      effectiveDate: 'Черновая версия: 15 августа 2026',
      ownerReviewNotice:
        'Это черновой текст. Права на возврат, юрисдикция и правила защиты потребителей должны быть подтверждены владельцем и юристом перед публичным запуском.',
      contactLabel: 'Контакт для возвратов',
      contactValue: contact,
      sections: [
        {
          title: 'Регулярные платежи',
          body: [
            'Vestra Pro может предлагаться как ежемесячная или ежегодная повторяющаяся подписка.',
            'Платежи обрабатываются Paddle. Vestra не хранит необработанные данные банковских карт.',
          ],
        },
        {
          title: 'Отмена',
          body: [
            'Вы можете отменить подписку через платежный портал. При отмене доступ обычно сохраняется до конца текущего оплаченного периода.',
          ],
        },
        {
          title: 'Запросы на возврат',
          body: [
            'Запросы на возврат следует отправлять через указанный контактный канал. Они будут рассматриваться с учетом обработки Paddle, применимого закона и финальной политики Vestra.',
          ],
        },
        {
          title: 'Месячные и годовые планы',
          body: [
            'Правила возврата для месячных и годовых планов должны быть финализированы после юридической проверки перед публичным запуском.',
          ],
        },
        {
          title: 'Проблемы с оплатой',
          body: [
            'Если платеж не удается списать, аккаунт может быть ограничен, получить льготный период или потерять доступ к подписке.',
          ],
        },
      ],
    },
  }[locale]
}
