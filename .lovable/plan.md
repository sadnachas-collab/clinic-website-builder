## План: кнопка предпросмотра FAQ

По образцу `previewReview` для отзывов добавить `previewFaq` в `public/clinic-admin.html`.

### Изменения в `public/clinic-admin.html`

1. **`renderFaq` (внутри `overrideFaq`)** — в блоке кнопок (рядом с «Настроить» и «Удалить») добавить кнопку «Предпросмотр» (иконка `eye`), показывается только для уже сохранённых вопросов (не для `isNew`):
   ```
   <button onclick="previewFaq('<id>')" title="Предпросмотр" class="text-gray-400 hover:text-brand-600 bg-white p-2 rounded-lg border border-gray-200 shadow-sm"><i data-lucide="eye" class="w-4 h-4"></i></button>
   ```

2. **`previewFaq(id)`** — открывает модалку поверх админки с тем же оформлением, что и FAQ на фронте (`public/clinic-site.html`, строки 806–867):
   - белая карточка `rounded-[2.5rem]`, padding, бордер `#D0C0B1/20`;
   - заголовок `font-serif` цвета `#2A2522`, иконка-кружок `chevron-down` справа в раскрытом состоянии (повёрнута), ответ — серый текст с тем же шрифтом и отступами;
   - содержимое (`q`, `a`) берётся из текущего инпута `#faq-q-<id>` / `#faq-a-<id>`, если строка в режиме редактирования, иначе из `dbMainPage.faq`;
   - кнопка закрытия (`x`) в правом верхнем углу + «Закрыть» снизу;
   - после вставки вызывать `lucide.createIcons()`.

3. Экспорт `window.previewFaq = previewFaq` (внутри `overrideFaq`).

### Файлы

- `public/clinic-admin.html`
