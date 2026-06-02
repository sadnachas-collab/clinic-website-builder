## План: перенос «Категорий процедур» и «Карточек процедур» в Lovable Cloud

Подключаем разделы каталога к Supabase + загрузка картинок с компьютера в бакет `photos`. Тот же паттерн override-обёртки, что у интерьера / документов / специалистов / промо. Все изменения — только в `public/clinic-admin.html`.

Таблицы готовы:
- `procedure_categories(id uuid, name, description, image_url, sort_order)`
- `procedures(id uuid, category_id uuid, name, description, price, image_url, sort_order, content jsonb)`

`content` храним как `{ howItWorks:[], problems:[], prices:[], pricesChief:[] }` — там лежат шаги/проблемы/цены, которых нет колонками.

Маппинг фронт ↔ БД:
- категория: `{ id, title, desc, img, sort_order }` ↔ `{ id, name, description, image_url, sort_order }`
- процедура: `{ id, categoryId, title, priceText, desc, img, howItWorks, problems, prices, pricesChief }` ↔ `{ id, category_id, name, price, description, image_url, content }`

### Изменения

1. **`loadCatCategories()`** — `sb.from('procedure_categories').select('id,name,description,image_url,sort_order').order('sort_order')` → маппинг в `dbCatCategories` (id остаётся uuid-строкой).

2. **`loadCatProcedures()`** — `sb.from('procedures').select('id,category_id,name,description,price,image_url,sort_order,content').order('sort_order')` → маппинг в `dbCatProcedures` (раскладываем `content` обратно в `howItWorks`/`problems`/`prices`/`pricesChief`).

3. **`overrideCatCategories()`**:
   - переопределяет `window.renderCatCategories`: в режиме edit-mode рядом с полем URL картинки добавляет скрытый `<input type="file" id="cat-file-${id}" accept="image/jpeg,image/png,image/webp">` и кнопку «Загрузить с компьютера» (как у специалистов);
   - `window.uploadCatPhoto(id, file)` — валидация (image/*, ≤10 MB), путь `categories/<ts>-<rand>.<ext>`, `sb.storage.from('photos').upload(...)`, `getPublicUrl`, подставляет в `cat-img-${id}.value` и обновляет превью;
   - `window.saveCat(id)` — пишет в Supabase: `sb.from('procedure_categories').update({ name, description, image_url, sort_order }).eq('id', id)`, апдейтит локальный массив, `renderCatCategories()`, toast;
   - `window.addCat()` — `insert` пустой категории, push в `dbCatCategories`, `renderCatCategories()` сразу в режиме edit;
   - `window.deleteCat(id)` — confirm → `sb.from('procedure_categories').delete().eq('id', id)`, убрать из массива, обновить select `pe-category`, `renderCatCategories()`.

4. **`overrideCatProcedures()`**:
   - переопределяет `window.renderCatProcedures` (та же таблица, нужен только `lucide.createIcons()` в конце);
   - переопределяет `window.openProcEditorModal(procId)`: перед открытием перерисовывает `<select id="pe-category">` из `dbCatCategories` (option value = uuid категории), для новой процедуры `categoryId` = первая категория;
   - добавляет в модалке редактора рядом с полем `pe-img` кнопку «Загрузить с компьютера» + скрытый `<input type="file" id="pe-file">` (правка разметки модалки, ~рядом с `pe-img`);
   - `window.uploadProcPhoto(file)` — валидация, путь `procedures/<ts>-<rand>.<ext>`, upload в `photos`, подставляет ссылку в `pe-img.value`, обновляет превью;
   - `window.saveProcEditorModal()` — собирает `content = { howItWorks, problems, prices, pricesChief }` и пишет: при новой — `insert`, при существующей — `update`, по `id`. Поля: `name=title`, `price=priceText`, `description=desc`, `image_url=img`, `category_id=categoryId`, `content`. После успеха — синхронизирует `dbCatProcedures` (по id), `renderCatProcedures()`, `closeProcEditorModal()`, toast;
   - `window.deleteCatProcedure(id)` — confirm → `sb.from('procedures').delete().eq('id', id)`, убрать из массива, `renderCatProcedures()`.

5. **Bootstrap** (где уже идут `overrideSpecialists()` / `await loadSpecialists()` и т.п.) — добавить:
   ```
   overrideCatCategories(); overrideCatProcedures();
   await loadCatCategories();
   await loadCatProcedures();
   ```
   `loadCatCategories` обязательно ДО `loadCatProcedures`, чтобы названия категорий уже были в `dbCatCategories` для рендера таблицы и select-а.

6. **Не трогаем**: `clinic-site.html`; удаление картинки в Storage при удалении категории/процедуры — отдельным шагом; промо/интерьер/документы/специалистов — они уже мигрированы.

### Проверка

1. Админ → Каталог услуг → «Категории» → редактировать категорию → «Загрузить с компьютера» → выбрать JPG → ссылка появилась → «Сохранить» → toast, перезагрузка — изменения остались, файл в `photos/categories/`.
2. Добавить новую категорию → видна в списке и в выпадающем списке в редакторе процедуры.
3. Каталог услуг → «Процедуры» → «Настроить» / «Новая» → выбрать категорию из списка, заполнить шаги/проблемы/цены, загрузить картинку с компьютера → «Сохранить» → запись/обновление в `procedures`, картинка в `photos/procedures/`.
4. Перезагрузка админки → процедуры и категории на месте, картинки отображаются.
5. Удаление категории и процедуры реально удаляет из БД.
6. Файл > 10 MB или не картинка → toast с ошибкой.

### Файлы

- `public/clinic-admin.html`
