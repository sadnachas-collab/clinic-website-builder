## Подключение раздела «Акции» к БД

Сейчас акции хранятся в `dbMainPage.promos` (localStorage). Подключаем к таблице `promos` в Lovable Cloud по образцу врачей.

### Что меняется в `public/clinic-admin.html`

1. **`loadPromos()`** — новая функция:
   - `sb.from('promos').select('*').order('sort_order').order('created_at', { ascending: false })`
   - Маппинг БД → UI-модель: `{ id (UUID), title, badge: description?, desc: description, img: image_url }`.
   - Поскольку в таблице нет отдельного поля `badge`, храним «бирку» в начале `description` в формате `[badge] desc` (split/join при чтении/записи). Так не трогаем схему БД.
   - Обновляет `window.dbMainPage.promos` и перерисовывает: `renderPromos()` + `updateDashboardStats()`.

2. **`addPromo`** — временный `tmpId` (строка), флаг `isNew`. Без записи в БД до «Сохранить».

3. **`savePromo(id)`** — определяет, UUID или временный:
   - новый → `sb.from('promos').insert({ title, description: joinBadgeDesc(badge,desc), image_url, sort_order: 0, published: true }).select().single()` → подменяем id в массиве.
   - существующий → `sb.from('promos').update({...}).eq('id', id)`.

4. **`deletePromo(id)`** — `sb.from('promos').delete().eq('id', id)` для UUID; для временного — просто из массива.

5. **Загрузка фото**: рядом с полем «URL Обложки» — кнопка «Загрузить фото» по образцу врачей. Bucket `photos`, путь `promos/<timestamp>-<safeName>`, лимит 10 МБ, jpg/png/webp, `upsert: true`. После загрузки — public URL в `#promo-img-<id>`.

6. **Bridge**: добавить `overridePromos()` в bridge-блок и вызывать его после `loadMainTexts()` (или параллельно с `loadServices/loadSpecialists`).

7. **Идентификаторы**: все `onclick` и `id` оборачиваем через `String(id)` для совместимости UUID/временных id (как сделано для врачей).

### Проверка

- Открыть «Главная → Акции»: список грузится из БД.
- Добавить акцию, загрузить фото, сохранить → запись появляется в `promos`, фото в `photos/promos/...`.
- Редактировать заголовок/описание/бирку → обновляется в БД.
- Удалить → исчезает из БД.
- Перезагрузка страницы → данные сохраняются (не из localStorage, а из БД).

### Затронутые файлы
- `public/clinic-admin.html`

Реализую после подтверждения.