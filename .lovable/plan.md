## Подключаем раздел «Подвал» к Lovable Cloud

Все 16 полей подвала — это одна цельная запись (реквизиты, копирайт, 152-ФЗ, тексты Политики / Соглашения / Согласия). Идеально ложится в существующую таблицу `page_content` как одна строка с `key='footer'` и `value` JSONB. Та же схема, что уже работает для текстов главной (`key='main_texts'`). Отдельная таблица не нужна — это убережёт от лишних миграций и упростит загрузку.

### Что делаем в БД
- Один INSERT в `page_content`: `key='footer'`, `value` — JSON со всеми полями (`shortDesc, companyName, ogrn, license, copyright, warning, rknNotice, dpoName, dpoEmail, legalAddress, licenseIssuer, policyText, termsText, consentText`). Дефолты возьмём из `defaultFooter` в `clinic-admin.html`, чтобы при первой загрузке сразу подтянулись осмысленные значения. RLS уже настроена (public read, admin write).

### Что меняем в `public/clinic-admin.html`
- В блок инициализации (рядом с `loadConsumerData()` / `loadAuthorities()`) добавляем `await loadFooterFromCloud()`, затем `renderFooterData()`.
- `loadFooterFromCloud()` — `sb.from('page_content').select('value').eq('key','footer').maybeSingle()`. Если строки нет — `upsert` с дефолтами. Полученный объект мерджим в `dbFooter`, чтобы все 16 ключей точно были определены (нулевые/новые поля не ломали UI).
- Перекрываем `saveFooterData` (через тот же приём `overrideXxx`, что уже используется в файле для consumer/authorities):
  1. Собираем значения из всех 16 инпутов в `dbFooter` (логика как сейчас).
  2. `await sb.from('page_content').upsert({ key:'footer', value: dbFooter }, { onConflict: 'key' })`.
  3. Тост «Подвал сохранён» при успехе, тост с ошибкой при провале (оставляем форму как есть, ничего не теряем).
- `persistData()` для подвала больше не нужен как источник правды, но строку `localStorage.setItem('dbFooter', ...)` оставляем как есть — это просто кеш на случай оффлайна, никому не мешает.

### Что НЕ трогаем
- Сайт `public/clinic-site.html` (фронт подвала рендерится отдельно, его подключение к Cloud — не в этой задаче, если потребуется — сделаем следующим шагом).
- Остальные разделы админки, существующие таблицы, бакеты Storage, миграции.
- Структуру UI раздела «Подвал» — кнопки «Сохранить», поля и тексты остаются один в один.

### Технические детали
- Используем существующий клиент `sb` (анон-ключ + bearer токен из родительского окна), как и в других подключённых разделах.
- `value` в `page_content` — JSONB, поэтому объект `dbFooter` пишется и читается напрямую без сериализации.
- `upsert` по `key` — у `page_content.key` PK, конфликтов не будет.
