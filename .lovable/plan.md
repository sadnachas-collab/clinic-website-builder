## План: загрузка фото интерьера с компьютера

Заменяем `prompt(URL)` на загрузку файла → Lovable Cloud Storage (бакет `photos`) → запись публичной ссылки в `interior_photos.image_url`.

Бакет `photos` уже публичный, RLS позволяет админам `INSERT/SELECT/UPDATE/DELETE`. Миграции не нужны.

### Изменения в `public/clinic-admin.html`

1. **Разметка раздела «Интерьер»** (~строка 327): кнопку `onclick="addInteriorImg()"` заменить на `<label for="interior-file-input">` с теми же стилями + скрытый `<input type="file" id="interior-file-input" accept="image/*" onchange="handleInteriorUpload(this.files[0]); this.value='';">`.

2. **`handleInteriorUpload(file)`** (внутри `overrideInterior`):
   - Валидация: `file.type` начинается с `image/`; размер ≤ 10 MB.
   - Toast «Загрузка…».
   - Путь: `interior/<Date.now()>-<rand>.<ext>`.
   - `sb.storage.from('photos').upload(path, file, { cacheControl: '3600', upsert: false })`.
   - `getPublicUrl(path)` → ссылка.
   - `sb.from('interior_photos').insert({ image_url, sort_order: 0 }).select().single()` → push в `dbMainPage.interior`, `renderInterior()`, `notify('Добавлено')`.
   - Если БД упала после успешного upload — `storage.remove([path])` (best-effort).

3. **`addInteriorImg`** оставляем для обратной совместимости — теперь просто кликает по скрытому инпуту.

4. Экспорт `window.handleInteriorUpload`.

### Не трогаем

- Фронт `clinic-site.html`.
- Удаление файла в Storage при `deleteInterior` — потом отдельным шагом.
- Другие разделы (документы клиники, аватары, уголок потребителя) — этот же паттерн, но переделаем отдельными шагами.

### Проверка

1. Админ → Главная → Интерьер → выбрать `.jpg` → toast «Добавлено», фото в сетке.
2. Перезагрузить страницу → фото осталось.
3. Файл лежит в бакете `photos/interior/`.
4. Файл >10 MB → toast с ошибкой.

### Файлы

- `public/clinic-admin.html`
