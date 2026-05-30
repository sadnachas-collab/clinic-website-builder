## План: подключить «Отзывы» к таблице `reviews`

### Маппинг полей (UI ↔ БД)

| UI               | БД (`reviews`)        | Примечание |
|------------------|------------------------|------------|
| `id`             | `id` (UUID)            | для новых — временный `tmpId` (строка/число), флаг `isNew` |
| `name`           | `author_name`          | обязательное |
| `text`           | `text`                 | обязательное |
| `service`        | `text` (префикс `[service] ...`) | в БД нет отдельного поля; храним так же, как `badge` в акциях (split/join при чтении/записи) |
| `date` (строка типа «21 апреля») | `review_date` (DATE) | в админке заменим на `<input type="date">`; при отображении на сайте форматируем по-русски |
| —                | `rating`               | пока не редактируем, по умолчанию `5` при insert |
| —                | `published`            | по умолчанию `true` |
| —                | `sort_order`           | `0` для новых |

### Изменения в `public/clinic-admin.html`

1. **`loadReviews()`** — новая async-функция, `sb.from('reviews').select('*').order('sort_order').order('created_at', { ascending: false })`. Маппинг БД → UI: распарсить `text` на `service` (если начинается с `[...]`) и сам текст. Обновляет `window.dbMainPage.reviews`, вызывает `renderReviews()` + `updateDashboardStats()`.

2. **`overrideReviews()`** — апсерт `page_content` с ключом `reviews_cache` (по аналогии с promos), `persistData`.

3. **Bridge-блок (≈строка 1770–1775)** — добавить `overrideReviews()` и `await loadReviews()` рядом с promos.

4. **`addReview`** — оставить как есть (временный id, `isNew: true`), без записи в БД до «Сохранить».

5. **`saveReview(id)`** — определить, UUID или временный:
   - новый → `sb.from('reviews').insert({ author_name, text: '[service] ...'.trim(), review_date, rating: 5, published: true, sort_order: 0 }).select().single()`, заменить `id` в массиве на UUID;
   - существующий → `sb.from('reviews').update({...}).eq('id', id)`.
   После — `overrideReviews()` (без полного релоада), `renderReviews()`.

6. **`deleteReview(id)`** — для UUID `sb.from('reviews').delete().eq('id', id)`, для временного — просто из массива. Затем `overrideReviews()`.

7. **Форма редактирования отзыва (внутри `renderReviews`)** — поле «Дата» заменить с `<input type="text">` на `<input type="date" id="rev-date-${id}">`; добавить чтение значения в `saveReview`. На карточке («view-mode») показывать дату в формате «21 апреля» (через `Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })`).

8. **`String(id)`** в `onclick` и `id` атрибутах — для совместимости UUID и временных id.

### Проверка

1. Открыть админ → «Главная» → «Отзывы»: список грузится из БД.
2. Добавить отзыв → Сохранить → перезагрузить страницу → отзыв остался (из БД, не из localStorage).
3. Редактирование, удаление, дата — корректно сохраняются/отображаются.

### Файл

- `public/clinic-admin.html`
