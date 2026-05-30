## Что не так (диагноз)

### 1. Загрузка прайса → белый экран → выкидывает из админки
В `handleFileUpload` PDF читается через `FileReader` в base64 и кладётся **в localStorage** (`dbPriceFile.dataUrl`). PDF на 2–4 МБ в base64 = ~3–5 МБ строки → переполняет квоту localStorage браузера. Побочный эффект: Supabase Auth тоже хранит свою сессию в localStorage; когда квота лопается, `sb-...-auth-token` чистится / не пишется → следующий `onAuthStateChange` сообщает `SIGNED_OUT` → `admin.tsx` редиректит на `/`. «Белый экран» в новой вкладке — это `window.open()` с гигантским data-URI в iframe, который браузер не вытягивает.

### 2. «Добавить услугу» — ничего не происходит / 3. После сохранения не возвращается панель edit/delete
В шаблоне `renderTable()` все onclick'и вставляют id **без кавычек**:
```html
<button onclick="editRow(${srv.id})">     <!-- было OK для числовых id из localStorage -->
<button onclick="saveRow(${srv.id})">
<button onclick="deleteRow(${srv.id})">
<button onclick="cancelEditRow(${srv.id})">
```
Теперь `srv.id` — это UUID (`a1b2-c3d4-...`) для существующих и `new_1748...` для новых. Подстановка даёт `editRow(a1b2-c3d4-...)` — браузер парсит как выражение и кидает `ReferenceError`, обработчик молча падает.  
Поэтому: «Добавить» рисует строку, но `editRow(new_xxx)` тут же падает → визуально «ничего не произошло»; «Сохранить» у существующей услуги может сработать через path с числовым id (если найдётся), но `saveRow` тоже использует UUID → падение → toast «Услуга сохранена» не появляется и view-mode не возвращается; даже когда update в БД прошёл, последующий `renderTable()` снова делает строку с битыми onclick'ами — кнопки edit/delete не реагируют.

То же касается шаблона price-file и всех остальных секций, где id теперь UUID, но это починим точечно при миграции каждого раздела.

## Что делаем (только в этом батче)

### A. Прайс-лист → Supabase Storage + таблица `price_files`
Файл `public/clinic-admin.html`:
- В `handleFileUpload` заменить FileReader→localStorage на:
  1. валидация размера (оставить ≤ 4 МБ, разрешить PDF / xls / xlsx / doc / docx / jpg / png),
  2. `sb.storage.from('documents').upload('price/<timestamp>-<safeName>', file, { upsert: true, contentType: f.type })`,
  3. `sb.storage.from('documents').getPublicUrl(...)` → получить публичный URL,
  4. `sb.from('price_files').delete().neq('id', ...)` — чистим прежние записи (модель «один актуальный прайс»), потом `insert({ title: 'Прайс-лист', file_url, file_name })`,
  5. обновить state `dbPriceFile = { name, size, exists: true, url, mime }`,
  6. `renderPriceFile()` + toast.
- В `viewPriceFile` открывать `window.open(dbPriceFile.url, '_blank')` (публичный URL, без data-URI).
- В `deletePriceFile`: удалить запись из `price_files` и (best-effort) `sb.storage.from('documents').remove([path])`.
- В bootstrap добавить `loadPriceFile()` — `sb.from('price_files').select('id,title,file_url,file_name').order('created_at', { ascending: false }).limit(1)` → заполняет `dbPriceFile`, вызывает `renderPriceFile()`.
- Убрать все обращения к localStorage для `dbPriceFile`.

Это снимает проблему переполнения localStorage и, как следствие, спонтанный логаут.

### B. Чиним onclick'и в таблице услуг (UUID-safe)
Файл `public/clinic-admin.html`, шаблон в `renderTable()`:
- Везде заменить `${srv.id}` в onclick на `'${srv.id}'` (одинарные кавычки внутри двойных HTML-атрибута):
  ```html
  onclick="editRow('${srv.id}')"
  onclick="deleteRow('${srv.id}')"
  onclick="saveRow('${srv.id}')"
  onclick="cancelEditRow('${srv.id}')"
  ```
- В `addService` (override) уже использует tmpId-string — после правки шаблона `editRow('new_123')` будет вызываться корректно.
- Проверить, что `dbServices.find(s => s.id === id)` сравнивает строки — да, после loadServices id это UUID-строка, и tmpId — строка, всё совпадёт.

### C. Возврат view-mode после сохранения существующей услуги
Это автоматически чинится фиксом B: `saveRow` в успехе уже вызывает `window.renderTable()`, который пере-рендерит строку без класса `bg-brand-50/30` и без `hidden` на view-mode. После B onclick'и в новой разметке будут рабочими, и кнопки «Редактировать / Удалить» снова реагируют. Дополнительно убедимся, что toast «Услуга сохранена» появляется (он там уже есть через `notify`).

## Технические детали

- Storage: bucket `documents` уже публичный (см. supabase-configuration).
- RLS таблицы `price_files`: `Admins write` (через `is_admin`) — добавление/удаление пойдёт под сессией админа.
- Storage policies для `documents` уже настроены (используется в других местах). Если upload вернёт 403 — на следующем шаге добавим policy `Admins upload to documents`.
- Никаких изменений схемы БД не требуется.
- `admin.tsx` не трогаем — редирект на `/` был следствием падения localStorage, а не багом маршрутизации.

## Что не делаем в этом батче
- Категории направлений, каталог процедур, врачи, отзывы, акции, FAQ, интерьер, документы, права потребителей, органы власти, контент страниц, заявки, управление админами — следующими шагами. UUID-фикс onclick'ов будет применяться там по аналогии при миграции каждого раздела.

## Проверка
1. `/admin` → логин `admin / 123456`.
2. Раздел «Прайс-лист»: загрузить PDF → toast «Загружено», файл виден; «Просмотр» открывает PDF в новой вкладке; перезагрузить страницу — файл остаётся; админка не выкидывает.
3. «Популярные услуги»:
   - «Добавить» → появляется строка в edit-mode с фокусом, видны Save/Cancel.
   - Сохранить → toast «Услуга сохранена», строка в view-mode, видны «Редактировать»/«Удалить».
   - Редактировать существующую → изменить цену → Сохранить → toast + кнопки edit/delete вернулись.
   - Удалить → confirm → запись пропала.
4. DevTools Network: запросы к `.../storage/v1/object/documents/price/...` (PUT 200), `.../rest/v1/price_files` и `.../rest/v1/services` (200/201/204).