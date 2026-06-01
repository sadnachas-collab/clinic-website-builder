## План: загрузка документов клиники с компьютера

Заменяем `prompt(URL)` в разделе «О клинике → Документы клиники» на загрузку файла → бакет `photos` → запись публичной ссылки в `clinic_documents.file_url`. Тот же паттерн, что и для интерьера.

Бакет `photos` публичный, RLS на `clinic_documents` уже позволяет админам писать. Миграции не нужны.

### Изменения в `public/clinic-admin.html`

1. **Разметка «Документы клиники»** (~строка 1081): кнопку `onclick="addDocImg()"` заменить на `<label for="doc-file-input">` с теми же стилями + скрытый `<input type="file" id="doc-file-input" accept="image/*,application/pdf" onchange="if(this.files[0]) handleDocUpload(this.files[0]); this.value='';">`.

2. **`handleDocUpload(file)`**:
   - Валидация: тип `image/*` или `application/pdf`, размер ≤ 10 MB.
   - Toast «Загрузка…».
   - Путь: `clinic-docs/<Date.now()>-<rand>.<ext>`.
   - `sb.storage.from('photos').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })`.
   - `getPublicUrl(path)` → ссылка.
   - `sb.from('clinic_documents').insert({ title: file.name, file_url: publicUrl, sort_order: 0 }).select('id,title,file_url,sort_order').single()` → push в `dbMainPage.docs` как `{ id, img: file_url, title }`, `renderDocs()`, `notify('Добавлено')`.
   - При ошибке БД после успешного upload — `storage.remove([path])` (best-effort).

3. **`addDocImg`** оставляем для обратной совместимости — теперь просто кликает по скрытому инпуту.

4. Экспорт `window.handleDocUpload`.

### Не трогаем

- `clinic-site.html`.
- Удаление файла в Storage при `deleteDoc` — отдельным шагом.
- Специалисты, промо, категории процедур, уголок потребителя — следующими шагами тем же паттерном.

### Проверка

1. Админ → О клинике → Документы клиники → выбрать `.jpg` или `.pdf` → toast «Добавлено», карточка в сетке.
2. Перезагрузка → документ остался.
3. Файл лежит в `photos/clinic-docs/`.
4. Файл >10 MB или чужой тип → toast с ошибкой.

### Файлы

- `public/clinic-admin.html`
