import type { Locale } from '@/lib/i18n/config'

export type LandingCopy = {
  showcase: {
    label: string
    scanning: string
    tags: string[]
    itemName: string
  }
  steps: {
    eyebrow: string
    title: string
    items: { title: string; body: string }[]
  }
  outfit: {
    eyebrow: string
    title: string
    body: string
    note: string
    noteAuthor: string
    occasion: string
  }
  cta: {
    title: string
    body: string
  }
}

export const landingCopy: Record<Locale, LandingCopy> = {
  az: {
    showcase: {
      label: 'Yeni əşya',
      scanning: 'AI təhlil edir…',
      tags: ['Palto', 'Kemel', 'Yun', 'Payız', 'Klassik'],
      itemName: 'Kemel rəngli yun palto',
    },
    steps: {
      eyebrow: 'Necə işləyir',
      title: 'Şəkildən kombinə qədər üç addım',
      items: [
        {
          title: 'Şəkil çəkin',
          body: 'Geyimin şəklini yükləyin. Fon və artıq detallar avtomatik təmizlənir.',
        },
        {
          title: 'AI tanıyır',
          body: 'Növ, rəng, material, mövsüm və üslub saniyələr içində kartaya yazılır.',
        },
        {
          title: 'Kombin qurun',
          body: 'Stilist yalnız sizin geyimlərinizdən obraz yığır və seçimi izah edir.',
        },
      ],
    },
    outfit: {
      eyebrow: 'Günün obrazı',
      title: 'Artıq sahib olduğunuz geyimlərdən',
      body: 'Yeni alış-veriş yox — mövcud qarderobunuzdan daha çox istifadə. Vestra hava, mövsüm və planlarınızı nəzərə alır.',
      note: 'Kemel palto tünd cinsi və kobud botları yumşaldır: isti, sakit rəng palitrası, payız üçün idealdır.',
      noteAuthor: 'Vestra stilist',
      occasion: 'Payız · şəhər gəzintisi',
    },
    cta: {
      title: 'Qarderobunuz sizi gözləyir',
      body: 'Bir neçə əşya ilə başlayın — qalanını Vestra özü öyrənəcək.',
    },
  },
  en: {
    showcase: {
      label: 'New item',
      scanning: 'AI is analysing…',
      tags: ['Coat', 'Camel', 'Wool', 'Autumn', 'Classic'],
      itemName: 'Camel wool coat',
    },
    steps: {
      eyebrow: 'How it works',
      title: 'From a photo to an outfit in three steps',
      items: [
        {
          title: 'Snap a photo',
          body: 'Upload a picture of any piece. The background and clutter are cleaned up for you.',
        },
        {
          title: 'AI recognises it',
          body: 'Type, colour, material, season and style land on a tidy card in seconds.',
        },
        {
          title: 'Build outfits',
          body: 'Your stylist combines only what you own — and explains why it works.',
        },
      ],
    },
    outfit: {
      eyebrow: 'Outfit of the day',
      title: 'Made from what you already own',
      body: 'No new shopping — just more out of the wardrobe you have. Vestra takes weather, season and plans into account.',
      note: 'The camel coat softens dark denim and rugged boots: a warm, calm palette made for autumn.',
      noteAuthor: 'Vestra stylist',
      occasion: 'Autumn · city walk',
    },
    cta: {
      title: 'Your wardrobe is waiting',
      body: 'Start with a few pieces — Vestra learns the rest.',
    },
  },
  ru: {
    showcase: {
      label: 'Новая вещь',
      scanning: 'AI анализирует…',
      tags: ['Пальто', 'Кэмел', 'Шерсть', 'Осень', 'Классика'],
      itemName: 'Шерстяное пальто цвета кэмел',
    },
    steps: {
      eyebrow: 'Как это работает',
      title: 'От фото до образа за три шага',
      items: [
        {
          title: 'Сфотографируйте',
          body: 'Загрузите фото вещи. Фон и лишние детали уберутся автоматически.',
        },
        {
          title: 'AI распознаёт',
          body: 'Тип, цвет, материал, сезон и стиль за секунды попадают в аккуратную карточку.',
        },
        {
          title: 'Соберите образ',
          body: 'Стилист собирает образы только из ваших вещей и объясняет, почему это работает.',
        },
      ],
    },
    outfit: {
      eyebrow: 'Образ дня',
      title: 'Из того, что у вас уже есть',
      body: 'Никаких новых покупок — просто больше пользы от вашего гардероба. Vestra учитывает погоду, сезон и ваши планы.',
      note: 'Пальто цвета кэмел смягчает тёмный деним и грубые ботинки: тёплая спокойная палитра — идеально для осени.',
      noteAuthor: 'Стилист Vestra',
      occasion: 'Осень · прогулка по городу',
    },
    cta: {
      title: 'Ваш гардероб ждёт',
      body: 'Начните с нескольких вещей — остальному Vestra научится сама.',
    },
  },
}
