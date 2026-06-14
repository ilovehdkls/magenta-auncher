# Magenta DLC Launcher

Electron-лаунчер для клиента **Magenta DLC**.

## Требования

- Node.js 20+
- Java 17+ (в PATH)
- Собранный JAR: `build\libs\magenta-1.0-SNAPSHOT.jar`

## Быстрый старт (Windows)

**1. Сборка клиента + подготовка лаунчера:**

```bat
mercury-launcher\build-client.bat
```

**2. Запуск лаунчера:**

```bat
mercury-launcher\start.bat
```

## Сборка вручную

```powershell
.\gradlew.bat jar
cd mercury-launcher
npm.cmd run prepare-client
npm.cmd start
```

## Если клиент не запускается

1. В корне проекта должна быть папка `assets`.
2. `npm run prepare-client` — в логе должно быть `Extracted … DLL(s)`.
3. Лог запуска: `%USERPROFILE%\Magenta\launch.log`
4. Текст ошибки — под кнопкой **ЗАПУСТИТЬ**.

## Функции

- Авторизация / регистрация (локально)
- Анимированный интерфей, встроенный `magenta-1.0-SNAPSHOT.jar` с иконкой
- Запуск с natives и рабочей папкой проекта
