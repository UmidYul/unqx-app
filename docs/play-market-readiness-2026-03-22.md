# UNQX — готовность к публикации в Google Play (без учёта проблем из прошлого code review)

Дата проверки: 2026-03-22

## Вердикт

**Статус: Nearly ready (условно готово), но есть блокеры перед отправкой в production в Play Console.**

Что уже готово на стороне репозитория:
- Android package и versionCode заданы в `app.json`.
- Разрешения Android задекларированы и выглядят согласованно с функционалом (NFC/QR/уведомления/биометрия).
- Продакшн-профиль EAS для Android настроен под app bundle (`.aab`) и `bundleRelease`.
- Черновики для Play metadata и Data Safety уже подготовлены.
- Юридические документы в репозитории присутствуют (Privacy/Terms/Refund).

## Что проверено

### 1) Android-конфиг и сборка
- `android.package = uz.unqx.app`
- `android.versionCode = 1`
- Разрешения включают NFC, CAMERA, POST_NOTIFICATIONS, INTERNET, VIBRATE, RECEIVE_BOOT_COMPLETED, USE_BIOMETRIC/USE_FINGERPRINT.
- `eas.json` production-профиль использует `buildType: app-bundle` и `gradleCommand: :app:bundleRelease`.

### 2) Play Console контент
- Есть заполненный черновик metadata для Google Play: title, short/full description, категория, контакты, требования к скриншотам/feature graphic.
- Есть заполненный черновик Data Safety по ключевым permission-группам.

### 3) Статус prelaunch-чеклиста
По текущему чеклисту в репозитории остаются незакрытые пункты именно для Google Play:
- вручную выставить аудиторию 18+ в Play Console;
- загрузить Feature Graphic и скриншоты;
- вручную выполнить `eas build --platform android --profile production`;
- вручную выполнить `eas submit --platform android`.

## Блокеры перед публикацией в Play Market

1. **Не заполнены вручную элементы Play Console** (Audience + графические ассеты).
2. **Не подтверждён production-артефакт `.aab` в рамках этой проверки** (сборка/сабмит не запускались здесь).
3. **Техническая проверка TypeScript в текущем окружении не прошла**, потому что отсутствуют необходимые локальные зависимости/база Expo tsconfig в среде выполнения (`expo/tsconfig.base`, `expo-router/types`). Это не обязательно дефект приложения, но в рамках этой сессии не удалось подтвердить пункт «0 TS ошибок».

## Рекомендованный минимальный план до сабмита (Play)

1. В Play Console:
   - заполнить Audience (18+);
   - загрузить min 2 phone screenshots и Feature Graphic 1024x500.
2. Локально/в CI с установленными dependency:
   - `npm ci`
   - `npx tsc --noEmit`
3. Выпустить Android build:
   - `eas build --platform android --profile production`
4. Отправить в трек (internal/closed testing):
   - `eas submit --platform android`
5. Проверить карточку приложения после загрузки (Data Safety, privacy policy URL, категория Business, контакты).

## Итог

Если не учитывать проблемы из предыдущего code review, **репозиторий близок к публикации в Google Play**, но **не полностью готов к немедленному сабмиту** из-за незакрытых ручных шагов в Play Console и непроведённой production-сборки/сабмита в рамках текущей проверки.
