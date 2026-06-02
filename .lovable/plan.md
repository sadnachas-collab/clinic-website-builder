## Проблема

В админке «Философия — врач и видео-визитка» видео загружено и сохранено в БД (`page_content.home_about_doctor.video` = ссылка на mp4 в storage). Поле `photo` при этом пустое.

На фронте (`public/clinic-site.html`, строка 533) в блоке стоит **захардкоженный плейсхолдер** — фото с Unsplash:
```html
<img id="about-doctor-photo" src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2…">
```

Функция `renderAboutDoctor` (`public/clinic-site-data.js`, строки 360–384) подменяет `src` только если `v.photo` непустое. Поскольку фото не задано, остаётся unsplash-картинка. Видео при этом «есть» — кнопка play появляется, по клику открывается оверлей с видео — но визуально пользователь видит чужое фото и считает, что её видео не подгрузилось.

## Что меняем (минимально)

Только фронт-рендер блока. БД, админка, загрузка файлов — не трогаем.

### 1. `public/clinic-site.html` (строка 533)

Убрать unsplash из `src`, оставить нейтральный transparent-плейсхолдер, чтобы при отсутствии и фото и видео не светилось чужое лицо:
```html
<img id="about-doctor-photo" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 5'/>" alt="Врач" class="…">
```
(класс/alt сохраняем)

### 2. `public/clinic-site-data.js` — `renderAboutDoctor` (строки 360–384)

Расширить логику: если есть `v.video` и нет `v.photo`, заменить `<img id="about-doctor-photo">` на `<video>` с первым кадром видео в качестве постера:
- создаём `<video src="VIDEO_URL#t=0.5" muted playsinline preload="metadata" id="about-doctor-photo" class="(те же классы)">`
- заменяем существующий узел через `parentNode.replaceChild`
- сохраняем ту же `id`, чтобы повторные `renderAboutDoctor` находили узел и могли переписать src

Поведение play-кнопки и `openAboutDoctorVideo()` оставляем без изменений — клик по обёртке `#about-doctor-photo-wrap` по-прежнему открывает полноэкранный плеер.

Приоритет: если задано `v.photo` — показываем `<img>` с фото (как сейчас). Если фото пустое, но есть видео — превью видео. Если ничего нет — прозрачный плейсхолдер.

## Что не трогаем

- `public/clinic-admin.html` — загрузка/удаление видео работает корректно.
- Storage и БД — данные уже сохранены.
- Логика `openAboutDoctorVideo` (overlay-плеер) — без изменений.
