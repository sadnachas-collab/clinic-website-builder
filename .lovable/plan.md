## План: подключить FAQ к базе

Таблица `faq` уже есть в Supabase: `id (uuid)`, `question`, `answer`, `published`, `sort_order`, `created_at`. RLS: public read, admin write — то что нужно. Миграции не требуются.

По образцу уже работающего bridge для отзывов (`loadReviews` / `overrideReviews` / `saveReview` / `deleteReview` в `public/clinic-admin.html`) добавить аналогичный мост для FAQ.

### Изменения в `public/clinic-admin.html`

1. **`loadFaq()`** — `sb.from('faq').select('*').order('sort_order').order('created_at')`, маппинг записей в формат фронта `{ id, q: question, a: answer, published }`, запись в `window.dbMainPage.faq`, вызов `renderFaq()` и `updateDashboardStats()` (если он учитывает faq).

2. **`overrideReviews`-аналог `overrideFaq()`** — обновляет `window.dbMainPage.faq` и пишет в `localStorage` через существующий `persistData` (без записи в БД — БД пишется только из save/delete).

3. **Переопределение CRUD-функций FAQ** (`addFaq`, `saveFaq`, `cancelEditFaq`, `deleteFaq`) в bridge-блоке:
   - `addFaq` — временный `tmpId` (строка), `isNew: true`, в БД не пишет до «Сохранить».
   - `saveFaq(id)` — определяет, UUID или временный id:
     - новый → `sb.from('faq').insert({ question, answer, published: true, sort_order: 0 }).select().single()`, заменить tmpId на полученный uuid;
     - существующий → `sb.from('faq').update({ question, answer }).eq('id', id)`.
     - после успешного запроса — `overrideFaq()` + `renderFaq()`.
   - `deleteFaq(id)` — для UUID `sb.from('faq').delete().eq('id', id)`, для временного — просто splice. Подтверждение через `customConfirm`.

4. **`String(id)`** в `onclick` и `id`-атрибутах внутри `renderFaq` — для совместимости UUID и временных id (как сделано для reviews).

5. **Bootstrap** — добавить `await loadFaq()` в существующий bootstrap-блок рядом с `await loadReviews()` / `await loadReviewLinks()`.

### Фронт (`public/clinic-site.html`)

Не трогаем — сайт уже читает FAQ из своего собственного списка/данных. (Если выяснится, что фронт читает faq только из захардкоженного массива, отдельным шагом можно подключить чтение из БД, но это вне текущей задачи.)

### Проверка

1. Админ → Главная → FAQ → добавить вопрос → перезагрузить → остался.
2. Редактировать существующий вопрос → перезагрузить → изменения сохранились.
3. Удалить вопрос → перезагрузить → удалён.

### Файлы

- `public/clinic-admin.html`
