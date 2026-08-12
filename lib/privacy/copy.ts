import type { Locale } from '@/lib/i18n/config'

export type ConsentCopy = {
  bannerTitle: string
  bannerBody: string
  acceptAnalytics: string
  rejectAnalytics: string
  managePreferences: string
  dialogTitle: string
  dialogDescription: string
  necessaryTitle: string
  necessaryBody: string
  alwaysActive: string
  analyticsTitle: string
  analyticsBody: string
  analyticsToggleLabel: string
  savePreferences: string
  cookiePreferences: string
  close: string
  saved: string
}

export type PrivacySection = {
  title: string
  body: string[]
}

export type PrivacyPolicyCopy = {
  title: string
  eyebrow: string
  intro: string
  effectiveDate: string
  contactLabel: string
  contactFallback: string
  sections: PrivacySection[]
  cookieDecision: string
}

export const consentCopy: Record<Locale, ConsentCopy> = {
  az: {
    bannerTitle: 'Məxfilik seçimləriniz',
    bannerBody:
      'Vestra hesab, təhlükəsizlik və dil kimi zəruri funksiyalar üçün vacib kukilərdən istifadə edir. Analitika kukiləri yalnız razılığınızla məhsulu yaxşılaşdırmaq üçün istifadə olunacaq.',
    acceptAnalytics: 'Analitikanı qəbul et',
    rejectAnalytics: 'Analitikanı rədd et',
    managePreferences: 'Seçimləri idarə et',
    dialogTitle: 'Kuki seçimləri',
    dialogDescription:
      'Zəruri kukilər Vestra-nın işləməsi üçün qalır. Analitika istənilən vaxt dəyişdirilə bilər.',
    necessaryTitle: 'Zəruri',
    necessaryBody:
      'Giriş, təhlükəsizlik, seans, dil və hesab qorunması üçün lazımdır.',
    alwaysActive: 'Həmişə aktiv',
    analyticsTitle: 'Analitika',
    analyticsBody:
      'Səhifə trafiki və istifadə təcrübəsi haqqında məxfilik qorunan ölçmələr. E-poçt, şəkillər, qeydlər və AI məzmunu göndərilmir.',
    analyticsToggleLabel: 'Analitika kukilərinə icazə ver',
    savePreferences: 'Seçimləri saxla',
    cookiePreferences: 'Kuki seçimləri',
    close: 'Bağla',
    saved: 'Seçimlər saxlanıldı.',
  },
  en: {
    bannerTitle: 'Your privacy choices',
    bannerBody:
      'Vestra uses necessary cookies for account, security, and language features. Analytics cookies will only be used with your consent to improve the product.',
    acceptAnalytics: 'Accept analytics',
    rejectAnalytics: 'Reject analytics',
    managePreferences: 'Manage preferences',
    dialogTitle: 'Cookie preferences',
    dialogDescription:
      'Necessary cookies keep Vestra working. Analytics can be changed at any time.',
    necessaryTitle: 'Necessary',
    necessaryBody:
      'Required for sign-in, security, sessions, language, and account protection.',
    alwaysActive: 'Always active',
    analyticsTitle: 'Analytics',
    analyticsBody:
      'Privacy-preserving measurement of page traffic and product experience. Emails, images, notes, and AI content are not sent.',
    analyticsToggleLabel: 'Allow analytics cookies',
    savePreferences: 'Save preferences',
    cookiePreferences: 'Cookie preferences',
    close: 'Close',
    saved: 'Preferences saved.',
  },
  ru: {
    bannerTitle: 'Ваши настройки приватности',
    bannerBody:
      'Vestra использует необходимые cookies для аккаунта, безопасности и языка. Аналитические cookies будут использоваться только с вашего согласия для улучшения продукта.',
    acceptAnalytics: 'Принять аналитику',
    rejectAnalytics: 'Отклонить аналитику',
    managePreferences: 'Настроить',
    dialogTitle: 'Настройки cookies',
    dialogDescription:
      'Необходимые cookies обеспечивают работу Vestra. Аналитику можно изменить в любое время.',
    necessaryTitle: 'Необходимые',
    necessaryBody:
      'Нужны для входа, безопасности, сессий, языка и защиты аккаунта.',
    alwaysActive: 'Всегда активны',
    analyticsTitle: 'Аналитика',
    analyticsBody:
      'Конфиденциальное измерение трафика страниц и опыта использования. Email, изображения, заметки и AI-контент не отправляются.',
    analyticsToggleLabel: 'Разрешить аналитические cookies',
    savePreferences: 'Сохранить',
    cookiePreferences: 'Настройки cookies',
    close: 'Закрыть',
    saved: 'Настройки сохранены.',
  },
}

