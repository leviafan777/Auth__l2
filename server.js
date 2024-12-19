const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const port = 3000;

// Путь к файлу базы данных
const dbPath = path.join(__dirname, 'db.json');

// Настройка сессий
app.use(session({
    secret: 'secret-key', // Секретный ключ для шифрования сессий
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Используем false, чтобы работало на HTTP
}));

// Мидлвары для обработки данных формы
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Обслуживание статических файлов
app.use(express.static(path.join(__dirname, 'public')));

// Функция для чтения базы данных
const readDatabase = () => {
    return new Promise((resolve, reject) => {
        fs.readFile(dbPath, 'utf8', (err, data) => {
            if (err) return reject(err);
            let db = { Users: [] }; // Пустая база, если файла еще нет
            try {
                db = JSON.parse(data);
            } catch (e) {
                console.error('Ошибка при разборе базы данных:', e);
            }
            resolve(db);
        });
    });
};

// Функция для записи в базу данных
const writeDatabase = (db) => {
    return new Promise((resolve, reject) => {
        fs.writeFile(dbPath, JSON.stringify(db, null, 2), (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
};

// Обработчик GET для страницы регистрации
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'registration.html'));
});

// Обработчик GET для страницы входа
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'entry.html'));
});

// Обработчик GET для профиля
app.get('/profile', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login'); // Если пользователь не залогинен, редирект на /login
    }

    const user = req.session.user;  // Используем данные пользователя из сессии
    const profilePage = `
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Профиль пользователя</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background-color: #f4f4f4;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                }

                .profile-container {
                    background-color: #fff;
                    padding: 20px;
                    border-radius: 10px;
                    box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
                    width: 100%;
                    max-width: 400px;
                }

                h2 {
                    color: #333;
                    text-align: center;
                }

                p {
                    color: #555;
                    font-size: 16px;
                    margin: 10px 0;
                }

                strong {
                    color: #222;
                }

                button {
                    width: 100%;
                    padding: 10px;
                    margin-top: 20px;
                    background-color: #4CAF50;
                    color: white;
                    font-size: 16px;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    transition: background-color 0.3s;
                }

                button:hover {
                    background-color: #45a049;
                }

                button:active {
                    background-color: #388e3c;
                }
            </style>
        </head>

        <body>
            <div class="profile-container">
                <h2>Добро пожаловать, ${user.username}!</h2>
                <p><strong>Электронная почта:</strong> ${user.email}</p>
                <p><strong>Дата регистрации:</strong> ${user.registrationDate}</p>
                <button type="button" onclick="window.location.href='/logout'">Выйти из аккаунта</button>
            </div>
        </body>
        </html>
    `;
    res.send(profilePage);
});

// Обработчик POST для входа
app.post('/entry', async (req, res) => {
    const { username, password } = req.body;

    try {
        const db = await readDatabase();
        const user = db.Users.find(u => u.email === username); // Поиск по email
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = user;
            res.redirect('/profile'); // Редирект на страницу профиля
        } else {
            res.status(401).send('Неверный email или пароль');
        }
    } catch (err) {
        console.error('Ошибка при работе с базой данных:', err);
        res.status(500).send('Ошибка при работе с базой данных');
    }
});

// Обработчик POST для регистрации
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
        username,
        email,
        password: hashedPassword,
        registrationDate: new Date().toISOString()
    };

    try {
        const db = await readDatabase();

        // Проверяем, существует ли уже такой email
        if (db.Users.some(u => u.email === email)) {
            return res.status(400).send('Пользователь с таким email уже существует');
        }

        db.Users.push(newUser);
        await writeDatabase(db);
        res.redirect('/login'); // Перенаправляем на страницу входа
    } catch (err) {
        console.error('Ошибка при регистрации пользователя:', err);
        res.status(500).send('Ошибка при сохранении данных');
    }
});

// Обработчик выхода из системы
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Ошибка при завершении сессии:', err);
            return res.status(500).send('Ошибка при завершении сессии');
        }
        res.redirect('/login');
    });
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер работает на http://localhost:${port}`);
});