export function getPrivacyPolicyCopy(
  locale: Locale,
  contactEmail?: string | null,
): PrivacyPolicyCopy {
  const contact = contactEmail || 'Configure PRIVACY_CONTACT_EMAIL'

  const policies: Record<Locale, PrivacyPolicyCopy> = {
    az: {
      title: 'Məxfilik siyasəti',
      eyebrow: 'Vestra məxfiliyi',
      intro:
        'Bu siyasət Vestra-nın AI qarderob, şəxsi stilist, kombin və planlayıcı funksiyalarında məlumatları necə emal etdiyini izah edir.',
      effectiveDate: 'Qüvvəyə minmə tarixi: 12 avqust 2026',
      contactLabel: 'Məxfilik üçün əlaqə',
      contactFallback: contact,
      cookieDecision:
        'İlkin buraxılış üçün kuki siyasəti bu məxfilik siyasətinin daxilindədir.',
      sections: [
        {
          title: 'Xidmət haqqında',
          body: [
            'Vestra istifadəçilərə sahib olduqları geyimləri yükləməyə, AI ilə analiz etməyə, kombinlər yaratmağa və geyim planları qurmağa kömək edən rəqəmsal qarderob məhsuludur.',
          ],
        },
        {
          title: 'Verdiyiniz məlumatlar',
          body: [
            'Hesab yaratdıqda ad, e-poçt və şifrə məlumatları emal olunur. Şifrələr təhlükəsiz şəkildə saxlanılır.',
            'Qarderob şəkilləri, geyim adı, kateqoriya, rəng, material, brend, mövsüm, stil və qeydlər yalnız Vestra funksiyalarını təmin etmək üçün istifadə olunur.',
          ],
        },
        {
          title: 'AI emalı',
          body: [
            'Geyim analizi, fon silmə və AI stilist funksiyaları üçün şəkil və geyim metadatası konfiqurasiya olunmuş xidmət provayderlərinə göndərilə bilər.',
            'AI nəticələri istifadəçi düzəlişlərindən ayrıca saxlanılır ki, istifadəçi düzəlişləri üstünlük təşkil etsin.',
          ],
        },
        {
          title: 'Texniki və təhlükəsizlik məlumatları',
          body: [
            'Seanslar, IP ünvanı, istifadəçi agenti, audit hadisələri və təhlükəsizlik hadisələri giriş, sui-istifadənin qarşısı və hesab qorunması üçün emal edilə bilər.',
          ],
        },
        {
          title: 'Kukilər və analitika',
          body: [
            'Zəruri kukilər giriş, təhlükəsizlik, dil və hesab funksiyaları üçün lazımdır və analitika seçimindən asılı deyil.',
            'Analitika kukiləri yalnız razılıq verildikdə aktivləşdirilir. Vestra GA4 və Clarity-ni yalnız razılığınızdan sonra yükləyir.',
            'Vercel Analytics qeyri-zəruri analitika kimi qəbul edilir və yalnız analitika razılığı olduqda yüklənir.',
          ],
        },
        {
          title: 'Saxlama və provayderlər',
          body: [
            'Məlumatlar PostgreSQL/Neon, Vercel və Cloudflare R2 kimi infrastrukturda saxlanıla bilər. Şəkillər özəl saxlanılır və sahiblik yoxlaması ilə təqdim olunur.',
            'Məlumatlar xidmətin işləməsi, təhlükəsizlik, istifadəçi dəstəyi, məhsulun yaxşılaşdırılması və qanuni tələblər üçün emal olunur.',
          ],
        },
        {
          title: 'Seçimləriniz və hüquqlarınız',
          body: [
            'Analitika razılığını istənilən vaxt Kuki seçimləri vasitəsilə dəyişə bilərsiniz.',
            'Hesab və məlumat silinməsi üçün hesab bölməsindəki seçimlərdən və ya məxfilik əlaqəsindən istifadə edin.',
          ],
        },
        {
          title: 'Uşaqlar, təhlükəsizlik və dəyişikliklər',
          body: [
            'Vestra uşaqlar üçün nəzərdə tutulmayıb. Təhlükəsizlik tədbirləri tətbiq edilir, lakin heç bir sistem mütləq təhlükəsiz deyil.',
            'Siyasət dəyişdikdə versiya yenilənəcək və lazım olduqda yenidən razılıq istənəcək.',
          ],
        },
      ],
    },
    en: {
      title: 'Privacy Policy',
      eyebrow: 'Vestra privacy',
      intro:
        'This policy explains how Vestra processes information for the AI wardrobe, personal stylist, outfits, and planner features.',
      effectiveDate: 'Effective date: August 12, 2026',
      contactLabel: 'Privacy contact',
      contactFallback: contact,
      cookieDecision:
        'For the initial release, the cookie policy is included in this Privacy Policy.',
      sections: [
        {
          title: 'Service description',
          body: [
            'Vestra is a digital wardrobe product that helps users upload clothes they already own, analyze them with AI, generate outfits, and plan what to wear.',
          ],
        },
        {
          title: 'Information you provide',
          body: [
            'When you create an account, Vestra processes account information such as name, email, and password credentials. Passwords are stored securely.',
            'Wardrobe photos, item names, categories, colors, materials, brands, seasons, styles, and notes are used to provide wardrobe and styling features.',
          ],
        },
        {
          title: 'AI processing',
          body: [
            'Images and wardrobe metadata may be sent to configured service providers for clothing analysis, background removal, and AI stylist features.',
            'AI results are stored separately from user corrections so user edits remain the source of truth where applicable.',
          ],
        },
        {
          title: 'Technical and security information',
          body: [
            'Sessions, IP address, user agent, audit events, and security events may be processed for sign-in, abuse prevention, and account protection.',
          ],
        },
        {
          title: 'Cookies and analytics',
          body: [
            'Necessary cookies support sign-in, security, language, and account features. They continue to work even if Analytics is rejected.',
            'Analytics cookies are enabled only after consent. Vestra loads GA4 and Clarity only after you allow Analytics.',
            'Vercel Analytics is treated as non-essential analytics and only loads after Analytics consent.',
          ],
        },
        {
          title: 'Storage and service providers',
          body: [
            'Data may be stored and processed through infrastructure such as PostgreSQL/Neon, Vercel, and Cloudflare R2. Images remain private and are served through ownership checks.',
            'Information is processed to operate the service, protect accounts, provide support, improve the product, and meet legal obligations.',
          ],
        },
        {
          title: 'Your choices and rights',
          body: [
            'You can change Analytics consent at any time through Cookie preferences.',
            'Use account controls or the privacy contact for account and data deletion requests.',
          ],
        },
        {
          title: 'Children, security, and changes',
          body: [
            'Vestra is not intended for children. Security measures are used, but no system is perfectly secure.',
            'When this policy changes, the policy version will be updated and Vestra may request renewed consent.',
          ],
        },
      ],
    },
    ru: {
      title: 'Политика конфиденциальности',
      eyebrow: 'Приватность Vestra',
      intro:
        'Эта политика объясняет, как Vestra обрабатывает информацию для AI-гардероба, персонального стилиста, образов и планировщика.',
      effectiveDate: 'Дата вступления в силу: 12 августа 2026',
      contactLabel: 'Контакт по вопросам приватности',
      contactFallback: contact,
      cookieDecision:
        'Для первого релиза политика cookies включена в эту Политику конфиденциальности.',
      sections: [
        {
          title: 'Описание сервиса',
          body: [
            'Vestra помогает пользователям загружать одежду, которой они уже владеют, анализировать ее с помощью AI, создавать образы и планировать, что надеть.',
          ],
        },
        {
          title: 'Информация, которую вы предоставляете',
          body: [
            'При создании аккаунта Vestra обрабатывает имя, email и учетные данные пароля. Пароли хранятся безопасно.',
            'Фотографии гардероба, названия вещей, категории, цвета, материалы, бренды, сезоны, стили и заметки используются для функций гардероба и стилиста.',
          ],
        },
        {
          title: 'AI-обработка',
          body: [
            'Изображения и метаданные гардероба могут передаваться настроенным провайдерам для анализа одежды, удаления фона и функций AI-стилиста.',
            'AI-результаты хранятся отдельно от пользовательских исправлений, чтобы правки пользователя имели приоритет.',
          ],
        },
        {
          title: 'Техническая информация и безопасность',
          body: [
            'Сессии, IP-адрес, user agent, audit-события и события безопасности могут обрабатываться для входа, предотвращения злоупотреблений и защиты аккаунта.',
          ],
        },
        {
          title: 'Cookies и аналитика',
          body: [
            'Необходимые cookies поддерживают вход, безопасность, язык и функции аккаунта. Они продолжают работать, даже если аналитика отклонена.',
            'Аналитические cookies включаются только после согласия. Vestra загружает GA4 и Clarity только после разрешения аналитики.',
            'Vercel Analytics считается необязательной аналитикой и загружается только после согласия на аналитику.',
          ],
        },
        {
          title: 'Хранение и поставщики услуг',
          body: [
            'Данные могут храниться и обрабатываться через PostgreSQL/Neon, Vercel и Cloudflare R2. Изображения остаются приватными и выдаются через проверку владельца.',
            'Информация обрабатывается для работы сервиса, защиты аккаунтов, поддержки, улучшения продукта и выполнения юридических обязанностей.',
          ],
        },
        {
          title: 'Ваш выбор и права',
          body: [
            'Вы можете изменить согласие на аналитику в любое время через настройки cookies.',
            'Используйте настройки аккаунта или контакт по приватности для запросов на удаление аккаунта и данных.',
          ],
        },
        {
          title: 'Дети, безопасность и изменения',
          body: [
            'Vestra не предназначена для детей. Мы применяем меры безопасности, но ни одна система не является абсолютно безопасной.',
            'При изменении политики версия будет обновлена, и Vestra может запросить новое согласие.',
          ],
        },
      ],
    },
  }

  return policies[locale]
}
